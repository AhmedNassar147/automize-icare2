/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const isDangrouseHours = (h) => h >= 10 && h <= 21;

const getExtraTimeBasedLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
}) => {
  const IS_UNIZA_BRANCH = process.env.BRANCH_NAME === "Unizah";

  const extraBotMessages = [];

  const logsData = await readLogsAsArray();

  let lastReferralLog = logsData?.[logsData.length - 1] || {};

  const { diff: lastDiff, referralEndTimestamp: lastReferralEndTimestamp } =
    lastReferralLog || {};

  const diffBetweenLastAndCurrent = lastReferralEndTimestamp
    ? referralEndTimestamp - lastReferralEndTimestamp
    : 0;

  const lastCaseDate = lastReferralEndTimestamp
    ? new Date(lastReferralEndTimestamp).getDate()
    : null;

  const todayDate = new Date().getDate();

  const isFarFromLastCase =
    diffBetweenLastAndCurrent >= FAR_CASE_MS && lastCaseDate === todayDate;

  const hours = new Date().getHours(); // Saudi server local time

  const lastCaseHour = lastReferralEndTimestamp
    ? new Date(lastReferralEndTimestamp).getHours()
    : null;

  const isDangrousTransitionAlreadyDone = logsData.some(
    ({ referralEndTimestamp: e, diff }) => {
      if (!e || diff >= 0) return false;
      const h = new Date(e).getHours();
      const d = new Date(e).getDate();
      return d === todayDate && isDangrouseHours(h);
    },
  );

  const isDangerousTransition =
    isDangrouseHours(hours) && // in 10-21h
    !isDangrousTransitionAlreadyDone;

  let extraWait = 0;

  if (diff < 0) {
    const maxNewWait = (Math.abs(diff) / 1000) * 2 + (IS_UNIZA_BRANCH ? 2 : 1);

    if (typeof lastDiff === "number" && lastDiff < 0) {
      extraWait = isFarFromLastCase ? maxNewWait : Math.ceil(maxNewWait / 2);
      extraBotMessages.push(
        isFarFromLastCase
          ? `↔️ Far + consecutive diff (${lastDiff}→${diff}) → +${extraWait}ms`
          : `🔁 Consecutive diff (${lastDiff}→${diff}) → +${extraWait}ms`,
      );
    } else if (isDangerousTransition) {
      extraWait = 10;
      extraBotMessages.push(
        `⚠️ First dangerous hours (prev ${lastCaseHour}:xx → now 13-16h) + diff ${diff} → +${extraWait}ms`,
      );
    } else {
      extraWait = isFarFromLastCase ? Math.ceil(maxNewWait * 1.5) : maxNewWait;
      extraBotMessages.push(
        `📉 diff transition (${lastDiff ?? "none"}→${diff}) → +${extraWait}ms`,
      );
    }
  }

  if (diff >= 0) {
    const value = (lastDiff < 0 ? 2 : 3) + (IS_UNIZA_BRANCH ? 2 : 0);
    extraWait = isFarFromLastCase ? Math.ceil(value * 2) : value;
    extraBotMessages.push(
      isFarFromLastCase
        ? `↔️ Far case (${Math.round(diffBetweenLastAndCurrent / 60000)}min gap) + diff ${diff} → +${extraWait}ms`
        : `✅ diff ${diff} (last ${lastDiff ?? "none"}) → +${extraWait}ms`,
    );
  }

  if (extraBackendDelayMs === 0) {
    extraBotMessages.push(
      `✅ Found no backend delay  → +${extraBackendDelayMs}ms when diff=${diff} and referralId=${referralId}`,
    );
  }

  if (extraBackendDelayMs > 1000) {
    extraWait += 4;
    extraBotMessages.push(
      `✅ Found backend delay  → +${extraBackendDelayMs}ms > 1000ms when diff=${diff} and referralId=${referralId}`,
    );
  }

  return {
    computedExtraBotMessages: extraBotMessages,
    computedExtraWait: extraWait,
  };
};

export default getExtraTimeBasedLogs;
