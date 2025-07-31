/*
 *
 * Helper: `validateReplyText`.
 *
 */
import { CONFIRMATION_TYPES } from "./constants.mjs";

// isSuperAcceptance: patient.userActionName === USER_ACTION_TYPES.SUPPER_ACCEPT,

const validateReplyText = (text) => {
  const lower = (text || "").toLowerCase().trim();

  if (CONFIRMATION_TYPES.SUPPER_ACCEPT.includes(lower)) {
    return {
      isAcceptance: true,
      isSuperAcceptance: true,
    };
  }

  if (CONFIRMATION_TYPES.ACCEPT.includes(lower)) {
    return {
      isAcceptance: true,
      isSuperAcceptance: false,
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
