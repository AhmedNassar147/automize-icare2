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
        console.log(`✅ [${number}] Client successfully destroyed.`);
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
    await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for ongoing lock
  }
  initializationLocks.set(key, true);
  try {
    return await fn();
  } finally {
    initializationLocks.delete(key);
  }
};

const initializeClient = async (
  number,
  patientsStore,
  { headless = false } = {}
) =>
  withLock(number, async () => {
    const chatId = getChatId(number);

    if (clients.has(number)) {
      const { isReady, isInitializing } = clients.get(number);
      if (isReady || isInitializing) {
        console.log(
          `ℹ️ [${number}] Initialization skipped — already in progress or ready.`
        );
        return;
      }
    }

    const authId = `client-${number}`;

    const client = new Client({
      authStrategy: new LocalAuth({ clientId: authId }),
      puppeteer: { headless },
    });

    if (clients.has(number)) {
      try {
        await clients.get(number).client.destroy();
        console.log(
          `🔄 [${number}] Destroyed existing client before reinitialization.`
        );
      } catch (err) {
        console.error(`❌ [${number}] Failed to destroy existing client:`, err);
      }
    }

    const state = {
      client,
      isReady: false,
      isInitializing: true,
      retryCount: 0,
      queue: [],
    };

    clients.set(number, state);

    client.on("qr", (qr) => {
      console.log(`📱 [${number}] Scan this QR code to authenticate:`);
      qrcode.generate(qr, { small: true });
    });

    client.once("ready", async () => {
      console.log(`✅ [${number}] WhatsApp client is ready.`);
      state.isReady = true;
      state.isInitializing = false;
      state.retryCount = 0;

      if (state.queue.length > 0) {
        console.log(
          `📤 [${number}] Sending ${state.queue.length} queued message(s)...`
        );
        const sendPromises = state.queue.map((msg) =>
          sendMessageWithFiles(number, msg)
        );
        await Promise.all(sendPromises);
        state.queue = [];
      }
    });

    client.on("auth_failure", (msg) => {
      console.error(`❌ [${number}] Authentication failed: ${msg}`);
      state.isReady = false;
      state.isInitializing = false;
    });

    client.on("disconnected", () => {
      console.warn(`⚠️ [${number}] Client disconnected.`);

      state.isReady = false;
      state.isInitializing = false;

      if (state.retryCount >= MAX_RETRIES) {
        console.error(
          `🚫 [${number}] Max retries reached. Aborting reconnection.`
        );
        return;
      }

      const jitter = Math.random() * 1000;
      const retryDelay =
        BASE_RETRY_DELAY * Math.pow(2, state.retryCount) + jitter;
      state.retryCount++;

      console.log(
        `🔁 [${number}] Retrying connection in ${(retryDelay / 1000).toFixed(
          2
        )}s...`
      );

      setTimeout(() => {
        console.log(`🌀 [${number}] Re-initializing client...`);
        initializeClient(number, patientsStore, { headless });
      }, retryDelay);
    });

    client.on("message", async (message) => {
      try {
        const { from, body } = message || {};

        if (from !== chatId) return;

        const { isAcceptance, isCancellation, isRejection } =
          validateReplyText(body);

        console.log(`📩 [${number}] Replied with message: "${body}"`);

        if (!isAcceptance && !isCancellation && !isRejection) {
          const confirmationMessage = createConfirmationMessage();

          await message.reply(
            `⚠️ Please select patient card and reply with:\n${confirmationMessage}`
          );
          return;
        }

        if (!message.hasQuotedMsg) {
          const confirmationMessage = createConfirmationMessage();

          await message.reply(
            `⚠️ Please select a patient card and reply with:\n${confirmationMessage}.`
          );
          return;
        }

        const quotedMsg = await message.getQuotedMessage();
        const referralId = extractReferralId(quotedMsg.body);

        if (!referralId) {
          console.warn(
            `❌ [${number}] Invalid quoted message (no Referral ID):\n${quotedMsg.body}`
          );
          await quotedMsg.reply(
            `❌ Couldn't extract Referral ID. Please reply to a valid patient message.`
          );
          return;
        }

        const scheduledAt = Date.now();

        const { success, message: validationMessage } = isRejection
          ? { success: true }
          : patientsStore.canStillProcessPatient(referralId);

        if (!success) {
          await quotedMsg.reply(validationMessage);
          return;
        }

        let result = {};
        if (isAcceptance) {
          result = await patientsStore.scheduleAcceptedPatient(
            referralId,
            scheduledAt
          );
        } else if (isRejection) {
          result = await patientsStore.scheduleRejectedPatient(
            referralId,
            scheduledAt
          );
        } else if (isCancellation) {
          result = patientsStore.cancelPatient(referralId);
        }

        const { success: processSuccess, message: processMessage } = result;
        const prefix = processSuccess ? "✅" : "❌";
        await quotedMsg.reply(
          `${prefix} ${processMessage} (Referral ID: ${referralId})`
        );
        console.log(
          `📨 [${number}] Action result: ${prefix} ${processMessage}`
        );
      } catch (error) {
        console.error(`❌ [${number}] Error handling message:`, error);
      }
    });

    await client.initialize();
  });

