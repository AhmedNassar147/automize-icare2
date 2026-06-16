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
import {
  createPatientRowKey,
  getCaseFile,
  getWeeklyHistoryPatient,
  updateWeeklyHistoryPatients,
  upsertCaseFile,
} from "./db.mjs";
import getMimeType from "./getMimeType.mjs";
import updateEnvFile from "./updateEnvFile.mjs";
import mergeAllToPdf from "./mergeFilesToOne.mjs";
import compressPdfGentlly from "./compressPdfGentlly.mjs";
import formatFilesToTelegram from "./formatFilesToTelgram.mjs";
import sleep from "./sleep.mjs";
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import getPatientReferralDataFromAPI from "./getPatientReferralDataFromAPI.mjs";
import getCurrentActionLetterFile from "./getCurrentActionLetterFile.mjs";
import closePageSafely from "./closePageSafely.mjs";
import getExtraTimeBasedLogs from "./getExtraTimeBasedLogs.mjs";
import notifyUserWithNewCase from "./notifyUserWithNewCase.mjs";
import {
  migrateCaseLogTimings,
  readLogsAsArray,
} from "./summarizeLogsAfterAcceptance.mjs";
import createAndSendInvoiceReport from "./createAndSendInvoiceReport.mjs";
import formatPatientToTelegramOrWA from "./formatPatientToTelegramOrWA.mjs";
import { HOME_PAGE_URL, USER_ACTION_TYPES } from "./constants.mjs";
import handleUserActionOnCase from "./handleUserActionOnCase.mjs";

const execAsync = promisify(exec);

