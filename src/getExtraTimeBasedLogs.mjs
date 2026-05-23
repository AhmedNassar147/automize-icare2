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

const getLastTwoCasesAreDangerous = (logsData, referralEndTimestamp, diff) => {
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
      diffBetweenLastAndCurrent: 0,
    };
  }

  const todayDate = new Date().getDate();

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

  const lastToday = todayCases[todayCases.length - 1];
  const secondLastToday = todayCases[todayCases.length - 2];

  const diffFromLastToday = lastToday?.referralEndTimestamp
    ? referralEndTimestamp - lastToday.referralEndTimestamp
    : 0;

  const isFarFromLastToday =
    diffFromLastToday >= FAR_CASE_MS && lastCaseDate === todayDate;

  const isDangerZoneFiredToday = todayCases.some(({ diff: d }, i, arr) => {
    if (d >= 0) return false;
    const prev = arr[i - 1];
    return !!prev && prev.diff >= 0; // any 0→-1000 today
  });

  // scenario 1: 0 → -1000 same day
  const isFirstDayRecovery =
    isLastPositive && !isSecondLastPositive && isCurrentDiffNegative;

  const recentCases = todayCases.filter(
    ({ referralEndTimestamp: e }) => referralEndTimestamp - e <= FAR_CASE_MS,
  );

  const superSingleAlreadyFired = hasNegativeZeroNegativePattern(recentCases);

  // scenario 2: -1000 → 0 → -1000 same day
  const isSuperSinglePattern =
    !superSingleAlreadyFired &&
    isCurrentDiffNegative &&
    !!lastToday &&
    lastToday.diff >= 0 &&
    !!secondLastToday &&
    secondLastToday.diff < 0;

  const isRecoveryThenDrop = isFirstDayRecovery || isSuperSinglePattern;

  return {
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastCaseDate,
    lastDiff: lastCaseDiff,
    lastReferralEndTimestamp,
    isCurrentDiffNegative,
    isDangerZoneFiredToday,
    superSingleAlreadyFired,
    isFarFromLastToday,
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

  const {
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastCaseDate,
    lastDiff,
    lastReferralEndTimestamp,
    isCurrentDiffNegative,
    isDangerZoneFiredToday,
    isFarFromLastToday,
  } = getLastTwoCasesAreDangerous(logsData, referralEndTimestamp, diff);

  const diffBetweenLastAndCurrent = lastReferralEndTimestamp
    ? referralEndTimestamp - lastReferralEndTimestamp
    : 0;

  const isFarFromLast = diffBetweenLastAndCurrent >= FAR_CASE_MS;

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
    const dangerWait = !isDangerZoneFiredToday || isFarFromLastToday ? 10 : 7;

    extraWait += dangerWait;
    extraBotMessages.push(
      isDoubleZeroDangerZone
        ? `❗️ Double zero danger zone (${diff}ms) → +${extraWait}ms referralId=${referralId}`
        : `⚠️ Recovery then drop (danger zone) (${diff}ms) → +${extraWait}ms referralId=${referralId}`,
    );
    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  const isHotCluster = diffBetweenLastAndCurrent <= 4 * 60 * 1000;

  const isLastDiffNegative = typeof lastDiff === "number" && lastDiff < 0;

  if (isCurrentDiffNegative) {
    const maxNewWait = (Math.abs(diff) / 1000) * 2 + (IS_UNIZA_BRANCH ? 3 : 2);

    if (isLastDiffNegative) {
      extraWait += isFarFromLast
        ? maxNewWait
        : isHotCluster
          ? Math.ceil(maxNewWait / 3)
          : Math.ceil(maxNewWait / 2);
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
    const value = isHotCluster ? 1 : isLastDiffNegative ? 3 : 2;

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
