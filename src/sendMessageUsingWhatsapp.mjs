/*
 *
 * Helper: `sendMessageUsingWhatsapp`.
 *
 */
import qrcode from "qrcode-terminal";
import pkg from "whatsapp-web.js";
import getMimeType from "./getMimeType.mjs";
import extractReferralId from "./extractReferralId.mjs";
import normalizePhoneNumber from "./normalizePhoneNumber.mjs";
import validateReplyText from "./validateReplyText.mjs";
import createConfirmationMessage from "./createConfirmationMessage.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import {
  createPatientRowKey,
  getWeeklyHistoryPatient,
  updateWeeklyHistoryPatients,
} from "./db.mjs";

const { Client, LocalAuth, MessageMedia } = pkg;

const clients = new Map();
const initializationLocks = new Map();

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 3000;
const getChatId = (number) => `${number}@c.us`;

export const shutdownAllClients = async () => {
  createConsoleMessage("🛑 Shutting down all clients...", "info");
  await Promise.all(
    Array.from(clients.entries()).map(async ([number, { client }]) => {
      try {
        await client.destroy();
        createConsoleMessage(`✅ [${number}] Client destroyed.`, "info");
      } catch (err) {
        createConsoleMessage(
          err,
          "error",
          `❌ [${number}] Failed to destroy client:`
        );
      }
    })
  );
  clients.clear();
  initializationLocks.clear();
};

const withLock = async (key, fn) => {
  while (initializationLocks.get(key)) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  initializationLocks.set(key, true);
  try {
    return await fn();
  } finally {
    initializationLocks.delete(key);
  }
};

export const initializeClient = async (
  number,
  patientsStore,
  { headless = false } = {}
) =>
  withLock(number, async () => {
    const chatId = getChatId(number);
    const authId = `client-${number}`;

    if (clients.has(number)) {
      const {
        isReady,
        isInitializing,
        client: oldClient,
      } = clients.get(number);
      if (isReady || isInitializing) {
        createConsoleMessage(
          `ℹ️ [${number}] Client already initialized.`,
          "info"
        );
        return;
      }
      try {
        await oldClient.destroy();
        createConsoleMessage(
          `♻️ [${number}] Destroyed old client before reinitialization.`,
          "info"
        );
      } catch (err) {
        createConsoleMessage(
          err,
          "error",
          `❌ [${number}] Error destroying old client:`
        );
      }
    }

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: authId }),
      puppeteer: {
        headless,
        executablePath: process.env.CHROME_EXECUTABLE_PATH,
      },
    });

    const state = {
      client,
      isReady: false,
      isInitializing: true,
      retryCount: 0,
      queue: [],
    };

    clients.set(number, state);

    client.on("qr", (qr) => {
      qrcode.generate(qr, { small: true });
    });

    client.on("ready", async () => {
      if (state.isReady) return;

      createConsoleMessage(`✅ [${number}] Client ready.`, "info");
      state.isReady = true;
      state.isInitializing = false;
      state.retryCount = 0;

      if (state.queue.length > 0) {
        createConsoleMessage(
          `📤 [${number}] Sending ${state.queue.length} queued message(s)...`,
          "info"
        );
        await Promise.all(
          state.queue.map((msg) => sendMessageWithFiles(number, msg))
        );
        state.queue = [];
      }
    });

    client.on("auth_failure", (msg) => {
      createConsoleMessage(`❌ [${number}] Auth failure: ${msg}`, "error");
      state.isReady = false;
      state.isInitializing = false;
    });

    client.on("disconnected", () => {
      createConsoleMessage(`⚠️ [${number}] Disconnected.`, "warn");

      state.isReady = false;
      state.isInitializing = false;

      if (state.retryCount >= MAX_RETRIES) {
        createConsoleMessage(`🛑 [${number}] Max retries reached.`, "warn");
        return;
      }

      const delay =
        BASE_RETRY_DELAY * 2 ** state.retryCount + Math.random() * 1000;
      state.retryCount++;

      createConsoleMessage(
        `🔁 [${number}] Retrying in ${(delay / 1000).toFixed(2)}s...`,
        "info"
      );

      setTimeout(
        () => initializeClient(number, patientsStore, { headless }),
        delay
      );
    });

    client.on("message", async (message) => {
      try {
        const { from: _from, body } = message || {};

        if (!_from || !body) {
          createConsoleMessage(
            `⚠️ [${number}] Message missing 'from' or 'body'.`,
            "warn"
          );
          return;
        }

        let from = _from;

        if (_from.includes("@lid")) {
          const contact = await message.getContact(); // resolves @lid → contact
          from = contact.id?._serialized;
        }

        createConsoleMessage(
          `📨 [${number}] Incoming message from: ${from} — "${body}" where Expected chatId=${chatId}`,
          "info"
        );

        if (from !== chatId) {
          createConsoleMessage(
            `⛔ [${number}] Message ignored — not from expected chatId.`,
            "warn"
          );
          return;
        }

        if (!message.hasQuotedMsg) {
          await message.reply(
            `⚠️ Please reply to a *patient card* message with:\n${createConfirmationMessage()}`
          );
          return;
        }

        const quotedMsg = await message.getQuotedMessage();
        const referralId = extractReferralId(quotedMsg.body);

        if (!referralId) {
          createConsoleMessage(
            `❌ [${number}] No referral ID in quoted message:\n${quotedMsg.body}`,
            "error"
          );
          await quotedMsg.reply(
            `❌ Invalid patient message — No *Referral ID* in quoted message.`
          );
          return;
        }

        const {
          isAcceptance,
          isSuperAcceptance,
          isCancellation,
          isRejection,
          actionName,
          isSentWithoutReply,
          isSentAndReceivedWithoutReply,
        } = validateReplyText(body);

        const { patient } = patientsStore.findPatientByReferralId(referralId);

        const rowKey = createPatientRowKey(patient);
        const storedPatient = getWeeklyHistoryPatient(rowKey);

        if (isSentWithoutReply || isSentAndReceivedWithoutReply) {
          const actionNames = [
            ...new Set(
              [storedPatient?.providerAction, "no reply"].filter(Boolean)
            ),
          ].join(" then ");

          updateWeeklyHistoryPatients({
            ...patient,
            rowKey,
            isSent: "yes",
            isReceived: isSentAndReceivedWithoutReply ? "yes" : "no",
            providerAction: actionNames,
          });

          const prefix = "✅";
          const messageReply = `${prefix} (Referral ID: ${referralId})  ${actionName}`;

          await quotedMsg.reply(messageReply);

          createConsoleMessage(messageReply, "info");
          return;
        }

        if (!isAcceptance && !isCancellation && !isRejection) {
          await message.reply(
            `⚠️ Please select a patient card and reply with:\n${createConfirmationMessage()}`
          );
          return;
        }

        const scheduledAt = Date.now();

        const validation = patientsStore.canStillProcessPatient(referralId);

        if (!validation.success) {
          await quotedMsg.reply(validation.message);

          const actionNames = [
            ...new Set(
              [storedPatient?.providerAction, actionName].filter(Boolean)
            ),
          ].join(" then ");

          updateWeeklyHistoryPatients({
            ...patient,
            rowKey,
            isSent: "yes",
            isReceived: "yes",
            providerAction: `${actionNames} with late reply`,
          });
          return;
        }

        let result = {};
        if (isAcceptance) {
          result = await patientsStore.scheduleAcceptedPatient(
            referralId,
            scheduledAt,
            isSuperAcceptance
          );
        } else if (isRejection) {
          result = await patientsStore.scheduleRejectedPatient(
            referralId,
            scheduledAt
          );
        } else if (isCancellation) {
          result = await patientsStore.cancelPatient(referralId);
        }

        const { success, message: replyMessage } = result;
        const prefix = success ? "✅" : "❌";
        await quotedMsg.reply(
          `${prefix} (Referral ID: ${referralId})  ${replyMessage}`
        );

        createConsoleMessage(
          `📩 [${number}] Patient update result: ${prefix} ${replyMessage}`,
          "info"
        );
      } catch (err) {
        createConsoleMessage(
          err,
          "error",
          `❌ [${number}] Error handling incoming message:`
        );
      }
    });

    await client.initialize();
  });

