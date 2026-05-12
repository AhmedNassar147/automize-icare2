/*
 *
 * Helper: `installTelegramBotApi`.
 *
 */
import TelegramBot from "node-telegram-bot-api";
import { PDFParse } from "pdf-parse";
import createConsoleMessage from "./createConsoleMessage.mjs";
import {
  createPatientRowKey,
  getWeeklyHistoryPatient,
  updateWeeklyHistoryPatients,
} from "./db.mjs";
import getMimeType from "./getMimeType.mjs";
import updateEnvFile from "./updateEnvFile.mjs";
import mergeAllToPdf from "./mergeFilesToOne.mjs";
import compressPdfGentlly from "./compressPdfGentlly.mjs";
import containsExcludedText from "./containsExcludedText.mjs";

// https://t.me/td_cases_bot

const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];

const buildButtons = (referralId) => ({
  inline_keyboard: [
    [
      { text: "✅ Accept", callback_data: `accept_${referralId}` },
      { text: "❌ Reject", callback_data: `reject_${referralId}` },
    ],
    [
      { text: "❌ Cancel", callback_data: `cancel_${referralId}` },
      { text: "🔕 No Reply", callback_data: `noreply_${referralId}` },
    ],
    // [{ text: "⏳ Get Time Left", callback_data: `timeleft_${referralId}` }],
  ],
});