const imageExtensions = ["jpg", "jpeg", "png", "gif", "webp"];
const ONLINE_CONFIRM_TIMEOUT_MS = 2 * 60 * 1000;

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
  wait: {
    value: /\/wait(?:\s+(\d+))?$/,
    description: "Get or set wait time. Examples: /wait OR /wait 2050",
    command: "wait",
  },
  auto_wait: {
    value: /\/auto_wait(?:\s+(\S+))?$/,
    description:
      "Get or set auto wait. Examples: /auto_wait OR /auto_wait 1 OR /auto_wait 0",
    command: "auto_wait",
  },
  f_accept: {
    value: /\/f_accept$/,
    description: "get first patient to be accepted with time left details",
    command: "f_accept",
  },
  who: {
    value: /\/who/,
    description: "check who is on duty",
    command: "who",
  },
  activate: {
    value: /\/activate\s+(\d+)$/,
    description: "Activate another authorized user by chat ID",
    command: "activate",
  },
  getUsers: {
    value: /\/get_users$/,
    description: "List all authorized users and show active one",
    command: "get_users",
  },
  updateCode: {
    value: /\/update_code$/,
    description: "pull latest code from master and restart the server",
    command: "update_code",
  },
  getCasesStatus: {
    value: /\/get_cases_status\s+([1-9]\d*)$/,
    description:
      "Long press → get last amount of accepted cases status, Example: /get_cases_status 1 OR /get_cases_status 2",
    command: "get_cases_status",
  },
  getReferralLetter: {
    value: /\/letter (.+)/,
    description:
      "Long press → get letter, Example: /letter a 12345 OR /letter r 12345 OR /letter r 12345 reason",
    command: "letter",
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
    value: /\/invoice(?:\s+(.*))?$/,
    description:
      "Get invoice report. Examples: /invoice or /invoice -f or /invoice -f -s",
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

const escapeTelegramHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const restoreTelegramHtmlTags = (value = "") =>
  value.replace(
    /&lt;(\/?(?:b|strong|i|em|u|s|strike|del|code|pre))&gt;/g,
    (_, tag) => {
      return `<${tag}>`;
    },
  );

const markdownToHtml = (value = "") => {
  const codes = [];

  value = value.replace(/`([^`]+?)`/g, (_, content) => {
    const token = `__CODE_BLOCK_${codes.length}__`;
    codes.push(`<code>${content}</code>`);
    return token;
  });

  value = value.replace(/\*(.*?)\*/g, "<b>$1</b>");

  codes.forEach((code, i) => {
    value = value.replace(`__CODE_BLOCK_${i}__`, code);
  });

  return value;
};

const prepareMessage = (message = "") => {
  let text = escapeTelegramHtml(message);
  text = markdownToHtml(text);
  text = restoreTelegramHtmlTags(text);

  return {
    text,
    parse_mode: "HTML",
  };
};

const getAllowedList = () =>
  process.env.TG_CHAT_IDS?.split(",")
    .map((id) => id.trim())
    .filter(Boolean) || [];

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

const getIfNotAuthorizedMessage = (msg, checkAdminChatId) => {
  const { chatId, fromName, msgId } = getMessageData(msg);
  const allowedList = getAllowedList();
  const isAuthorized = allowedList.includes(chatId);
  const adminChatId = process.env.ADMIN_CHAT_ID;

  let unAuthorizedMessage = isAuthorized
    ? undefined
    : `⛔ \`${fromName}\` you are not Authorized.`;

  if (!unAuthorizedMessage && checkAdminChatId && chatId !== adminChatId) {
    unAuthorizedMessage = `⛔ This command is restricted, it only responds to Ahmed.`;
  }

  return {
    chatId,
    msgId,
    fromName,
    allowedList,
    unAuthorizedMessage,
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

    if (!allowedList.length) {
      pendingOnlineChecks.delete(referralId);
      return;
    }

    createConsoleMessage(
      {
        referralId,
        allowedList,
        currentIndex: pending.currentIndex,
        sentChatIds: pending.sentChatIds,
      },
      "info",
      "online cascade state",
    );

    const nextIndex = (pending.currentIndex + 1) % allowedList.length;
    const nextChatId = allowedList[nextIndex];

    if (!nextChatId || pending.sentChatIds.includes(nextChatId)) {
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

    const patientData = patientsStore.getPatientByReferralId(referralId);
    await notifyUserWithNewCase(patientData);

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
        const res = await sendBotMessage(TG_CHAT_ID, message, {
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

        const item = {
          buffer,
          filename,
          mimeType: mimeType,
          caption: `📎 ${file.fileName}`,
        };

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
            { reply_to_message_id: messageId, caption: doc.caption },
            { filename: doc.filename, contentType: doc.mimeType },
          );
        }
      }

      if (photos.length === 0 && docs.length === 0) {
        return;
      }

      if (photos.length === 0 && docs.length === 1) {
        const [{ buffer, filename, mimeType, caption }] = docs;
        await bot.sendDocument(
          TG_CHAT_ID,
          buffer,
          { reply_to_message_id: messageId, caption: caption },
          { filename: filename, contentType: mimeType },
        );

        return;
      }

      if (photos.length === 1 && docs.length === 0) {
        const [{ buffer, filename, mimeType, caption }] = photos;
        await bot.sendPhoto(
          TG_CHAT_ID,
          buffer,
          { reply_to_message_id: messageId, caption: caption },
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
          caption: `${finalMergedFileName}`,
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
          { reply_to_message_id: messageId, caption: doc.caption },
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
        `<b>Current patients:</b>\n<pre>Here are the current (${allPatients.length}) patients to process</pre>`,
      );

      const applicablePatients = allPatients.filter(
        (patient) => patient?.referralEndTimestamp >= Date.now(),
      );

      const formatedPatients = applicablePatients.map((patient) =>
        formatPatientToTelegramOrWA(patient, true),
      );

      await Promise.all(
        formatedPatients.map(({ message, files, referralId }) =>
          sendTelegramMessage(message, files, referralId, chatId, true),
        ),
      );
    }
  });

  bot.onText(COMMANDS.activate.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName, allowedList } =
      getIfNotAuthorizedMessage(msg, true);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const targetChatId = match?.[1];

    if (!allowedList.includes(targetChatId)) {
      return await sendBotMessage(
        chatId,
        `⛔ Chat ID \`${targetChatId}\` is not authorized.`,
      );
    }

    const previousChatId = getActiveChatID();

    if (previousChatId === targetChatId) {
      return await sendBotMessage(
        chatId,
        `⛔ Chat ID \`${targetChatId}\` is already active.`,
      );
    }

    const targetName = await getChatName(targetChatId);

    updateEnvFile({
      TG_CHAT_ID: targetChatId,
      TG_CHAT_USER_NAME: targetName,
      CLIENT_WHATSAPP_NUMBER: process.env[`TG_PHONE_NUMBER_${targetChatId}`],
    });

    await sleep(1000);

    await sendBotMessage(
      chatId,
      `✅ Activated \`${targetName}\` (\`${targetChatId}\`).`,
    );

    await sendBotMessage(
      targetChatId,
      `🟢 Ahmed Just put you on duty, You are now active and will receive cases.`,
    ).catch(() => null);

    if (previousChatId && previousChatId !== targetChatId) {
      await sendBotMessage(
        previousChatId,
        `⚪ You are no longer active.\n` +
          `🔔 \`${fromName}\` switched active duty to \`${targetName}\`.`,
      ).catch(() => null);
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

  bot.onText(COMMANDS.getUsers.value, async (msg) => {
    const { unAuthorizedMessage, chatId, allowedList } =
      getIfNotAuthorizedMessage(msg, true);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    if (!allowedList.length) {
      return await sendBotMessage(chatId, `⚠️ No authorized users found.`);
    }

    const activeChatId = getActiveChatID();

    const users = await Promise.all(
      allowedList.map(async (id) => {
        const name = await getChatName(id);

        const isActive = id === activeChatId;

        return `${isActive ? "🟢" : "⚪"} ` + `\`${name}\` → \`${id}\``;
      }),
    );

    await sendBotMessage(
      chatId,
      `👥 *Authorized Users*\n` +
        `────────────────────────\n\n` +
        users.join("\n\n"),
    );
  });

  bot.onText(COMMANDS.wait.value, async (msg, match) => {
    const { chatId, unAuthorizedMessage, fromName } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const raw = match?.[1];

    const currentWait = process.env.WAIT_FOR_ACCEPT_MS;

    // GET CURRENT
    if (!raw) {
      return await sendBotMessage(
        chatId,
        `✅ Current wait time is \`${currentWait}\`ms.`,
      );
    }

    // SET NEW
    const value = parseInt(raw, 10);

    const minValue = 1800;

    if (!Number.isFinite(value) || value < minValue) {
      return await sendBotMessage(
        chatId,
        `⛔ Invalid value \`${raw}\`.\nIt should be a number greater than or equal to ${minValue}.\nUsage:\n/wait\n/wait 2050`,
      );
    }

    if (currentWait === String(value)) {
      return await sendBotMessage(
        chatId,
        `⛔ waitTime is already \`${value}\`ms.`,
      );
    }

    updateEnvFile({ WAIT_FOR_ACCEPT_MS: value });

    await sendBotMessage(
      chatId,
      `✅ waitTime updated from \`${currentWait}\`ms to \`${value}\`ms.`,
    );

    const activeChatId = getActiveChatID();

    if (activeChatId !== chatId) {
      await sendBotMessage(
        activeChatId,
        `🔔 \`${fromName}\` changed waitTime from \`${currentWait}\`ms to \`${value}\`ms.`,
      );
    }
  });

  bot.onText(COMMANDS.auto_wait.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, fromName } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }

    const value = match?.[1];

    if (value && !["1", "0"].includes(value)) {
      return await sendBotMessage(
        chatId,
        `⛔ Invalid value \`${value}\`.\nUsage:\n/auto_wait\n/auto_wait 1\n/auto_wait 0`,
      );
    }

    const currentAutoWaitState = process.env.ENABLE_AUTO_WAITING;

    const isAutoWaitingActive = currentAutoWaitState === "1";

    if (!value) {
      return await sendBotMessage(
        chatId,
        `✅ Auto waiting is \`${isAutoWaitingActive ? "enabled" : "disabled"}\`.`,
      );
    }

    const isActive = value === "1";
    const isSame = currentAutoWaitState === value;
    const status = isActive ? "enabled" : "disabled";

    if (isSame) {
      return await sendBotMessage(
        chatId,
        `⛔ Auto waiting is already \`${status}\`.`,
      );
    }

    updateEnvFile({ ENABLE_AUTO_WAITING: value });

    await sendBotMessage(chatId, `✅ Auto waiting updated to \`${status}\`.`);

    const activeChatId = getActiveChatID();

    if (activeChatId !== chatId) {
      await sendBotMessage(
        activeChatId,
        `🔔 \`${fromName}\` changed \`autoWait\` to \`${status}\`.`,
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

    const firstGoingToAccept = patientsStore.getFirstGoingToAccept(true);

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

    if (!reason) {
      const record = getCaseFile(referralId);
      const {
        action: recordAction,
        referralId: recordReferralId,
        tgFileId,
      } = record || {};

      if (
        tgFileId &&
        recordAction === actionType &&
        recordReferralId === referralId
      ) {
        try {
          const fileMessage = `✅ Cached letter served for Referral ID: \`${referralId}\` and action: \`${recordAction}\`.`;
          await sendBotMessage(chatId, fileMessage, {
            reply_to_message_id: msgId,
          });

          await bot.sendDocument(chatId, tgFileId, {
            reply_to_message_id: msgId,
            caption: `📎 ${recordAction}_${referralId}`,
          });

          createConsoleMessage(fileMessage, "info");

          return;
        } catch (err) {
          createConsoleMessage(
            err?.message || err,
            "warn",
            `cached file resend failed referralId=${referralId}`,
          );
        }
      }
    }

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

    const referralEndTimestamp = Date.now();
    const { ENABLE_AUTO_WAITING, WAIT_FOR_ACCEPT_MS } = process.env;
    const current = Number(WAIT_FOR_ACCEPT_MS);
    const isAutoWaitingActive = ENABLE_AUTO_WAITING === "1";

    const formatResult = (title, result) =>
      `${title} → extra \`${result.computedExtraWait}ms\` → *\`${current + result.computedExtraWait}ms\`*\n` +
      `${result.computedExtraBotMessages.join("\n") || "No messages"}`;

    const zeroResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: 0,
      baseWaitingTime: current,
    });

    const negativeResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: -1000,
      baseWaitingTime: current,
    });

    const normalRttResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: 0,
      rtt: 70,
      baseWaitingTime: current,
    });

    const rtt95Result = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: 0,
      rtt: 95,
      baseWaitingTime: current,
    });

    const rtt130Result = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: 0,
      rtt: 130,
      baseWaitingTime: current,
    });

    const normalRttWithNegativeResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: -1000,
      rtt: 70,
      baseWaitingTime: current,
    });

    const rtt130WithNegativeResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: -1000,
      rtt: 130,
      baseWaitingTime: current,
    });

    const normalBackendDelayResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: 0,
      extraBackendDelayMs: 1000,
      baseWaitingTime: current,
    });

    const highBackendDelayResult = await getExtraTimeBasedLogs({
      referralId: "test",
      referralEndTimestamp,
      diff: 0,
      extraBackendDelayMs: 2000,
      baseWaitingTime: current,
    });

    await sendBotMessage(
      chatId,
      `🧪 *Next Case Extra Time Test Results*\n` +
        `────────────────────────\n\n` +
        `*⚙️ current waitingTime* → \`${current}ms\`\n\n` +
        `*📍 Auto waiting* → \`${isAutoWaitingActive ? "Enabled" : "Disabled"}\`\n\n` +
        `${formatResult("📊 Stable diff=0", zeroResult)}\n\n` +
        `${formatResult("📉 Negative diff<0", negativeResult)}\n\n` +
        `${formatResult("📶 RTT normal 70ms", normalRttResult)}\n\n` +
        `${formatResult("📶 RTT 95ms", rtt95Result)}\n\n` +
        `${formatResult("📶 RTT 130ms", rtt130Result)}\n\n` +
        `${formatResult("📶 RTT normal with diff<0", normalRttWithNegativeResult)}\n\n` +
        `${formatResult("📶 RTT 130ms with diff<0", rtt130WithNegativeResult)}\n\n` +
        `${formatResult("🖥️ Backend delay normal 1000ms", normalBackendDelayResult)}\n\n` +
        `${formatResult("🖥️ Backend delay high 2000ms", highBackendDelayResult)}`,
    );
  });

  bot.onText(COMMANDS.getInvoiceFile.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, msgId } = getIfNotAuthorizedMessage(
      msg,
      true,
    );

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage, {
        reply_to_message_id: msgId,
      });
      return;
    }

    const args = (match?.[1] || "").split(/\s+/).filter(Boolean);

    const allowedArgs = ["-f", "-s"];
    const invalidArgs = args.filter((arg) => !allowedArgs.includes(arg));

    if (invalidArgs.length) {
      await sendBotMessage(
        chatId,
        `⛔ Invalid arguments: ${invalidArgs.join(", ")}\n\nAllowed:\n/invoice\n/invoice -f\n/invoice -f -s`,
        {
          reply_to_message_id: msgId,
        },
      );

      return;
    }

    const isFinal = args.includes("-f");
    const skipValidation = args.includes("-s");

    if (skipValidation && !isFinal) {
      await sendBotMessage(
        chatId,
        `⛔ "-s" can only be used with "-f"\n\nExamples:\n/invoice -f\n/invoice -f -s`,
        {
          reply_to_message_id: msgId,
        },
      );

      return;
    }

    try {
      await sendBotMessage(chatId, `✅ Preparing Invoice Report....`, {
        reply_to_message_id: msgId,
      });

      const { message, files } = await createAndSendInvoiceReport(
        browser,
        !isFinal,
        skipValidation,
      );

      await sendTelegramMessage(message, files, null, chatId, true);
    } catch (error) {
      await sendBotMessage(chatId, `⛔ Error: ${error?.message || error}`, {
        reply_to_message_id: msgId,
      });
    }
  });

  bot.onText(COMMANDS.getCasesStatus.value, async (msg, match) => {
    const { unAuthorizedMessage, chatId, msgId } =
      getIfNotAuthorizedMessage(msg);

    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage, {
        reply_to_message_id: msgId,
      });
      return;
    }

    const numberOfCases = Number(match?.[1]);

    if (!Number.isInteger(numberOfCases) || numberOfCases < 1) {
      await sendBotMessage(
        chatId,
        `⛔ Invalid number of cases. Please provide a valid number. Example: /get_cases_status 1`,
        {
          reply_to_message_id: msgId,
        },
      );
      return;
    }

    try {
      const allCasesLogsData = await readLogsAsArray();
      const selectedCases = allCasesLogsData.slice(-numberOfCases);

      if (!selectedCases.length) {
        await sendBotMessage(chatId, `⛔ No cases found in logs.`, {
          reply_to_message_id: msgId,
        });
        return;
      }

      const message = [
        `📊 *Last ${selectedCases.length} Case Status${selectedCases.length > 1 ? "es" : ""}*`,
        ``,
        ...selectedCases.map((item, index) => {
          const {
            referralId,
            claimed,
            status,
            extraWaitMessage,
            extraBackendDelayMs,
            delta,
            tookMS,
            rtt,
            diff,
            waitTime,
            extraWait,
          } = item;

          return [
            `#${index + 1}`,
            `🆔 Case: \`${referralId}\``,
            diff !== undefined ? `📊 Diff: \`${diff}\`` : null,
            `📊 Delay: \`${extraBackendDelayMs || 0}\``,
            rtt !== undefined ? `📶 RTT (ms): \`${rtt}\`` : null,
            tookMS !== undefined ? `⏱️ Took (ms): \`${tookMS}\`` : null,
            `⏱️ Wait Time: \`${waitTime}_${extraWait || 0}\``,
            `📋 Status: \`${status || "unknown"}\``,
            `🏁 Claimed: \`${claimed || "unknown"}\``,
            delta !== undefined ? `🔁 delta after accept: \`${delta}\`` : null,
            extraWaitMessage
              ? [
                  `⏱️ waitingStatus:`,
                  ...extraWaitMessage
                    .split("_AND_")
                    .filter(Boolean)
                    .map((item) => `  • ${item}`),
                ].join("\n")
              : null,
          ]
            .filter(Boolean)
            .join("\n");
        }),
      ].join("\n\n");

      await sendBotMessage(chatId, message, {
        reply_to_message_id: msgId,
      });
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
          `⚠️ Local changes detected — cannot pull:\n<pre>${localChanges}</pre>\n\n` +
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
          `📦 <b>Changes:</b>\n<pre>${logPreview || "No log available"}</pre>\n\n` +
          `🔁 <b>Current commit:</b> <code>${beforeHash}</code>\n\n` +
          `⏳ Pulling and restarting server...\n\n` +
          `🔁 <b>Please check if the app is running after restart</b>`,
      );

      await sleep(1000); // wait after second message before pulling
      await execAsync("git pull --rebase origin master", gitOptions);
    } catch (err) {
      createConsoleMessage(err, "error", "❌ updatecode failed:");
      await sendBotMessage(
        chatId,
        `❌ Update failed:\n<pre>${err.message}</pre>`,
      );
    }
  });

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

  bot.onText(COMMANDS.updateCmds.value, async (msg) => {
    const { unAuthorizedMessage, chatId } = getIfNotAuthorizedMessage(msg);
    if (unAuthorizedMessage) {
      await sendBotMessage(chatId, unAuthorizedMessage);
      return;
    }
    await setupCommands();

    await sendBotMessage(chatId, `✅ Bot commands updated.`);
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

  const confirmOnlineIfPending = async ({
    referralId,
    chatId,
    fromName,
    reply,
    silent,
  }) => {
    const currentActiveChatId = getActiveChatID();
    const pending = pendingOnlineChecks.get(referralId);

    const isSameChat = currentActiveChatId === chatId;

    if (!pending) {
      if (isSameChat) {
        return true;
      }

      const chatName = currentActiveChatId
        ? await getChatName(currentActiveChatId)
        : "another user";

      if (!isSameChat) {
        await reply(
          `⚠️ This online confirmation is expired, ${chatName} is active now.`,
        );
      }

      return false;
    }

    if (pending.confirmed) {
      const confirmedBy = pending.confirmedBy;
      const chatName = confirmedBy
        ? await getChatName(confirmedBy)
        : "Another user";

      if (confirmedBy === chatId) {
        return true;
      }

      if (confirmedBy !== chatId) {
        await reply(`⚠️ ${chatName} confirmed online and active now.`);
      }

      return false;
    }

    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    pending.confirmed = true;
    pending.confirmedBy = chatId;
    pendingOnlineChecks.delete(referralId);

    if (currentActiveChatId !== chatId) {
      updateEnvFile({
        TG_CHAT_ID: chatId,
        TG_CHAT_USER_NAME: fromName,
        CLIENT_WHATSAPP_NUMBER: process.env[`TG_PHONE_NUMBER_${chatId}`],
      });
    }

    const previousChatIds = pending.sentChatIds.filter(
      (sentChatId) => sentChatId !== chatId,
    );

    await Promise.all(
      previousChatIds.map((sentChatId) =>
        sendBotMessage(
          sentChatId,
          `🔔 \`${fromName}\` confirmed online for Referral ID: \`${referralId}\`.\nYou are marked as not active for this case.`,
        ).catch(() => null),
      ),
    );

    if (!silent) {
      await reply(
        `✅ Online Confirmed. You are now active for Referral ID: ${referralId}`,
      );
    }

    return true;
  };

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

      const {
        message: _message,
        success,
        skipMessage,
      } = await handleUserActionOnCase({
        patientsStore,
        referralId,
        action,
        onAcceptOrRejectForFileUpload: async () => {
          const { fileData } =
            (await getCurrentActionLetterFile(referralId, action, true)) || {};

          if (!fileData) {
            const _message = `❌ fileData not found for action=${action} and referralId=${referralId}`;
            createConsoleMessage(_message, "error");
            return await reply(_message);
          }

          const fileName = `${action}_${referralId}`;

          const actionDocumentResponse = await bot
            .sendDocument(
              messageChatId,
              fileData,
              { reply_to_message_id: msgId, caption: `📎 ${fileName}` },
              { filename: `${fileName}.pdf`, contentType: "application/pdf" },
            )
            .catch((err) => {
              createConsoleMessage(
                err?.message || err,
                "error",
                `sendDocument ${fileName}`,
              );

              return null;
            });

          const fileId = actionDocumentResponse?.document?.file_id;

          if (fileId) {
            upsertCaseFile(referralId, action, fileId);
          }
        },
        onAnotherAction: () =>
          confirmOnlineIfPending({
            referralId,
            chatId,
            fromName,
            reply,
            // silent: true,
            silent: false,
          }),
        onOnlineAction: () =>
          confirmOnlineIfPending({
            referralId,
            chatId,
            fromName,
            reply,
            silent: false,
          }),
      });

      if (_message && !skipMessage) {
        reply(_message);
      }
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
