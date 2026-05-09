/*
 *
 * Helper: `installTelegramBotApi`.
 *
 */
import TelegramBot from "node-telegram-bot-api";
import createConsoleMessage from "./createConsoleMessage.mjs";
import {
  createPatientRowKey,
  getWeeklyHistoryPatient,
  updateWeeklyHistoryPatients,
} from "./db.mjs";
import getMimeType from "./getMimeType.mjs";
import updateEnvFile from "./updateEnvFile.mjs";

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

  bot.onText(/\/me/, (msg) => {
    const chatId = String(msg.chat.id);
    const fromName =
      msg.from.first_name || msg.chat.first_name || msg.from.last_name;

    const allowedList = getAllowedList();

    if (!allowedList.includes(chatId)) {
      bot.sendMessage(
        chatId,
        `⛔ Hi, \`${fromName}\` you are not Authorized.`,
        {
          parse_mode: "Markdown",
        },
      );
      return;
    }

    const activeChatId = process.env.TG_CHAT_ID;

    if (activeChatId === chatId) {
      bot.sendMessage(
        chatId,
        `✅ Hi, \`${fromName}\` you are already active.`,
        {
          parse_mode: "Markdown",
        },
      );
      return;
    }

    updateEnvFile({
      TG_CHAT_ID: chatId,
    });
    bot.sendMessage(
      chatId,
      `✅ Hi, \`${fromName}\` you are active now, cases will be sent for you here, Chat ID \`${chatId}\` has been saved automatically.`,
      {
        parse_mode: "Markdown",
      },
    );
  });

  bot.onText(/\/add/, (msg) => {
    const chatId = String(msg.chat.id);
    const fromName =
      msg.from.first_name || msg.chat.first_name || msg.from.last_name;

    const allowedList = getAllowedList();

    if (allowedList.includes(chatId)) {
      bot.sendMessage(
        chatId,
        `⛔ Hi, \`${fromName}\` you are already Authorized.`,
        {
          parse_mode: "Markdown",
        },
      );
      return;
    }

    updateEnvFile({
      TG_CHAT_IDS: [...new Set([...allowedList, chatId].filter(Boolean))].join(
        ",",
      ),
    });
    bot.sendMessage(
      chatId,
      `✅ Hi, \`${fromName}\` you are added now, Please send /me to get activated, Chat ID \`${chatId}\` has been saved automatically.`,
      {
        parse_mode: "Markdown",
      },
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
    files = [],
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

      if (!files?.length) return;

      const photos = [];
      const docs = [];

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

        if (imageExtensions.includes(extension)) {
          photos.push({ buffer, filename, mimeType: mimeType });
        } else {
          docs.push({ buffer, filename, mimeType: mimeType });
        }
      }

      // Send photos as album (batches of 10)
      for (let i = 0; i < photos.length; i += 10) {
        const batch = photos.slice(i, i + 10);
        await bot.sendMediaGroup(
          TG_CHAT_ID,
          batch.map((f, idx) => ({
            type: "photo",
            media: f.buffer,
            ...(idx === 0 && { caption: `🖼️ ${batch.length} photo(s)` }),
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