const prepareMessage = (message) => {
  const hasHtmlTags = /<[^>]+>/.test(message);

  if (hasHtmlTags) {
    // Already HTML — use as is
    return { text: message, parse_mode: "HTML" };
  }

  const hasMarkdown = /[*_`\[\]]/.test(message);

  if (hasMarkdown) {
    // Has Markdown — convert to HTML
    const html = message
      .replace(/\*(.*?)\*/g, "<b>$1</b>") // *bold*
      .replace(/_(.*?)_/g, "<i>$1</i>") // _italic_
      .replace(/`(.*?)`/g, "<code>$1</code>"); // `code`
    return { text: html, parse_mode: "HTML" };
  }

  // Plain text — escape HTML special chars just in case
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return { text: escaped, parse_mode: "HTML" };
};

const installTelegramBotApi = (TG_TOKEN, patientsStore) => {
  const bot = new TelegramBot(TG_TOKEN, { polling: true, filepath: false });

  createConsoleMessage("🤖 Telegram Case Bot is running...", "info");

  if (!process.env.TG_CHAT_ID) {
    createConsoleMessage(
      "⚠️ TG_CHAT_ID not set — send /me to the bot first",
      "warn",
    );
  }

  const getAllowedList = () =>
    process.env.TG_CHAT_IDS?.split(",").filter(Boolean) || [];

  const sendBotMessage = (chatId, message) =>
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });

  const getIfNotAuthorizedMessage = (msg) => {
    const chatId = String(msg.chat.id);
    const fromName =
      msg.from.first_name || msg.chat.first_name || msg.from.last_name;

    const allowedList = getAllowedList();
    const isAuthorized = allowedList.includes(chatId);

    return {
      chatId,
      fromName,
      allowedList,
      unAuthorizedMessage: isAuthorized
        ? undefined
        : `⛔ Hi, \`${fromName}\` you are not Authorized.`,
    };
  };

  bot.onText(/\/me/, async (msg) => {
    const { chatId, fromName, unAuthorizedMessage } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const activeChatId = process.env.TG_CHAT_ID;

    if (activeChatId === chatId) {
      await sendBotMessage(
        chatId,
        `✅ Hi, \`${fromName}\` you are already active.`,
      );
      return;
    }

    if (activeChatId) {
      await sendBotMessage(
        activeChatId,
        `🔔 \`${fromName}\` is now active and will receive cases. You are off duty.`,
      );
    }

    updateEnvFile({
      TG_CHAT_ID: chatId,
      TG_CHAT_USER_NAME: fromName,
    });
    await sendBotMessage(
      chatId,
      `✅ Hi, \`${fromName}\` you are active now, cases will be sent for you here, Chat ID \`${chatId}\` has been saved automatically.`,
    );
  });

  const pendingContactRequests = new Map();

  bot.on("contact", async (msg) => {
    const chatId = String(msg.chat.id);
    const pending = pendingContactRequests.get(chatId);

    if (!pending) return;

    const phoneNumber = msg.contact?.phone_number;

    if (!phoneNumber) {
      await sendBotMessage(chatId, "❌ No phone number received.");
      return;
    }

    // Optional but recommended: make sure user shared HIS OWN phone
    if (msg.contact.user_id && msg.contact.user_id !== msg.from.id) {
      await sendBotMessage(chatId, "❌ Please share your own phone number.");
      return;
    }

    pendingContactRequests.delete(chatId);

    const { allowedList, fromName } = pending;

    updateEnvFile({
      TG_CHAT_IDS: [...new Set([...allowedList, chatId].filter(Boolean))].join(
        ",",
      ),
      TG_PHONE_NUMBER: phoneNumber,
    });

    await bot.sendMessage(
      chatId,
      `✅ Hi, \`${fromName}\` you are added now, Please send /me to get activated, Chat ID \`${chatId}\` has been saved automatically. Phone: \`${phoneNumber}\``,
      {
        parse_mode: "Markdown",
        reply_markup: {
          remove_keyboard: true,
        },
      },
    );
  });

  bot.onText(/\/add/, async (msg) => {
    const { allowedList, chatId, fromName, unAuthorizedMessage } =
      getIfNotAuthorizedMessage(msg);

    if (!unAuthorizedMessage) {
      await sendBotMessage(
        chatId,
        `⛔ Hi, \`${fromName}\` you are already Authorized.`,
      );
      return;
    }

    pendingContactRequests.set(chatId, {
      allowedList,
      fromName,
    });

    await bot.sendMessage(chatId, "Share your phone number", {
      reply_markup: {
        keyboard: [
          [
            {
              text: "Share Phone",
              request_contact: true,
            },
          ],
        ],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  });

  bot.onText(/\/wait$/, async (msg) => {
    const { chatId, unAuthorizedMessage } = getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    await sendBotMessage(
      chatId,
      `✅ Current wait is set to \`${process.env.WAIT_FOR_ACCEPT_MS}\`ms.`,
    );
  });

  bot.onText(/\/wait (\d+)/, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const value = parseInt(match[1], 10);

    if (isNaN(value) || value < 1500) {
      await sendBotMessage(
        chatId,
        `⛔ Invalid number. Usage: /wait 2005 and value must be greater than 1500`,
      );
      return;
    }

    // do something with value
    updateEnvFile({ WAIT_FOR_ACCEPT_MS: value });

    await sendBotMessage(
      chatId,
      `✅ Hi \`${fromName}\`, wait time set to \`${value}\`ms successfully.`,
    );
  });

  const createReply = (queryId, chatId, replyMesgId) => async (message) => {
    await bot.answerCallbackQuery(queryId, {
      text: message,
      show_alert: false,
    });

    if (chatId) {
      // 2. Reply to the original case message
      await bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        disable_notification: false,
        reply_to_message_id: replyMesgId,
      });
    }
  };

  bot.on("callback_query", async (query) => {
    try {
      const { data, message, id } = query;

      const chatId = message?.chat?.id;
      const msgId = message?.message_id;

      const reply = createReply(id, chatId, msgId);

      if (!chatId) {
        const _message = `❌ chatId=${chatId} not found`;
        createConsoleMessage(_message, "error");

        return reply(_message);
      }

      const allowedList = getAllowedList();

      // ✅ Add this inside callback_query to restrict access
      if (!allowedList.includes(String(chatId))) {
        const _message = `❌ chatId=${chatId} not allowed`;
        createConsoleMessage(_message, "error");
        return reply(_message);
      }

      const [action, referralId] = data?.split("_");

      if (!action || !referralId) {
        const _message = `❌ action=${action} or referralId=${referralId} not found`;
        createConsoleMessage(
          _message,
          "error",
          `installTelegramBotApi => callback_query => data=${data}`,
        );

        return reply(_message);
      }

      const { patient } = patientsStore.findPatientByReferralId(referralId);

      if (!patient) {
        const _message = `❌ Patient not found for referralId=${referralId}`;
        createConsoleMessage(_message, "info");
        return reply(_message);
      }

      const rowKey = createPatientRowKey(patient);
      const storedPatient = getWeeklyHistoryPatient(rowKey);

      if (action === "noreply") {
        const actionNames = [
          ...new Set(
            [storedPatient?.providerAction, "no reply"].filter(Boolean),
          ),
        ].join(" then ");

        updateWeeklyHistoryPatients({
          ...patient,
          rowKey,
          isSent: "yes",
          isReceived: "yes",
          providerAction: actionNames,
        });

        const prefix = "✅";
        const messageReply = `${prefix} Done ${action} For (Referral ID: ${referralId})`;

        createConsoleMessage(messageReply, "info");
        return reply(messageReply);
      }

      const timeValidation = patientsStore.canStillProcessPatient(referralId);

      if (!timeValidation.success) {
        const replyMessage = `${timeValidation.message} For (Referral ID: ${referralId})`;

        const actionNames = [
          ...new Set([storedPatient?.providerAction, action].filter(Boolean)),
        ].join(" then ");

        updateWeeklyHistoryPatients({
          ...patient,
          rowKey,
          isSent: "yes",
          isReceived: "yes",
          providerAction: `${actionNames} with late reply`,
        });

        createConsoleMessage(replyMessage, "info");
        return reply(replyMessage);
      }

      const isAccepted = action === "accept";
      const isRejected = action === "reject";
      const isCancelled = action === "cancel";

      const scheduledAt = Date.now();

      let result = {};
      if (isAccepted) {
        result = await patientsStore.scheduleAcceptedPatient(
          referralId,
          scheduledAt,
        );
      } else if (isRejected) {
        result = await patientsStore.scheduleRejectedPatient(
          referralId,
          scheduledAt,
        );
      } else if (isCancelled) {
        result = await patientsStore.cancelPatient(referralId);
      }

      const { success, message: replyMessage } = result;
      const prefix = success ? "✅" : "❌";
      const __message = `${prefix} (Referral ID: ${referralId})  ${replyMessage}`;

      // Confirm to the user with a brief toast
      return reply(__message);
    } catch (error) {
      createConsoleMessage(
        error,
        "error",
        `❌  Error handling incoming callback_query:`,
      );
    }
  });

  const sendTelegramMessage = async (
    message,
    _files = [],
    targetReferralIdForButtons,
  ) => {
    const TG_CHAT_ID = process.env.TG_CHAT_ID;

    // ✅ Add this
    if (!TG_CHAT_ID) {
      createConsoleMessage(
        "⚠️ sendTelegramMessage skipped — send /start to the bot first",
        "warn",
      );
      return;
    }

    try {
      let messageId = undefined;

      if (message) {
        const { text, parse_mode } = prepareMessage(message);
        const res = await bot.sendMessage(TG_CHAT_ID, text, {
          parse_mode: parse_mode,
          disable_notification: false,
          ...(targetReferralIdForButtons && {
            reply_markup: buildButtons(targetReferralIdForButtons),
          }),
        });

        messageId = res.message_id;
      }

      if (!_files?.length) return;

      const fileChecks = await Promise.all(
        _files.map(async (file) => ({
          file,
          exclude: await containsExcludedText(file),
        })),
      );

      const files = fileChecks
        .filter(({ exclude, file }) => {
          if (exclude) {
            createConsoleMessage(`⏩ Excluding file: ${file.fileName}`, "warn");
          }
          return !exclude;
        })
        .map(({ file }) => file);

      const photos = [];
      const docs = [];
      const excelFiles = [];

      for (const file of files) {
        // Skip files that failed to download
        if (file.downloadError || !file.fileBase64) {
          createConsoleMessage(
            `⚠️ Skipping file ${file.fileName} — ${file.downloadError || "no base64"} for targetReferralIdForButtons=${targetReferralIdForButtons}`,
            "warn",
          );
          continue;
        }

        const cleanBase64 = file.fileBase64
          .replace(/^data:.*?base64,/, "")
          .trim();

        const buffer = Buffer.from(cleanBase64, "base64");
        const extension = (file.extension || "pdf").toLowerCase();
        const filename = `${file.fileName}.${extension}`;
        const mimeType = getMimeType(extension);

        const item = { buffer, filename, mimeType: mimeType };

        if (extension === "xlsx") {
          excelFiles.push(item);
        } else if (imageExtensions.includes(extension)) {
          photos.push(item);
        } else {
          docs.push(item);
        }
      }

      if (excelFiles.length) {
        // Send PDFs individually
        for (const doc of excelFiles) {
          await bot.sendDocument(
            TG_CHAT_ID,
            doc.buffer,
            { reply_to_message_id: messageId, caption: `📎 ${doc.filename}` },
            { filename: doc.filename, contentType: doc.mimeType },
          );
        }
      }

      if (photos.length === 0 && docs.length === 0) {
        return;
      }

      if (photos.length === 0 && docs.length === 1) {
        const [{ buffer, filename, mimeType }] = docs;
        await bot.sendDocument(
          TG_CHAT_ID,
          buffer,
          { reply_to_message_id: messageId, caption: `📎 ${filename}` },
          { filename: filename, contentType: mimeType },
        );

        return;
      }

      if (photos.length === 1 && docs.length === 0) {
        const [{ buffer, filename, mimeType }] = photos;
        await bot.sendPhoto(
          TG_CHAT_ID,
          buffer,
          { reply_to_message_id: messageId, caption: `📎 ${filename}` },
          { filename: filename, contentType: mimeType },
        );
        return;
      }

      const { fileName: firstFileName } =
        files.find(({ fileName }) => !!fileName) ?? {};

      const finalMergedFileName = `${firstFileName}_merged`;

      const merged = await mergeAllToPdf(
        photos || [],
        docs || [],
        finalMergedFileName,
      );

      const compressedMerged = await compressPdfGentlly(merged, {
        unlinkFilesFinally: true,
      });

      await bot.sendDocument(
        TG_CHAT_ID,
        compressedMerged,
        {
          reply_to_message_id: messageId,
          caption: `📎 ${finalMergedFileName}`,
        },
        {
          filename: `${finalMergedFileName}.pdf`,
          contentType: "application/pdf",
        },
      );

      // Send photos as album (batches of 10)
      for (let i = 0; i < photos.length; i += 10) {
        const batch = photos.slice(i, i + 10);
        await bot.sendMediaGroup(
          TG_CHAT_ID,
          batch.map((f, idx) => ({
            type: "photo",
            media: f.buffer,
            fileOptions: { contentType: f.mimeType, filename: f.filename },
          })),
          {
            reply_to_message_id: messageId,
          },
        );
      }

      // Send PDFs individually
      for (const doc of docs) {
        await bot.sendDocument(
          TG_CHAT_ID,
          doc.buffer,
          { reply_to_message_id: messageId, caption: `📎 ${doc.filename}` },
          { filename: doc.filename, contentType: doc.mimeType },
        );
      }
    } catch (error) {
      createConsoleMessage(error, "error", "❌ sendTelegramMessage failed:");
    }
  };

  return sendTelegramMessage;
};

export default installTelegramBotApi;
