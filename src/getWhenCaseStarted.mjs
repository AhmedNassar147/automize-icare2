/*
 *
 * Helper: `getWhenCaseStarted`.
 *
 */
import {
  // EFFECTIVE_REVIEW_DURATION_MS,
  estimatedTimeForProcessingAction,
} from "./constants.mjs";

const formatMsToMinutesSeconds = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
};

const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const getDateLocalString = (date) => {
  const dateObject = date instanceof Date ? date : new Date(date);

  return dateObject.toLocaleString("en-SA", {
    timeZone: "Asia/Riyadh",
    dateStyle: "full",
    timeStyle: "medium",
    hour12: false,
  });
};

const getWhenCaseStarted = (
  serverDateHeader,
  message,
  useDefaultMessageIfNotFound
) => {
  if (!message && !useDefaultMessageIfNotFound) {
    return {
      caseActualLeftMs: 0,
      caseAlertMessage: message,
    };
  }

  if (useDefaultMessageIfNotFound && !message) {
    message = "There is 14 minute(s) and 42 second(s) remaining.";
  }

  const date = new Date(serverDateHeader); // Server time (GMT)

  const match = message.match(
    /(\d+)\s*(?:minute(?:\(s\))?|mins?|min)\s+and\s+(\d+)\s*(?:second(?:\(s\))?|secs?|sec)/
  );

  const minsLeft = parseInt(match?.[1], 10) ?? 0;
  const secsLeft = parseInt(match?.[2], 10) ?? 0;

  const leftMs = (minsLeft * 60 + secsLeft) * 1000;

  const willBeSubmittedAt = new Date(date.getTime() + leftMs);

  const caseActualWillBeSubmittedAtMS = willBeSubmittedAt.getTime();
  const caseActualWillBeSubmittedAt = getDateLocalString(willBeSubmittedAt);

  const timeWithUserReaction = estimatedTimeForProcessingAction + 3000;

  let caseUserWillBeSubmittedAtMS = caseActualWillBeSubmittedAtMS;
  let caseUserWillBeSubmittedAt = caseActualWillBeSubmittedAt;
  let caseUserAlertMessage = message;

  if (caseActualWillBeSubmittedAtMS > timeWithUserReaction) {
    caseUserWillBeSubmittedAtMS =
      caseActualWillBeSubmittedAtMS - estimatedTimeForProcessingAction;

    caseUserWillBeSubmittedAt = getDateLocalString(caseUserWillBeSubmittedAtMS);

    const caseUserLeftMs = leftMs - estimatedTimeForProcessingAction;

    const { minutes: reviewMinutes, seconds: reviewSeconds } =
      formatMsToMinutesSeconds(caseUserLeftMs);

    caseUserAlertMessage = `You have ${pluralize(
      reviewMinutes,
      "minute"
    )} and ${pluralize(reviewSeconds, "second")} to review.`;
  }

  return {
    caseReceivedAt: getDateLocalString(date),
    caseAlertMessage: message,
    caseActualWillBeSubmittedAt,
    caseActualWillBeSubmittedAtMS,
    caseUserAlertMessage,
    caseUserWillBeSubmittedAtMS,
    caseUserWillBeSubmittedAt,
  };
};

export default getWhenCaseStarted;

// const getTimingData = (baseTimeMS, caseActualLeftMs) => {
//   // const elapsedMs = EFFECTIVE_REVIEW_DURATION_MS - caseActualLeftMs;

//   // const caseReceivedAtMS = baseTimeMS - elapsedMs;
//   const caseReceivedAt = new Date(baseTimeMS).toLocaleString();

//   const caseActualWillBeSubmittedAtMS = baseTimeMS + caseActualLeftMs;

//   const caseActualWillBeSubmittedAt = new Date(
//     caseActualWillBeSubmittedAtMS
//   ).toLocaleString();

//   return {
//     caseReceivedAtMS: baseTimeMS,
//     caseReceivedAt,
//     caseActualWillBeSubmittedAtMS,
//     caseActualWillBeSubmittedAt,
//   };
// };

// const getWhenCaseStarted = (
//   baseTimeMS,
//   message,
//   useDefaultMessageIfNotFound
// ) => {
//   if (!message && !useDefaultMessageIfNotFound) {
//     return {
//       caseActualLeftMs: 0,
//     };
//   }

//   let hasApiMessageFound = !!message;

//   if (useDefaultMessageIfNotFound && !message) {
//     message = "There is 14 minute(s) and 42 second(s) remaining.";
//   }

//   // const match = (message || "").match(
//   //   /(\d+)\s+minute\(s\)\s+and\s+(\d+)\s+second\(s\)/
//   // );

//   const match = message.match(
//     /(\d+)\s*(?:minute(?:\(s\))?|mins?|min)\s+and\s+(\d+)\s*(?:second(?:\(s\))?|secs?|sec)/
//   );

