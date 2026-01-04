/*
 *
 * Helper: `validateReplyText`.
 *
 */
import { CONFIRMATION_TYPES, USER_ACTION_TYPES } from "./constants.mjs";

// isSuperAcceptance: patient.userActionName === USER_ACTION_TYPES.SUPPER_ACCEPT,

const validateReplyText = (text) => {
  const lower = (text || "").toLowerCase().trim();

  if (CONFIRMATION_TYPES.SUPPER_ACCEPT.includes(lower)) {
    return {
      isAcceptance: true,
      actionName: USER_ACTION_TYPES.ACCEPT,
      isSuperAcceptance: true,
    };
  }

  if (CONFIRMATION_TYPES.ACCEPT.includes(lower)) {
    return {
      isAcceptance: true,
      actionName: USER_ACTION_TYPES.ACCEPT,
      isSuperAcceptance: false,
    };
  }

  if (CONFIRMATION_TYPES.CANCEL.includes(lower)) {
    return {
      isCancellation: true,
      actionName: "cancelled",
    };
  }

  if (CONFIRMATION_TYPES.REJECT.includes(lower)) {
    return {
      isRejection: true,
      actionName: USER_ACTION_TYPES.REJECT,
    };
  }

  if (CONFIRMATION_TYPES.SENT_NO_REPLY.includes(lower)) {
    return {
      isSentWithoutReply: true,
      actionName: CONFIRMATION_TYPES.SENT_NO_REPLY[0],
    };
  }

  if (CONFIRMATION_TYPES.RECEIVED_NO_REPLY.includes(lower)) {
    return {
      isSentAndReceivedWithoutReply: true,
      actionName: CONFIRMATION_TYPES.RECEIVED_NO_REPLY[0],
    };
  }

  return {};
};

export default validateReplyText;
