/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const hasNegativeZeroNegativePattern = (todayCases) => {
  for (let i = 2; i < todayCases.length; i++) {
    if (
      todayCases[i - 2].diff < 0 &&
      todayCases[i - 1].diff >= 0 &&
      todayCases[i].diff < 0
    ) {
      return true;
    }
  }
  return false;
};

const getLastTwoCasesAreDangrous = (logsData, diff, todayDate) => {
  const length = logsData?.length ?? 0;
  const isCurrentDiffNegative = diff < 0;

  if (!length) {
    return {
      isDoubleZeroDangerZone: false,
      isRecoveryThenDrop: false,
      lastCaseDate: null,
      lastDiff: undefined,
      lastReferralEndTimestamp: null,
      isCurrentDiffNegative,
    };
  }

  const last = logsData[length - 1];
  const secondLast = length >= 2 ? logsData[length - 2] : null;

  const lastReferralEndTimestamp = last.referralEndTimestamp;

  const lastCaseDate = new Date(lastReferralEndTimestamp).getDate();

  const secondLastDate = secondLast
    ? new Date(secondLast.referralEndTimestamp).getDate()
    : null;

  const lastCaseDiff = last?.diff;

  const isLastPositive = lastCaseDiff >= 0 && lastCaseDate === todayDate;
  const isSecondLastPositive =
    !!secondLast && secondLast.diff >= 0 && secondLastDate === todayDate;

  // 0 → 0 → -1000
  const isDoubleZeroDangerZone =
    isLastPositive && isSecondLastPositive && isCurrentDiffNegative;

  // today's cases for pattern detection
  const todayCases = logsData.filter(
    ({ referralEndTimestamp: e }) => e && new Date(e).getDate() === todayDate,
  );

  const superSingleAlreadyFired = hasNegativeZeroNegativePattern(todayCases);

  const lastToday = todayCases[todayCases.length - 1];
  const secondLastToday = todayCases[todayCases.length - 2];

  // scenario 1: first day recovery → first case of day is 0, then -1000
  const isFirstDayRecovery =
    isLastPositive && !isSecondLastPositive && isCurrentDiffNegative;

  // scenario 2: -1000 → 0 → -1000 same day
  const isSuperSinglePattern =
    !superSingleAlreadyFired &&
    isCurrentDiffNegative &&
    !!lastToday &&
    lastToday.diff >= 0 &&
    !!secondLastToday &&
    secondLastToday.diff < 0;

  const isRecoveryThenDrop =
    (isFirstDayRecovery || isSuperSinglePattern) && !superSingleAlreadyFired;

  return {
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastCaseDate,
    lastDiff: lastCaseDiff,
    lastReferralEndTimestamp,
    isCurrentDiffNegative,
  };
};

const getExtraTimeBasedLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
}) => {
  const IS_UNIZA_BRANCH = process.env.BRANCH_NAME === "Unizah";
  const extraBotMessages = [];
  const logsData = await readLogsAsArray();
  const todayDate = new Date().getDate();

  const {
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastCaseDate,
    lastDiff,
    lastReferralEndTimestamp,
    isCurrentDiffNegative,
  } = getLastTwoCasesAreDangrous(logsData, diff, todayDate);

  let extraWait = 0;

  if (extraBackendDelayMs === 0) {
    extraBotMessages.push(
      `✅ Found no backend delay → +0ms when diff=${diff} referralId=${referralId}`,
    );
  }

  if (extraBackendDelayMs > 1000) {
    extraWait += 3;
    extraBotMessages.push(
      `✅ Found backend delay → +${extraBackendDelayMs}ms > 1000ms when diff=${diff} referralId=${referralId}`,
    );
  }

  if (isDoubleZeroDangerZone || isRecoveryThenDrop) {
    extraWait += 10;
    extraBotMessages.push(
      isDoubleZeroDangerZone
        ? `❗️ Double zero danger zone (${diff}ms) → +${extraWait}ms referralId=${referralId}`
        : `⚠️ Recovery then drop (${diff}ms) → +${extraWait}ms referralId=${referralId}`,
    );
    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  const diffBetweenLastAndCurrent = lastReferralEndTimestamp
    ? referralEndTimestamp - lastReferralEndTimestamp
    : 0;

  const isFarFromLast = diffBetweenLastAndCurrent >= FAR_CASE_MS;
  const isLastDiffNegative = typeof lastDiff === "number" && lastDiff < 0;

  if (isCurrentDiffNegative) {
    const maxNewWait = (Math.abs(diff) / 1000) * 2 + (IS_UNIZA_BRANCH ? 3 : 2);

    if (isLastDiffNegative) {
      extraWait += isFarFromLast ? maxNewWait : Math.ceil(maxNewWait / 2);
      extraBotMessages.push(
        isFarFromLast
          ? `↔️ Far + consecutive diff (${lastDiff}→${diff}) → +${extraWait}ms`
          : `🔁 Consecutive diff (${lastDiff}→${diff}) → +${extraWait}ms`,
      );
    } else {
      extraWait += maxNewWait;
      extraBotMessages.push(
        `✅ First case / no danger zone, diff=${diff} (last ${lastDiff ?? "none"}) → +${extraWait}ms`,
      );
    }
  }

  if (diff >= 0) {
    const value = isLastDiffNegative ? 3 : 2;

    extraWait += isFarFromLast
      ? IS_UNIZA_BRANCH
        ? Math.ceil(value * 1.5)
        : Math.floor(value * 1.5)
      : value;

    extraBotMessages.push(
      isFarFromLast
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
