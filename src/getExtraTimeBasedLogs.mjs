/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const HOT_CLUSTER_MS = 4 * 60 * 1000;

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

  const logCtx = `referralId=${referralId} diffPath=${lastDiff ?? "none"}→${diff}`;

  if (extraBackendDelayMs === 0) {
    extraBotMessages.push(`✅ backend-delay ${logCtx} delay=0ms wait=+0ms`);
  }

  if (extraBackendDelayMs > 1000) {
    extraWait += 3;
    extraBotMessages.push(
      `✅ backend-delay ${logCtx} delay=${extraBackendDelayMs}ms threshold=1000ms wait=+3ms`,
    );
  }

  if (isDoubleZeroDangerZone || isRecoveryThenDrop) {
    const isUsingFullWait = !isDangerZoneFiredToday || isFarFromLastToday;
    const dangerWait = isUsingFullWait ? 10 : 8;

    extraWait += dangerWait;
    extraBotMessages.push(
      `⚠️ danger-zone ${logCtx} type=${isDoubleZeroDangerZone ? "double-zero" : "recovery-drop"} fullWait=${isUsingFullWait} wait=+${dangerWait}ms`,
    );
    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  const isHotCluster = diffBetweenLastAndCurrent <= HOT_CLUSTER_MS;

  const isLastDiffNegative = typeof lastDiff === "number" && lastDiff < 0;

  const gapMin = (diffBetweenLastAndCurrent / 60000).toFixed(1);

  if (isCurrentDiffNegative) {
    const maxNewWait = (Math.abs(diff) / 1000) * 2 + (IS_UNIZA_BRANCH ? 3 : 2);

    if (isLastDiffNegative) {
      const waitValue = isFarFromLast
        ? maxNewWait
        : isHotCluster
          ? Math.ceil(maxNewWait / 3)
          : Math.ceil(maxNewWait / 2);

      extraWait += waitValue;
      extraBotMessages.push(
        isFarFromLast
          ? `↔️ far-negative ${logCtx} gap=${gapMin}min wait=+${waitValue}ms`
          : `🔁 consecutive-negative ${logCtx} hotCluster=${isHotCluster} gap=${gapMin}min wait=+${waitValue}ms`,
      );
    } else {
      extraWait += maxNewWait;
      extraBotMessages.push(
        `✅ first-negative ${logCtx} wait=+${maxNewWait}ms`,
      );
    }
  }

  if (diff >= 0) {
    const value = isHotCluster
      ? 1
      : isLastDiffNegative
        ? isFarFromLast
          ? 3
          : 2
        : 2;

    const addedWait = isFarFromLast
      ? IS_UNIZA_BRANCH
        ? Math.ceil(value * 1.5)
        : Math.ceil(value * 1.5)
      : value;

    extraWait += addedWait;
    extraBotMessages.push(
      isFarFromLast
        ? `↔️ far-stable ${logCtx} gap=${gapMin}min wait=+${addedWait}ms`
        : `✅ stable ${logCtx} hotCluster=${isHotCluster} gap=${gapMin}min wait=+${addedWait}ms`,
    );
  }

  return {
    computedExtraBotMessages: extraBotMessages,
    computedExtraWait: extraWait,
  };
};

export default getExtraTimeBasedLogs;
