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

const { Client, LocalAuth, MessageMedia } = pkg;

const clients = new Map();
const initializationLocks = new Map();

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY = 3000;
const getChatId = (number) => `${number}@c.us`;

export const shutdownAllClients = async () => {
  console.log("🛑 Shutting down all clients...");
  await Promise.all(
    Array.from(clients.entries()).map(async ([number, { client }]) => {
      try {
        await client.destroy();
        console.log(`✅ [${number}] Client destroyed.`);
      } catch (err) {
        console.error(`❌ [${number}] Failed to destroy client:`, err);
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
        console.log(
          `[${new Date().toLocaleTimeString()}] ℹ️ [${number}] Client already initialized.`
        );
        return;
      }
      try {
        await oldClient.destroy();
        console.log(
          `[${new Date().toLocaleTimeString()}] ♻️ [${number}] Destroyed old client before reinitialization.`
        );
      } catch (err) {
        console.log(
          `[${new Date().toLocaleTimeString()}] ❌ [${number}] Error destroying old client:`,
          err
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

      console.log(
        `[${new Date().toLocaleTimeString()}] ✅ [${number}] Client ready.`
      );
      state.isReady = true;
      state.isInitializing = false;
      state.retryCount = 0;

      if (state.queue.length > 0) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 📤 [${number}] Sending ${
            state.queue.length
          } queued message(s)...`
        );
        await Promise.all(
          state.queue.map((msg) => sendMessageWithFiles(number, msg))
        );
        state.queue = [];
      }
    });

    client.on("auth_failure", (msg) => {
      console.log(
        `[${new Date().toLocaleTimeString()}] ❌ [${number}] Auth failure: ${msg}`
      );
      state.isReady = false;
      state.isInitializing = false;
    });

    client.on("disconnected", () => {
      console.log(
        `[${new Date().toLocaleTimeString()}] ⚠️ [${number}] Disconnected.`
      );

      state.isReady = false;
      state.isInitializing = false;

      if (state.retryCount >= MAX_RETRIES) {
        console.log(
          `[${new Date().toLocaleTimeString()}] 🛑 [${number}] Max retries reached.`
        );
        return;
      }

      const delay =
        BASE_RETRY_DELAY * 2 ** state.retryCount + Math.random() * 1000;
      state.retryCount++;

      console.log(
        `[${new Date().toLocaleTimeString()}] 🔁 [${number}] Retrying in ${(
          delay / 1000
        ).toFixed(2)}s...`
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
          console.log(
            `[${new Date().toLocaleTimeString()}] ⚠️ [${number}] Message missing 'from' or 'body'.`
          );
          return;
        }

        let from = _from;

        if (_from.includes("@lid")) {
          const contact = await message.getContact(); // resolves @lid → contact
          from = contact.id?._serialized;
        }

        console.log(
          `[${new Date().toLocaleTimeString()}] 📨 [${number}] Incoming message from: ${from} — "${body}"`
        );
        console.log(
          `[${new Date().toLocaleTimeString()}] 🎯 [${number}] Expected chatId: ${chatId}`
        );

        if (from !== chatId) {
          console.log(
            `[${new Date().toLocaleTimeString()}] ⛔ [${number}] Message ignored — not from expected chatId.`
          );
          return;
        }

        const { isAcceptance, isSuperAcceptance, isCancellation, isRejection } =
          validateReplyText(body);

        if (!isAcceptance && !isCancellation && !isRejection) {
          await message.reply(
            `⚠️ Please select a patient card and reply with:\n${createConfirmationMessage()}`
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
          console.log(
            `[${new Date().toLocaleTimeString()}] ❌ [${number}] No referral ID in quoted message:\n${
              quotedMsg.body
            }`
          );
          await quotedMsg.reply(
            `❌ Invalid patient message — No *Referral ID* in quoted message.`
          );
          return;
        }

        const scheduledAt = Date.now();
        const validation = !isAcceptance
          ? { success: true }
          : patientsStore.canStillProcessPatient(referralId);

        if (!validation.success) {
          await quotedMsg.reply(validation.message);
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

        console.log(
          `[${new Date().toLocaleTimeString()}] 📩 [${number}] Patient update result: ${prefix} ${replyMessage}`
        );
      } catch (err) {
        console.log(
          `[${new Date().toLocaleTimeString()}] ❌ [${number}] Error handling incoming message:`,
          err
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
    console.log(
      `[${new Date().toLocaleTimeString()}] ❌ [${number}] Failed to send message or files:`,
      err
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
      console.log(
        `[${new Date().toLocaleTimeString()}] 📥 [${phoneNo}] Client not ready — queuing messages`
      );
      console.log(`.`);
      state.queue.push(...safeMessages);
    } else {
      for (const msg of safeMessages) {
        try {
          await sendMessageWithFiles(phoneNo, msg);
        } catch (err) {
          console.log(
            `[${new Date().toLocaleTimeString()}] ❌ [${phoneNo}] Failed to send message:`,
            err
          );
        }
      }
    }
  };

export default sendMessageUsingWhatsapp;