const sendMessageWithFiles = async (number, msgWithFiles) => {
  if (!msgWithFiles) return;

  const { message, files } = msgWithFiles;
  const chatId = getChatId(number);
  const clientState = clients.get(number);
  if (!clientState) return;

  const { client } = clientState;

  try {
    if (message) await client.sendMessage(chatId, message);

    if (Array.isArray(files)) {
      for (const { extension, fileBase64, fileName } of files) {
        const mimeType = getMimeType(extension);

        const cleanBase64 = fileBase64.replace(/^data:.*?base64,/, "").trim();
        const media = new MessageMedia(
          mimeType,
          cleanBase64,
          `${fileName}.${extension}`
        );
        await client.sendMessage(chatId, media);
      }
    }
  } catch (err) {
    createConsoleMessage(
      err,
      "error",
      `❌ [${number}] Failed to send message or files:`
    );
  }
};

const sendMessageUsingWhatsapp =
  (patientsStore, options = {}) =>
  async (number, messages) => {
    const phoneNo = normalizePhoneNumber(number);
    await initializeClient(phoneNo, patientsStore, options);

    const safeMessages = Array.isArray(messages) ? messages : [messages];
    const state = clients.get(phoneNo);

    if (!state?.isReady) {
      createConsoleMessage(
        `📥 [${phoneNo}] Client not ready — queuing messages`,
        "info"
      );
      state.queue.push(...safeMessages);
    } else {
      for (const msg of safeMessages) {
        try {
          await sendMessageWithFiles(phoneNo, msg);
        } catch (err) {
          createConsoleMessage(
            err,
            "error",
            `❌ [${phoneNo}] Failed to send message:`
          );
        }
      }
    }
  };

export default sendMessageUsingWhatsapp;
