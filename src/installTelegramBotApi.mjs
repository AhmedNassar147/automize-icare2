/*
 *
 * Helper: `installTelegramBotApi`.
 *
 */
import TelegramBot from "node-telegram-bot-api";
import { unlink } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import createConsoleMessage from "./createConsoleMessage.mjs";
import processSendCollectedPatientsToWhatsapp from "./processSendCollectedPatientsToWhatsapp.mjs";
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
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import { HOME_PAGE_URL, USER_ACTION_TYPES } from "./constants.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import getPatientReferralDataFromAPI from "./getPatientReferralDataFromAPI.mjs";
import getCurrentActionLetterFile from "./getCurrentActionLetterFile.mjs";
import closePageSafely from "./closePageSafely.mjs";
import getExtraTimeBasedLogs from "./getExtraTimeBasedLogs.mjs";
import notifyUserWithNewCase from "./notifyUserWithNewCase.mjs";
import { migrateCaseLogTimings } from "./summarizeLogsAfterAcceptance.mjs";
import createAndSendInvoiceReport from "./createAndSendInvoiceReport.mjs";

const execAsync = promisify(exec);

const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
const ONLINE_CONFIRM_TIMEOUT_MS = 3 * 60 * 1000;

const COMMANDS = {
  add: {
    value: /\/add/,
    description: "add yourself for authorization",
    command: "add",
  },
  me: {
    value: /\/me/,
    description: "make yourself active to receive and control cases",
    command: "me",
  },
  setWait: {
    value: /\/set_wait (\d+)/,
    description: "Long press → set wait time. Example: /set_wait 2050",
    command: "set_wait",
  },
  setAutoWait: {
    value: /\/set_auto_wait (\d+)/,
    description: "Long press → control auto wait. Example: /set_auto_wait 1",
    command: "set_auto_wait",
  },
  wait: {
    value: /\/wait$/,
    description: "get current wait time before hitting the accept button",
    command: "wait",
  },
  f_accept: {
    value: /\/f_accept$/,
    description: "get first patient to be accepted with time left details",
    command: "f_accept",
  },
  auto_wait: {
    value: /\/auto_wait$/,
    description: "get if auto update wait time is enabled or not",
    command: "auto_wait",
  },
  updateCode: {
    value: /\/update_code$/,
    description: "pull latest code from master and restart the server",
    command: "update_code",
  },
  getReferralLetter: {
    value: /\/letter (.+)/,
    description:
      "Long press → get letter, Example: /letter a 12345 OR /letter r 12345 OR /letter r 12345 reason",
    command: "letter",
  },
  who: {
    value: /\/who/,
    description: "check who is on duty",
    command: "who",
  },
  testNextCaseExtraTime: {
    value: /\/test_next_case_extra_time/,
    description: "get extra time for next case",
    command: "test_next_case_extra_time",
  },
  migrateLogs: {
    value: /\/migrate_logs/,
    description: "migrate logs",
    command: "migrate_logs",
  },
  getInvoiceFile: {
    value: /\/invoice(?:\s+(\w+))?$/,
    description: "get invoice excel file",
    command: "invoice",
  },
  updateCmds: {
    value: /\/update_commands/,
    description: "update bot commands",
    command: "update_commands",
  },
  clearCmds: {
    value: /\/clear_commands/,
    description: "clear bot commands",
    command: "clear_commands",
  },
};

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
      { text: "🟢 Online", callback_data: `online_${referralId}` },
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

const getAllowedList = () =>
  process.env.TG_CHAT_IDS?.split(",").filter(Boolean) || [];

const getMessageData = (msg) => {
  const chatId = String(msg.chat.id);
  const fromName =
    msg.from.first_name || msg.chat.first_name || msg.from.last_name;

  return {
    chatId,
    fromName,
    msgId: msg.message_id,
  };
};

