/*
 *
 * Helper: `installTelegramBotApi`.
 *
 */
import TelegramBot from "node-telegram-bot-api";
import { PDFParse } from "pdf-parse";
import { exec } from "child_process";
import { promisify } from "util";
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
import formatFilesToTelegram from "./formatFilesToTelgram.mjs";
import sleep from "./sleep.mjs";

const execAsync = promisify(exec);

// https://t.me/td_cases_bot

const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];

const buildButtons = (referralId) => ({
  inline_keyboard: [
    [
      { text: "✅ Accept", callback_data: `accept_${referralId}` },
      { text: "❌ Reject", callback_data: `reject_${referralId}` },
      { text: "❌ Cancel", callback_data: `cancel_${referralId}` },
    ],
    [
      { text: "🔕 No Reply", callback_data: `noreply_${referralId}` },
      { text: "⏳ Left Time", callback_data: `lefttime_${referralId}` },
    ],
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

  const sendBotMessage = (chatId, message, options = {}) =>
    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      ...(options || null),
    });

  const pendingContactRequests = new Map();

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
      msgId: msg.message_id,
      unAuthorizedMessage: isAuthorized
        ? undefined
        : `⛔ \`${fromName}\` you are not Authorized.`,
    };
  };

  const COMMANDS = {
    add: {
      value: /\/add/,
      desc: "add your self for authorization",
      example: "/add",
    },
    me: {
      value: /\/me/,
      desc: "make your self active to receive and control cases",
      example: "/me",
    },
    wait: {
      value: /\/wait$/,
      desc: "get current wait time before hitting the accept button",
      example: "/wait",
    },
    setWait: {
      value: /\/wait (\d+)/,
      desc: "set wait time to wait before hitting the accept button",
      example: "/wait 2010",
      exampleNote: "2010 is an example, use any number above 1600",
    },
    f_accept: {
      value: /\/f_accept$/,
      desc: "get First going to be accepted patient with time left details",
      example: "/f_accept",
    },
    auto_wait: {
      value: /\/auto_wait$/,
      desc: "get if auto update wait time is enabled or not",
      example: "/auto_wait",
    },
    setAutoWait: {
      value: /\/auto_wait (\d+)/,
      desc: "enable or disable auto update wait time",
      example: "/auto_wait 1 OR /auto_wait 0",
    },
    updateCode: {
      value: /\/update_code$/,
      desc: "pull latest code from master and restart the server",
      example: "/update_code",
    },
    cmds: {
      value: /\/cmds$/,
      desc: "get all available commands",
      example: "/cmds",
    },
  };

  bot.onText(COMMANDS.me.value, async (msg) => {
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

    const { [`TG_PHONE_NUMBER_${chatId}`]: activePhoneNumber, CLIENT_ID } =
      process.env;

    updateEnvFile({
      TG_CHAT_ID: chatId,
      TG_CHAT_USER_NAME: fromName,
      ...(CLIENT_ID !== "TADAWI" && !!activePhoneNumber
        ? { CLIENT_WHATSAPP_NUMBER: activePhoneNumber }
        : null),
    });
    await sendBotMessage(
      chatId,
      `✅ Hi, \`${fromName}\` you are active now, cases will be sent for you here, Chat ID \`${chatId}\` has been saved automatically.`,
    );
  });

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
      [`TG_PHONE_NUMBER_${chatId}`]: phoneNumber,
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

  bot.onText(COMMANDS.add.value, async (msg) => {
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

  bot.onText(COMMANDS.wait.value, async (msg) => {
    const { chatId, unAuthorizedMessage } = getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    await sendBotMessage(
      chatId,
      `✅ Current wait time is set to \`${process.env.WAIT_FOR_ACCEPT_MS}\`ms.`,
    );
  });

  bot.onText(COMMANDS.setWait.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const value = parseInt(match[1], 10);

    if (isNaN(value) || value < 1600) {
      await sendBotMessage(
        chatId,
        `⛔ Invalid number. Usage: /wait 2005 and value must be greater than 1600`,
      );
      return;
    }

    updateEnvFile({ WAIT_FOR_ACCEPT_MS: value });

    await sendBotMessage(
      chatId,
      `✅ Hi \`${fromName}\`, wait time set to \`${value}\`ms successfully.`,
    );
  });

  bot.onText(COMMANDS.f_accept.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName, msgId } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const firstGoindToAccept = patientsStore.getFirstGoingToAccept();

    if (!firstGoindToAccept) {
      return await sendBotMessage(
        chatId,
        `⛔ Currently there is no patient going to be accepted.`,
        {
          reply_to_message_id: msgId,
        },
      );
    }

    const { referralId, patientName } = firstGoindToAccept;
    const { message, timeMs } = patientsStore.getReferralLeftTime(referralId);

    await sendBotMessage(
      chatId,
      `✅ Referral ID: \`${referralId}\` Patient: ${patientName}\n` +
        `${message}`,
      {
        reply_to_message_id: msgId,
      },
    );
  });

  bot.onText(COMMANDS.auto_wait.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const isAutoWaitingActive = process.env.ENABLE_AUTO_WAITING === "1";

    await sendBotMessage(
      chatId,
      `✅ Auto waiting is ${isAutoWaitingActive ? "enabled" : "disabled"} `,
    );
  });

  bot.onText(COMMANDS.setAutoWait.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const value = match[1] || "";

    if (!["1", "0"].includes(value)) {
      return await sendBotMessage(
        chatId,
        `⛔ Invalid value. Usage: /auto_wait \`1 or 0\` LIKE: /auto_wait 1`,
      );
    }

    const isActive = value === "1";
    const isSame = process.env.ENABLE_AUTO_WAITING === value;

    if (isSame) {
      return await sendBotMessage(
        chatId,
        `⛔ Auto waiting is already ${isActive ? "enabled" : "disabled"} `,
      );
    }

    updateEnvFile({ ENABLE_AUTO_WAITING: value });

    await sendBotMessage(
      chatId,
      `✅ Auto waiting just ${isActive ? "enabled" : "disabled"} `,
    );
  });

  bot.onText(COMMANDS.updateCode.value, async (msg) => {
    const { unAuthorizedMessage, chatId } = getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      return await sendBotMessage(chatId, unAuthorizedMessage);
    }

    const gitOptions = { cwd: process.cwd() };

    try {
      await sendBotMessage(chatId, `🔄 Checking for updates...`);

      // 1. Check for local uncommitted changes
      const { stdout: localChangesRaw } = await execAsync(
        "git status --porcelain",
        gitOptions,
      );
      const localChanges = localChangesRaw.trim();

      if (localChanges) {
        return sendBotMessage(
          chatId,
          `⚠️ Local changes detected — cannot pull:\n\`\`\`\n${localChanges}\n\`\`\`\n\n` +
            `Please tell Ahmed Nassar to fix this.`,
        );
      }

      // 2. Get current commit
      const { stdout: beforeHashRaw } = await execAsync(
        "git rev-parse --short HEAD",
        gitOptions,
      );
      const beforeHash = beforeHashRaw.trim();

      // 2. Fetch latest from remote
      await execAsync("git fetch origin", gitOptions);

      // 3. Check if already up to date
      const { stdout: statusRaw } = await execAsync(
        "git status -uno",
        gitOptions,
      );
      const isUpToDate = statusRaw.trim().includes("Your branch is up to date");

      if (isUpToDate) {
        return sendBotMessage(
          chatId,
          `✅ Already up to date. No restart needed.\n\`Commit: ${beforeHash}\``,
        );
      }

      // 5. Get commits that WILL change (before pulling)
      const { stdout: logPreviewRaw } = await execAsync(
        "git log HEAD..origin/master --oneline",
        gitOptions,
      );
      const logPreview = logPreviewRaw.trim();

      // 6. Notify user BEFORE pulling — message sends before nodemon restarts
      await sendBotMessage(
        chatId,
        `✅ Code updated successfully!\n\n` +
          `📦 *Changes:*\n\`\`\`\n${logPreview || "No log available"}\n\`\`\`\n\n` +
          `🔁 *Current commit:* \`${beforeHash}\`\n\n` +
          `⏳ Pulling and restarting server...`,
      );

      await sleep(500);
      await sendBotMessage(chatId, `🔁 *Please check if the app is running*`);
      await sleep(1000); // wait after second message before pulling
      await execAsync("git pull --rebase origin master", gitOptions);
    } catch (err) {
      createConsoleMessage(err, "error", "❌ updatecode failed:");
      await sendBotMessage(
        chatId,
        `❌ Update failed:\n\`\`\`\n${err.message}\n\`\`\``,
      );
    }
  });

  bot.onText(COMMANDS.cmds.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const formattedMessage =
      `📋 *Available Commands*\n` +
      `─────────────────────────\n\n` +
      Object.entries(COMMANDS)
        .map(([key, { desc, example, exampleNote }]) => {
          const exampleLine = exampleNote
            ? `\`${example}\` _← ${exampleNote}_`
            : `\`${example}\``;

          return `▶️ ${exampleLine}\n_${desc}_`;
        })
        .join("\n\n");

    await sendBotMessage(chatId, formattedMessage);
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

      if (action === "lefttime") {
        const { message, timeMs } =
          patientsStore.getReferralLeftTime(referralId);

        return reply(message);
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
        const res = await sendBotMessage(TG_CHAT_ID, text, {
          parse_mode: parse_mode,
          disable_notification: false,
          ...(targetReferralIdForButtons && {
            reply_markup: buildButtons(targetReferralIdForButtons),
          }),
        });

        messageId = res.message_id;
      }

      const files = await formatFilesToTelegram(_files);

      if (!files?.length) return;

      const photos = [];
      const docs = [];
      const excelFiles = [];

      for (const file of files) {
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
