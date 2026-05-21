/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const getExtraTimeBasedLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
}) => {
  const extraBotMessages = [];

  const logsData = await readLogsAsArray(referralEndTimestamp);

  let lastReferralLog = logsData?.[logsData.length - 1] || {};

  const { diff: lastDiff, referralEndTimestamp: lastReferralEndTimestamp } =
    lastReferralLog || {};

  const diffBetweenLastAndCurrent = lastReferralEndTimestamp
    ? referralEndTimestamp - lastReferralEndTimestamp
    : 0;

  const isFarFromLastCase = diffBetweenLastAndCurrent >= FAR_CASE_MS;

  const hours = new Date().getHours(); // Saudi server local time

  const isDangerousAfternoon = hours >= 13 && hours < 16;

  const lastCaseHour = lastReferralEndTimestamp
    ? new Date(lastReferralEndTimestamp).getHours()
    : null;

  const lastCaseDate = lastReferralEndTimestamp
    ? new Date(lastReferralEndTimestamp).getDate()
    : null;

  const todayDate = new Date().getDate();

  const afternoonAlreadyStarted = logsData.some(
    ({ referralEndTimestamp: e, diff }) => {
      if (!e || diff >= 0) return false;
      const h = new Date(e).getHours();
      const d = new Date(e).getDate();
      return d === todayDate && h >= 13 && h < 16;
    },
  );

  const isDangerousAfternoonTransition =
    isDangerousAfternoon && // in 13-16h
    !afternoonAlreadyStarted;

  let extraWait = 0;

  if (diff < 0) {
    const maxNewWait = (Math.abs(diff) / 1000) * 2 + 1;

    if (typeof lastDiff === "number" && lastDiff < 0) {
      extraWait = isFarFromLastCase ? maxNewWait : Math.ceil(maxNewWait / 2);
      extraBotMessages.push(
        isFarFromLastCase
          ? `↔️ Far + consecutive diff (${lastDiff}→${diff}) → +${extraWait}ms`
          : `🔁 Consecutive diff (${lastDiff}→${diff}) → +${extraWait}ms`,
      );
    } else if (isDangerousAfternoonTransition) {
      extraWait = 10;
      extraBotMessages.push(
        `⚠️ First dangerous afternoon (prev ${lastCaseHour}:xx → now 13-16h) + diff ${diff} → +${extraWait}ms`,
      );
    } else {
      extraWait = isFarFromLastCase ? maxNewWait * 2 : maxNewWait;
      extraBotMessages.push(
        `📉 diff transition (${lastDiff ?? "none"}→${diff}) → +${extraWait}ms`,
      );
    }
  }

  if (diff >= 0) {
    const value = lastDiff < 0 ? 2 : 3;
    extraWait = isFarFromLastCase ? value * 2 : value;
    extraBotMessages.push(
      isFarFromLastCase
        ? `↔️ Far case (${Math.round(diffBetweenLastAndCurrent / 60000)}min gap) + diff ${diff} → +${extraWait}ms`
        : `✅ diff ${diff} (last ${lastDiff ?? "none"}) → +${extraWait}ms`,
    );
  }

  return {
    computedExtraBotMessages: extraBotMessages,
    computedExtraWait: extraWait,
  };
};

export default getExtraTimeBasedLogs;
