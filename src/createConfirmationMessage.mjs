/*
 *
 * Helper: `createConfirmationMessage`.
 *
 */
import { CONFIRMATION_TYPES } from "./constants.mjs";

const EMOJIS = {
  ACCEPT: "✅ *Acceptence:*",
  REJECT: "❌ *Rejection:*",
  CANCEL: "↩️ *Cancellation:*",
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
