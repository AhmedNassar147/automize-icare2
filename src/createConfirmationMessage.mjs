/*
 *
 * Helper: `createConfirmationMessage`.
 *
 */
import { CONFIRMATION_TYPES } from "./constants.mjs";

const EMOJIS = {
  SUPPER_ACCEPT: "✅ *Super Acceptence:*",
  ACCEPT: "✅ *Acceptence:*",
  REJECT: "❌ *Rejection:*",
  CANCEL: "↩️ *Cancellation:*",
  SENT_NO_REPLY: "⚠️ *sent with no reply:*",
  RECEIVED_NO_REPLY: "⚠️ *received with no reply:*",
};

const createConfirmationMessage = () =>
  Object.entries(CONFIRMATION_TYPES)
    .map(([key, values]) => {
      const emoji = EMOJIS[key] || "";
      // Format as: emoji *value1* or *value2*
      return `${emoji} _${values[0]}_ or *${values[1]}*`;
    })
    .join("\n");

export default createConfirmationMessage;