const getIfNotAuthorizedMessage = (msg) => {
  const { chatId, fromName, msgId } = getMessageData(msg);
  const allowedList = getAllowedList();
  const isAuthorized = allowedList.includes(chatId);

  return {
    chatId,
    msgId,
    fromName,
    allowedList,
    unAuthorizedMessage: isAuthorized
      ? undefined
      : `⛔ \`${fromName}\` you are not Authorized.`,
  };
};

const makeLetterGenerationAndReturnFile = async ({
  browser,
  patientData,
  reason,
  referralId,
  actionType,
}) => {
  try {
    const isAcceptanceLetter = actionType === USER_ACTION_TYPES.ACCEPT;

    const _patientData = {
      referralId,
      ...patientData,
      __reasonName__: !isAcceptanceLetter && !!reason ? reason : undefined,
    };

    await generateAcceptancePdfLetters(
      browser,
      [_patientData],
      isAcceptanceLetter,
    );

    const { fileData, filePath } = await getCurrentActionLetterFile(
      referralId,
      actionType,
      true,
    );

    try {
      await unlink(filePath);
    } catch (error) {
      createConsoleMessage(
        error,
        "error",
        `❌ makeLetterGenerationAndReturnFile failed when removing filePath=${filePath} :`,
      );
    }

    return fileData;
  } catch (error) {
    createConsoleMessage(
      error,
      "error",
      "❌ makeLetterGenerationAndReturnFile failed:",
    );
    return null; // caller already handles null
  }
};

const getActiveChatID = () => process.env.TG_CHAT_ID;

