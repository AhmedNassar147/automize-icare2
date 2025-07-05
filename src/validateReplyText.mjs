/*
 *
 * Helper: `validateReplyText`.
 *
 */
import { CONFIRMATION_TYPES } from "./constants.mjs";

const validateReplyText = (text) => {
  const lower = (text || "").toLowerCase().trim();

  if (CONFIRMATION_TYPES.ACCEPT.includes(lower)) {
    return {
      isAcceptance: true,
    };
  }

  if (CONFIRMATION_TYPES.CANCEL.includes(lower)) {
    return {
      isCancellation: true,
    };
  }

  if (CONFIRMATION_TYPES.REJECT.includes(lower)) {
    return {
      isRejection: true,
    };
  }

  return {};
};

export default validateReplyText;