const sendMessageWithFiles = async (number, messageWithFiles) => {
  if (!messageWithFiles) return;

  const { message, files } = messageWithFiles || {};
  const chatId = getChatId(number);
  const clientState = clients.get(number);

  if (!clientState) {
    console.warn(
      `⚠️ [${number}] No active client found while sending message.`
    );
    return;
  }

  const { client } = clientState;

  try {
    await client.sendMessage(chatId, message);
    // console.log(`📤 [${number}] Text message sent: "${message}"`);

    if (Array.isArray(files)) {
      for (const { extension, fileBase64, fileName } of files) {
        try {
          if (
            !fileBase64 ||
            typeof fileBase64 !== "string" ||
            !/^[A-Za-z0-9+/=]+$/.test(fileBase64)
          ) {
            console.warn(`⚠️ [${number}] Skipping invalid base64 file.`);
            continue;
          }

          const cleanBase64 = fileBase64.replace(/^data:.*?base64,/, "").trim();
          const mimeType = getMimeType(extension);

          const safeFileName = `${fileName || "document"}.${
            extension || "bin"
          }`;

          const media = new MessageMedia(mimeType, cleanBase64, safeFileName);
          await client.sendMessage(chatId, media);
          console.log(`📤 [${number}] File sent: ${safeFileName}`);
        } catch (fileErr) {
          console.error(`❌ Failed to send file "${fileName}":`, fileErr);
        }
      }
    }
  } catch (err) {
    console.error(`❌ Failed to send message or file to [${number}]:`, err);
  }
};

const sendMessageUsingWhatsapp =
  (patientsStore, options = {}) =>
  async (number, messages) => {
    const phoneNo = normalizePhoneNumber(number);
    await initializeClient(phoneNo, patientsStore, options);

    const safeMessages = Array.isArray(messages) ? messages : [messages];
    const state = clients.get(phoneNo);

    if (!state.isReady) {
      console.log(
        `⏳ [${phoneNo}] Client not ready, queuing ${safeMessages.length} message(s).`
      );
      state.queue.push(...safeMessages);
    } else {
      await Promise.all(
        safeMessages.map((msg) =>
          sendMessageWithFiles(phoneNo, msg).catch((err) =>
            console.error(`❌ [${phoneNo}] Failed to send queued message:`, err)
          )
        )
      );
    }
  };

export default sendMessageUsingWhatsapp;