//   const minsLeft = parseInt(match?.[1], 10) ?? 0;
//   const secsLeft = parseInt(match?.[2], 10) ?? 0;

//   const caseActualLeftMs = (minsLeft * 60 + secsLeft) * 1000;

//   const {
//     caseReceivedAtMS,
//     caseReceivedAt,
//     caseActualWillBeSubmittedAt,
//     caseActualWillBeSubmittedAtMS,
//   } = getTimingData(baseTimeMS, caseActualLeftMs);

//   let caseUserReceivedAtMS = caseReceivedAtMS;
//   let caseUserReceivedAt = caseReceivedAt;
//   let caseUserLeftMs = caseActualLeftMs;
//   let caseUserWillBeSubmittedAtMS = caseActualWillBeSubmittedAtMS;
//   let caseUserWillBeSubmittedAt = caseActualWillBeSubmittedAt;

//   const timeWithUserReaction = estimatedTimeForProcessingAction + 3000;

//   if (caseActualLeftMs > timeWithUserReaction) {
//     caseUserLeftMs = caseActualLeftMs - estimatedTimeForProcessingAction;

//     const {
//       caseActualWillBeSubmittedAt,
//       caseActualWillBeSubmittedAtMS,
//       caseReceivedAt,
//       caseReceivedAtMS,
//     } = getTimingData(baseTimeMS, caseUserLeftMs);

//     caseUserReceivedAtMS = caseReceivedAtMS;
//     caseUserReceivedAt = caseReceivedAt;
//     caseUserWillBeSubmittedAtMS = caseActualWillBeSubmittedAtMS;
//     caseUserWillBeSubmittedAt = caseActualWillBeSubmittedAt;
//   }

//   const { minutes: reviewMinutes, seconds: reviewSeconds } =
//     formatMsToMinutesSeconds(caseUserLeftMs);

//   const caseUserAlertMessage = `You have ${pluralize(
//     reviewMinutes,
//     "minute"
//   )} and ${pluralize(reviewSeconds, "second")} to review.`;

//   return {
//     caseReceivedAtMS,
//     caseReceivedAt,
//     caseActualLeftMs,
//     caseActualWillBeSubmittedAt,
//     caseActualWillBeSubmittedAtMS,
//     caseAlertMessage: message,
//     caseUserAlertMessage,
//     hasApiMessageFound,
//     caseUserReceivedAtMS,
//     caseUserReceivedAt,
//     caseUserLeftMs,
//     caseUserWillBeSubmittedAtMS,
//     caseUserWillBeSubmittedAt,
//   };
// };

// export default getWhenCaseStarted;

// // const caseLeftTimeInMins = parseFloat(
// //   (caseActualLeftMs / 1000 / 60).toFixed(1)
// // );

// // const wastedTimeInMins = parseFloat((elapsedMs / 1000 / 60).toFixed(1));

// const parseDateInSaudiToMs = (datetimeStr) => {
//   // Step 1: Create formatter for "en-SA" locale and get Saudi time zone
//   const saudiTimeZone = 'Asia/Riyadh';

//   // Step 2: Use DateTimeFormat to parse string (you can also do manual parsing)
//   // Since the input is fixed format, we'll parse it directly

//   // Split into parts
//   const [datePart, timePartWithPeriod] = datetimeStr.split(", ");
//   const [month, day, year] = datePart.split("/").map(Number);
//   const [timePart, period] = timePartWithPeriod.split(" ");
//   let [hour, minute, second] = timePart.split(":").map(Number);

//   // Convert 12h to 24h format
//   if (period === "PM" && hour !== 12) hour += 12;
//   if (period === "AM" && hour === 12) hour = 0;

//   // Create a date in the Saudi time zone
//   const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

//   // Convert the UTC date to Saudi local timestamp
//   const saudiTime = new Intl.DateTimeFormat('en-US', {
//     timeZone: saudiTimeZone,
//     hour12: false,
//     year: 'numeric',
//     month: '2-digit',
//     day: '2-digit',
//     hour: '2-digit',
//     minute: '2-digit',
//     second: '2-digit'
//   }).format(date);

//   const [d, t] = saudiTime.split(", ");
//   const [saYear, saMonth, saDay] = d.split("/").reverse().map(Number);
//   const [saHour, saMin, saSec] = t.split(":").map(Number);

//   const finalDate = new Date(saYear, saMonth - 1, saDay, saHour, saMin, saSec);
//   return finalDate.getTime(); // Milliseconds timestamp
// };

// const ms = parseDateInSaudiToMs("7/15/2025, 12:46:43 AM");
// console.log("Milliseconds:", ms);

// console.log(
//   getWhenCaseStarted(
//     parseDateInSaudiToMs("7/15/2025, 12:46:43 AM"),
//     "A waiting period of 15 minutes shall pass before an action can be performed. There is 14 minute(s) and 34 second(s) remaining."
//   )
// );

// // console.log(getWhenCaseStarted(Date.now(), "", true));