const installTelegramBotApi = async (TG_TOKEN, patientsStore, browser) => {
  const bot = new TelegramBot(TG_TOKEN, { polling: true, filepath: false });

  createConsoleMessage("🤖 Telegram Case Bot is running...", "info");

  if (!getActiveChatID()) {
    createConsoleMessage(
      "⚠️ TG_CHAT_ID not set — send /me to the bot first",
      "warn",
    );
  }

  const getChatName = async (chatId) => {
    try {
      const chat = await bot.getChat(chatId);
      return chat.first_name || chat.last_name || chat.username || chatId;
    } catch {
      return chatId;
    }
  };

  const pendingContactRequests = new Map();
  const pendingOnlineChecks = new Map();

  const sendBotMessage = async (chatId, message, options = {}) => {
    const { parse_mode, text } = prepareMessage(message);

    return await bot.sendMessage(chatId, text, {
      parse_mode: parse_mode,
      ...(options || null),
    });
  };

  const processNextOnlineCheck = async (referralId) => {
    const pending = pendingOnlineChecks.get(referralId);

    if (!pending || pending.confirmed) return;

    const allowedList = getAllowedList();
    const nextIndex = pending.currentIndex + 1;
    const nextChatId = allowedList[nextIndex];

    if (!nextChatId) {
      await Promise.all(
        pending.sentChatIds.map((chatId) =>
          sendBotMessage(
            chatId,
            `⚠️ No one confirmed online for Referral ID: \`${referralId}\`.`,
          ).catch(() => null),
        ),
      );

      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      pendingOnlineChecks.delete(referralId);
      return;
    }

    pending.currentIndex = nextIndex;
    pending.sentChatIds.push(nextChatId);

    await sendTelegramMessage(
      pending.message,
      pending.files,
      referralId,
      nextChatId,
      true,
    );

    await notifyUserWithNewCase(referralId);

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    pending.timeoutId = setTimeout(() => {
      processNextOnlineCheck(referralId);
    }, ONLINE_CONFIRM_TIMEOUT_MS);
  };

  const sendTelegramMessage = async (
    message,
    _files = [],
    targetReferralIdForButtons,
    overrideChatId = null,
    skipOnlineCheckCreation = false,
  ) => {
    const TG_CHAT_ID = overrideChatId || getActiveChatID();

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

        if (targetReferralIdForButtons && !skipOnlineCheckCreation) {
          const allowedList = getAllowedList();

          const startIndex = Math.max(allowedList.indexOf(TG_CHAT_ID), 0);

          const timeoutId = setTimeout(() => {
            processNextOnlineCheck(targetReferralIdForButtons);
          }, ONLINE_CONFIRM_TIMEOUT_MS);

          pendingOnlineChecks.set(targetReferralIdForButtons, {
            referralId: targetReferralIdForButtons,
            message,
            files: _files,
            confirmed: false,
            confirmedBy: null,
            sentChatIds: [TG_CHAT_ID],
            currentIndex: startIndex,
            timeoutId,
          });
        }
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

  async function setupCommands() {
    const commands = Object.values(COMMANDS)
      .filter((item) => item.command !== "add")
      .map((item) => ({
        command: item.command,
        description: item.description,
      }));

    const TG_CHAT_ID = getActiveChatID();

    await bot.setMyCommands(commands, { scope: { type: "default" } });

    // also set for the active chat specifically so it takes precedence
    if (TG_CHAT_ID) {
      await bot.setMyCommands(commands, {
        scope: { type: "chat", chat_id: TG_CHAT_ID },
      });
    }

    createConsoleMessage(`commandsSet`, "info");
  }

  bot.onText(COMMANDS.clearCmds.value, async (msg) => {
    const { unAuthorizedMessage, chatId } = getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    await bot.deleteMyCommands({ scope: { type: "default" } });
    await bot.deleteMyCommands({ scope: { type: "all_private_chats" } });
    await bot.deleteMyCommands({ scope: { type: "all_group_chats" } });
    await bot.deleteMyCommands({
      scope: { type: "all_chat_administrators" },
    });

    await bot.deleteMyCommands({
      scope: {
        type: "chat",
        chat_id: chatId,
      },
    });

    await sendBotMessage(
      chatId,
      "Commands cleared for this chat. Reopen the bot chat.",
    );
  });

  bot.onText(COMMANDS.me.value, async (msg) => {
    const { chatId, fromName, unAuthorizedMessage } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const activeChatId = getActiveChatID();

    if (activeChatId === chatId) {
      await sendBotMessage(
        chatId,
        `✅ Hi, \`${fromName}\` you are already active.`,
      );
      return;
    }

    updateEnvFile({
      TG_CHAT_ID: chatId,
      TG_CHAT_USER_NAME: fromName,
      CLIENT_WHATSAPP_NUMBER: process.env[`TG_PHONE_NUMBER_${chatId}`],
    });

    await sleep(1000);

    if (activeChatId) {
      await sendBotMessage(
        activeChatId,
        `🔔 \`${fromName}\` is now active and will receive cases. You are off duty.`,
      );
    }
    await sendBotMessage(
      chatId,
      `✅ Hi, \`${fromName}\` you are active now, cases will be sent for you here, Chat ID \`${chatId}\` has been saved automatically.`,
    );

    const allPatients = patientsStore.getAllPatients();

    if (allPatients?.length) {
      await sendBotMessage(
        chatId,
        `*Current patients:*\n\`\`\`\nHere are the current (${allPatients.length}) patients to process\n\`\`\``,
      );

      await processSendCollectedPatientsToWhatsapp(
        sendTelegramMessage,
        undefined,
        true,
      )(allPatients);
    }
  });

  bot.onText(COMMANDS.who.value, async (msg) => {
    const { unAuthorizedMessage, chatId } = getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      return sendBotMessage(chatId, unAuthorizedMessage);
    }

    const activeChatId = getActiveChatID();

    if (!activeChatId) {
      return sendBotMessage(chatId, `⚠️ No one is currently on duty.`);
    }

    const chatName = await getChatName(activeChatId);

    await sendBotMessage(
      chatId,
      `👮 *Duty Status*\n` +
        `────────────────────────\n` +
        `🟢 *Active:* \`${chatName || "Unknown"}\` — \`${activeChatId}\``,
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
    await setupCommands();
    await sleep(1000);

    await sendBotMessage(
      chatId,
      `✅ Hi, \`${fromName}\` you are added now, Please send /me to get activated, Chat ID \`${chatId}\` has been saved automatically. Phone: \`${phoneNumber}\``,
      {
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

  bot.onText(COMMANDS.updateCmds.value, async (msg) => {
    const { unAuthorizedMessage, chatId } = getIfNotAuthorizedMessage(msg);
    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }
    await setupCommands();

    await sendBotMessage(chatId, `✅ Bot commands updated.`);
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
        `⛔ Invalid number. Usage: /set_wait 2005 and value must be greater than 1600`,
      );
      return;
    }

    const currentWait = process.env.WAIT_FOR_ACCEPT_MS;

    updateEnvFile({ WAIT_FOR_ACCEPT_MS: value });
    await sleep(1000);

    await sendBotMessage(
      chatId,
      `✅ waitTime updated from \`${currentWait}\`ms  to \`${value}\`ms successfully.`,
    );

    const activeChatId = getActiveChatID();

    if (activeChatId !== chatId) {
      await sendBotMessage(
        activeChatId,
        `🔔 \`${fromName}\` just changed waitTime to \`${value}\`ms.`,
      );
    }
  });

  bot.onText(COMMANDS.f_accept.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName, msgId } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const firstGoingToAccept = patientsStore.getFirstGoingToAccept();

    if (!firstGoingToAccept) {
      return await sendBotMessage(
        chatId,
        `⛔ Currently there is no patient going to be accepted.`,
        {
          reply_to_message_id: msgId,
        },
      );
    }

    const { referralId, patientName } = firstGoingToAccept;
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
        `⛔ Invalid value. Usage: /set_auto_wait \`1 or 0\` LIKE: /set_auto_wait 1`,
      );
    }

    const isActive = value === "1";
    const isSame = process.env.ENABLE_AUTO_WAITING === value;

    const status = isActive ? "enabled" : "disabled";

    if (isSame) {
      return await sendBotMessage(
        chatId,
        `⛔ Auto waiting is already \`${status}\`.`,
      );
    }

    updateEnvFile({ ENABLE_AUTO_WAITING: value });
    await sleep(1000);

    await sendBotMessage(
      chatId,
      `✅ Auto waiting just updated to \`${status}\`.`,
    );

    const activeChatId = getActiveChatID();

    if (activeChatId !== chatId) {
      await sendBotMessage(
        activeChatId,
        `🔔 \`${fromName}\` just changed \`autoWait\` to \`${status}\`.`,
      );
    }
  });

  bot.onText(COMMANDS.getReferralLetter.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName, msgId } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const raw = (match[1] || "").trim();

    const parts = raw.split(/\s+/); // split by spaces
    const action = parts[0]?.toLowerCase(); // "a" or "r"
    const referralId = parts[1]; // "125225"
    const reason = (parts.slice(2) || []).join(" "); // "some reason" or ""

    if (!["a", "r"].includes(action)) {
      return sendBotMessage(
        chatId,
        `⛔ Invalid action \`${action}\`.\nUse *a* for accept or *r* for reject.\nExample: \`/letter a 125225\``,
      );
    }

    if (!referralId || !/^\d+$/.test(referralId)) {
      return sendBotMessage(
        chatId,
        `⛔ Invalid referral ID \`${referralId}\`.\nExample: \`/letter a 125225\``,
      );
    }

    const actionType =
      action === "a" ? USER_ACTION_TYPES.ACCEPT : USER_ACTION_TYPES.REJECT;

    const patientData = patientsStore.getPatientByReferralId(referralId);

    if (!patientData) {
      await sendBotMessage(
        chatId,
        "⛔ Patient removed from the store, searching the app....",
      );
    }

    let fileBuffer = null;

    if (patientData) {
      fileBuffer = await makeLetterGenerationAndReturnFile({
        actionType,
        browser,
        patientData,
        reason,
        referralId,
      });
    }

    if (!fileBuffer) {
      const { isLoggedIn, newPage, isErrorAboutLockedOut } =
        await makeUserLoggedInOrOpenHomePage({
          browser,
          startingPageUrl: HOME_PAGE_URL,
          noCursor: true,
          noBundleCheck: true,
        });

      if (isErrorAboutLockedOut) {
        await closePageSafely(newPage);

        return await sendBotMessage(
          chatId,
          `⛔ Could not loginin, We are blocked`,
          {
            reply_to_message_id: msgId,
          },
        );
      }

      if (!isLoggedIn) {
        await closePageSafely(newPage);
        return await sendBotMessage(
          chatId,
          `⛔ Could not loginin, Please check the app`,
          {
            reply_to_message_id: msgId,
          },
        );
      }

      const fetchedPatientData = await getPatientReferralDataFromAPI(
        newPage,
        referralId,
        true,
      );

      await closePageSafely(newPage);

      const { patientDetailsError, patientInfoError } =
        fetchedPatientData || {};

      if (patientDetailsError || patientInfoError || !fetchedPatientData) {
        return await sendBotMessage(
          chatId,
          fetchedPatientData
            ? `⛔ Could Find the patient in the app, please try again`
            : `⛔ Error: ${patientDetailsError || patientInfoError}`,
          {
            reply_to_message_id: msgId,
          },
        );
      }

      fileBuffer = await makeLetterGenerationAndReturnFile({
        actionType,
        browser,
        patientData: fetchedPatientData,
        reason,
        referralId,
      });
    }

    if (!fileBuffer) {
      return await sendBotMessage(
        chatId,
        `⛔ Could Find the patient while searching the app, please try again`,
        {
          reply_to_message_id: msgId,
        },
      );
    }

    const fileName = `letter_${actionType}_${referralId}`;

    await bot.sendDocument(
      chatId,
      fileBuffer,
      { reply_to_message_id: msgId, caption: `📎 ${fileName}` },
      { filename: `${fileName}.pdf`, contentType: "application/pdf" },
    );
  });

  bot.onText(COMMANDS.testNextCaseExtraTime.value, async (msg) => {
    const { unAuthorizedMessage, chatId } = getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const zeroResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp: Date.now(),
      diff: 0,
    });

    const negativeResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp: Date.now(),
      diff: -1000,
    });

    const current = Number(process.env.WAIT_FOR_ACCEPT_MS);

    await sendBotMessage(
      chatId,
      `🧪 *Next Case Extra Time Test Results*\n` +
        `────────────────────────\n\n` +
        `⚙️ current waitingTime → \`${current}ms\`\n\n` +
        `${zeroResult.computedExtraBotMessages.join("\n") || "No messages"}\n\n` +
        `${negativeResult.computedExtraBotMessages.join("\n") || "No messages"}`,
    );
  });

  bot.onText(COMMANDS.getInvoiceFile.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, msgId } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const arg = match?.[1] || null;
    const onlyForPresentation = !!arg;

    console.log({
      arg,
      onlyForPresentation,
    });

    try {
      await sendBotMessage(chatId, `✅ Preparing Invoice Report.`, {
        reply_to_message_id: msgId,
      });
      await createAndSendInvoiceReport(browser, sendTelegramMessage, true);
    } catch (error) {
      await sendBotMessage(chatId, `⛔ Error: ${error?.message || error}`, {
        reply_to_message_id: msgId,
      });
    }
  });

  bot.onText(COMMANDS.migrateLogs.value, async (msg) => {
    const { unAuthorizedMessage, chatId, msgId } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    try {
      await migrateCaseLogTimings();
      await sendBotMessage(chatId, `✅ Timings Logs migrated Successfully.`, {
        reply_to_message_id: msgId,
      });
    } catch (error) {
      await sendBotMessage(chatId, `⛔ Error: ${error?.message || error}`, {
        reply_to_message_id: msgId,
      });
    }
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

      // 3. Fetch latest from remote
      await execAsync("git fetch origin", gitOptions);

      // 4. Check if already up to date
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
          `⏳ Pulling and restarting server...\n\n` +
          `🔁 *Please check if the app is running after restart*`,
      );

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

  const createReply = (queryId, chatId, replyMesgId) => async (message) => {
    try {
      await bot.answerCallbackQuery(queryId, {
        text: message,
        show_alert: false,
      });
    } catch (err) {
      // Query expired — ignore silently
      createConsoleMessage(
        `⚠️ answerCallbackQuery expired: ${err.message}`,
        "warn",
      );
    }

    if (chatId) {
      // 2. Reply to the original case message
      await sendBotMessage(chatId, message, {
        disable_notification: false,
        reply_to_message_id: replyMesgId,
      });
    }
  };

  bot.on("polling_error", (err) => {
    createConsoleMessage(err.message, "warn", "⚠️ Telegram polling error:");
  });

  bot.on("callback_query", async (query) => {
    try {
      const { data, message, id } = query;

      const chatId = String(query.from.id);
      const messageChatId = String(message.chat.id);

      const msgId = message.message_id;
      const fromName =
        query.from?.first_name ||
        query.from?.last_name ||
        query.from?.username ||
        getMessageData(message).fromName ||
        chatId;

      const reply = createReply(id, messageChatId, msgId);

      if (!chatId) {
        const _message = `❌ chatId=${chatId} not found`;
        createConsoleMessage(_message, "error");

        return reply(_message);
      }

      const allowedList = getAllowedList();

      // ✅ Add this inside callback_query to restrict access
      if (!allowedList.includes(chatId)) {
        const _message = `❌ chatId=${chatId} not allowed`;
        createConsoleMessage(_message, "error");
        return reply(_message);
      }

      const [action, referralId] = data?.split("_") || [];

      if (!action || !referralId) {
        const _message = `❌ action=${action} or referralId=${referralId} not found`;
        createConsoleMessage(
          _message,
          "error",
          `installTelegramBotApi => callback_query => data=${data}`,
        );

        return reply(_message);
      }

      if (action === "online") {
        const pending = pendingOnlineChecks.get(referralId);

        if (!pending) {
          const chatName = await getChatName(getActiveChatID());

          return reply(
            `⚠️ This online confirmation is expired, ${chatName} is active now.`,
          );
        }

        if (pending.confirmed) {
          const chatName = pending.confirmedBy
            ? await getChatName(pending.confirmedBy)
            : "Another user";

          return reply(`⚠️ ${chatName} confirmed and active now.`);
        }

        if (pending.timeoutId) {
          clearTimeout(pending.timeoutId);
        }

        pending.confirmed = true;
        pending.confirmedBy = chatId;
        pendingOnlineChecks.delete(referralId);
        await patientsStore.scheduleFakeRejectProbe(referralId, false);

        updateEnvFile({
          TG_CHAT_ID: chatId,
          TG_CHAT_USER_NAME: fromName,
          CLIENT_WHATSAPP_NUMBER: process.env[`TG_PHONE_NUMBER_${chatId}`],
        });
        await sleep(1000);

        const previousChatIds = pending.sentChatIds.filter(
          (sentChatId) => sentChatId !== chatId,
        );

        await Promise.all(
          previousChatIds.map(async (sentChatId) => {
            await sendBotMessage(
              sentChatId,
              `🔔 \`${fromName}\` confirmed online for Referral ID: \`${referralId}\`.\nYou are marked as not active for this case.`,
            ).catch(() => null);
          }),
        );

        return reply(
          `✅ Confirmed. You are now active for Referral ID: ${referralId}`,
        );
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

  return sendTelegramMessage;
};

export default installTelegramBotApi;