// const QuotedMessage = {
//   _data: {
//     id: {
//       fromMe: true,
//       remote: "201029959790@c.us",
//       id: "3EB05D7C6A4120AC3D5F03",
//       _serialized: "true_201029959790@c.us_3EB05D7C6A4120AC3D5F03",
//     },
//     viewed: false,
//     body:
//       "🧾 Patient #3:\n" +
//       "────────────────────────────\n" +
//       "👤 Name: Sultan X Alqahtani\n" +
//       "🌐 Nationality: SAUDI\n" +
//       "🆔 National ID: 1119714010\n" +
//       "🔢 Referral ID: 133167\n" +
//       "🏷️ Referral Type: Emergency\n" +
//       "🧑‍⚕️ Specialty: Neuro Surgery\n" +
//       "🏥 Provider: Asir Central Hospital\n" +
//       "📍 Zone: Asir\n" +
//       "📅 Requested: 2022-06-12 14:38:00.0\n",
//     type: "chat",
//     t: 1748856094,
//     from: {
//       server: "c.us",
//       user: "201024079899",
//       _serialized: "201024079899@c.us",
//     },
//     to: {
//       server: "c.us",
//       user: "201029959790",
//       _serialized: "201029959790@c.us",
//     },
//     ack: 2,
//     isNewMsg: true,
//     star: false,
//     kicNotified: false,
//     isFromTemplate: false,
//     pollInvalidated: false,
//     isSentCagPollCreation: false,
//     latestEditMsgKey: null,
//     latestEditSenderTimestampMs: null,
//     mentionedJidList: [],
//     groupMentions: [],
//     isEventCanceled: false,
//     eventInvalidated: false,
//     isVcardOverMmsDocument: false,
//     isForwarded: false,
//     hasReaction: false,
//     disappearingModeInitiator: "chat",
//     disappearingModeTrigger: "chat_settings",
//     productHeaderImageRejected: false,
//     lastPlaybackProgress: 0,
//     isDynamicReplyButtonsMsg: false,
//     isCarouselCard: false,
//     parentMsgId: null,
//     callSilenceReason: null,
//     isVideoCall: false,
//     callDuration: null,
//     callCreator: null,
//     callParticipants: null,
//     isMdHistoryMsg: false,
//     stickerSentTs: 0,
//     isAvatar: false,
//     lastUpdateFromServerTs: 0,
//     invokedBotWid: null,
//     bizBotType: null,
//     botResponseTargetId: null,
//     botPluginType: null,
//     botPluginReferenceIndex: null,
//     botPluginSearchProvider: null,
//     botPluginSearchUrl: null,
//     botPluginSearchQuery: null,
//     botPluginMaybeParent: false,
//     botReelPluginThumbnailCdnUrl: null,
//     botMessageDisclaimerText: null,
//     botMsgBodyType: null,
//     requiresDirectConnection: false,
//     bizContentPlaceholderType: null,
//     hostedBizEncStateMismatch: false,
//     senderOrRecipientAccountTypeHosted: false,
//     placeholderCreatedWhenAccountIsHosted: false,
//     links: [],
//   },
//   mediaKey: undefined,
//   id: {
//     fromMe: true,
//     remote: "201029959790@c.us",
//     id: "3EB05D7C6A4120AC3D5F03",
//     _serialized: "true_201029959790@c.us_3EB05D7C6A4120AC3D5F03",
//   },
//   ack: 2,
//   hasMedia: false,
//   body:
//     "🧾 Patient #3:\n" +
//     "────────────────────────────\n" +
//     "👤 Name: Sultan X Alqahtani\n" +
//     "🌐 Nationality: SAUDI\n" +
//     "🆔 National ID: 1119714010\n" +
//     "🔢 Referral ID: 133167\n" +
//     "🏷️ Referral Type: Emergency\n" +
//     "🧑‍⚕️ Specialty: Neuro Surgery\n" +
//     "🏥 Provider: Asir Central Hospital\n" +
//     "📍 Zone: Asir\n" +
//     "📅 Requested: 2022-06-12 14:38:00.0\n",
//   type: "chat",
//   timestamp: 1748856094,
//   from: "201024079899@c.us",
//   to: "201029959790@c.us",
//   author: undefined,
//   deviceType: "android",
//   isForwarded: false,
//   forwardingScore: 0,
//   isStatus: false,
//   isStarred: false,
//   broadcast: undefined,
//   fromMe: true,
//   hasQuotedMsg: false,
//   hasReaction: false,
//   duration: undefined,
//   location: undefined,
//   vCards: [],
//   inviteV4: undefined,
//   mentionedIds: [],
//   groupMentions: [],
//   orderId: undefined,
//   token: undefined,
//   isGif: false,
//   isEphemeral: undefined,
//   links: [],
// };
