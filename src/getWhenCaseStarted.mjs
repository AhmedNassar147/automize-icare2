/*
 *
 * Helper: `getWhenCaseStarted`.
 *
 */
import {
  EFFECTIVE_REVIEW_DURATION_MS,
  estimatedTimeForProcessingAction,
} from "./constants.mjs";

const formatMsToMinutesSeconds = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
};

const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const getTimingData = (baseTimeMS, caseActualLeftMs) => {
  const elapsedMs = EFFECTIVE_REVIEW_DURATION_MS - caseActualLeftMs;

  const caseStartedAtMS = baseTimeMS - elapsedMs;
  const caseStartedAt = new Date(caseStartedAtMS).toLocaleString();

  const caseActualWillBeSubmittedAtMS = caseStartedAtMS + caseActualLeftMs;

  const caseActualWillBeSubmittedAt = new Date(
    caseActualWillBeSubmittedAtMS
  ).toLocaleString();

  return {
    caseStartedAtMS,
    caseStartedAt,
    caseActualWillBeSubmittedAtMS,
    caseActualWillBeSubmittedAt,
  };
};

const getWhenCaseStarted = (
  baseTimeMS,
  message,
  useDefaultMessageIfNotFound
) => {
  if (!message && !useDefaultMessageIfNotFound) {
    return {
      caseActualLeftMs: 0,
    };
  }

  let hasApiMessageFound = !!message;

  if (useDefaultMessageIfNotFound && !message) {
    message = "There is 14 minute(s) and 42 second(s) remaining.";
  }

  const match = (message || "").match(
    /(\d+)\s+minute\(s\)\s+and\s+(\d+)\s+second\(s\)/
  );

  const minsLeft = parseInt(match?.[1], 10) ?? 0;
  const secsLeft = parseInt(match?.[2], 10) ?? 0;

  const caseActualLeftMs = (minsLeft * 60 + secsLeft) * 1000;

  const {
    caseActualWillBeSubmittedAt,
    caseActualWillBeSubmittedAtMS,
    caseStartedAt,
    caseStartedAtMS,
  } = getTimingData(baseTimeMS, caseActualLeftMs);

  let caseUserStartedAtMS = caseStartedAtMS;
  let caseUserStartedAt = caseStartedAt;
  let caseUserLeftMs = caseActualLeftMs;
  let caseUserWillBeSubmittedAtMS = caseActualWillBeSubmittedAtMS;
  let caseUserWillBeSubmittedAt = caseActualWillBeSubmittedAt;

  if (caseActualLeftMs > estimatedTimeForProcessingAction) {
    caseUserLeftMs = caseActualLeftMs - estimatedTimeForProcessingAction;

    const {
      caseActualWillBeSubmittedAt,
      caseActualWillBeSubmittedAtMS,
      caseStartedAt,
      caseStartedAtMS,
    } = getTimingData(
      baseTimeMS + estimatedTimeForProcessingAction,
      caseUserLeftMs
    );

    caseUserStartedAtMS = caseStartedAtMS;
    caseUserStartedAt = caseStartedAt;
    caseUserWillBeSubmittedAtMS = caseActualWillBeSubmittedAtMS;
    caseUserWillBeSubmittedAt = caseActualWillBeSubmittedAt;
  }

  const { minutes: reviewMinutes, seconds: reviewSeconds } =
    formatMsToMinutesSeconds(caseUserLeftMs);

  const caseUserAlertMessage = `You have ${pluralize(
    reviewMinutes,
    "minute"
  )} and ${pluralize(reviewSeconds, "second")} to review.`;

  return {
    caseStartedAtMS,
    caseStartedAt,
    caseActualLeftMs,
    caseActualWillBeSubmittedAt,
    caseActualWillBeSubmittedAtMS,
    caseAlertMessage: message,
    caseUserAlertMessage,
    hasApiMessageFound,
    caseUserStartedAtMS,
    caseUserStartedAt,
    caseUserLeftMs,
    caseUserWillBeSubmittedAtMS,
    caseUserWillBeSubmittedAt,
  };
};

export default getWhenCaseStarted;

// // const caseLeftTimeInMins = parseFloat(
// //   (caseActualLeftMs / 1000 / 60).toFixed(1)
// // );

// // const wastedTimeInMins = parseFloat((elapsedMs / 1000 / 60).toFixed(1));

// console.log(
//   getWhenCaseStarted(
//     Date.now(),
//     "A waiting period of 15 minutes shall pass before an action can be performed. There is 12 minute(s) and 42 second(s) remaining."
//   )
// );

// // console.log(getWhenCaseStarted(Date.now(), "", true));
