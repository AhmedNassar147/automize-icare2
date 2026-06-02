/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import getOutcomeDelta from "./getOutcomeDelta.mjs";
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const HOT_CLUSTER_MS = 4 * 60 * 1000;

const WAITS_MAP = {
  far: 3,
  default: 2,
  hotCluster: 1,
};

const getRttExtraWait = (rtt) => {
  if (!Number.isFinite(rtt)) return 0;

  if (rtt >= 1000) return +4;
  if (rtt >= 500) return +3;
  if (rtt >= 150) return +2;
  if (rtt >= 95) return +1;

  // extremely responsive session
  if (rtt < 75) return -1;

  return 0;
};

const getConsecutiveNegativeCountToday = (
  todayCases,
  isCurrentDiffNegative,
) => {
  let count = isCurrentDiffNegative ? 1 : 0;

  if (!isCurrentDiffNegative) {
    return 0;
  }

  for (let i = todayCases.length - 1; i >= 0; i--) {
    const item = todayCases[i];

    if (typeof item?.diff !== "number") {
      break;
    }

    if (item.diff < 0) {
      count++;
      continue;
    }

    break;
  }

  return count;
};

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

const getLocalDayKey = (ts) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

const isSameDay = (ts, currentDayKey) =>
  ts && getLocalDayKey(ts) === currentDayKey;

const getTodayCases = (logsData, currentDayKey) => {
  // today's cases for pattern detection
  return logsData.filter(({ referralEndTimestamp: e }) =>
    isSameDay(e, currentDayKey),
  );
};

const getDangerZoneExtraWait = (
  isUsingFullWait,
  previousDelta,
  isFarFromLastToday,
) => {
  const safePreviousDelta = Number.isFinite(previousDelta) ? previousDelta : 0;
  const previousReduction = Math.max(
    0,
    Math.abs(Math.min(safePreviousDelta, 0)),
  );

  // If previous outcome reduced global wait, first danger-zone needs to compensate.
  // Example: low-waiting_601 => delta -1, then 0→-1000 danger-zone should be > +9.
  if (isFarFromLastToday) {
    return 10 + previousReduction;
  }

  return isUsingFullWait ? 8 + previousReduction : 6;
};

const analyzeReferralTimingPatterns = (
  logsData,
  referralEndTimestamp,
  diff,
) => {
  const length = logsData?.length ?? 0;
  const isCurrentDiffNegative = diff < 0;

  if (!length) {
    return {
      isDoubleZeroDangerZone: false,
      isRecoveryThenDrop: false,
      lastDiff: undefined,
      lastReferralEndTimestamp: null,
      isCurrentDiffNegative,
      isDangerZoneFiredToday: false,
      superSingleAlreadyFired: false,
      todayCases: [],
      isLastTodayDiffNegative: false,
      isFarFromLastToday: true,
      diffFromLastToday: 0,
      lastToday: null,
      previousDelta: 0,
    };
  }

  const currentDayKey = getLocalDayKey(referralEndTimestamp);

  const todayCases = getTodayCases(logsData, currentDayKey);

  const lastToday = todayCases[todayCases.length - 1];
  const secondLastToday = todayCases[todayCases.length - 2];

  const diffFromLastToday = lastToday?.referralEndTimestamp
    ? referralEndTimestamp - lastToday.referralEndTimestamp
    : 0;

  const lastTodayDiff = lastToday?.diff;

  const isLastTodayPositive =
    typeof lastTodayDiff === "number" && lastTodayDiff >= 0;

  const isLastTodayDiffNegative =
    typeof lastTodayDiff === "number" && lastTodayDiff < 0;

  const isSecondLastTodayPositive =
    !!secondLastToday && secondLastToday.diff >= 0;

  const isSecondLastTodayNegative =
    typeof secondLastToday?.diff === "number" && secondLastToday.diff < 0;

  const isFarFromLastToday =
    !todayCases.length || diffFromLastToday >= FAR_CASE_MS;

  const isDangerZoneFiredToday = todayCases.some(({ diff: d }, i, arr) => {
    if (d >= 0) return false;
    const prev = arr[i - 1];
    return !!prev && prev.diff >= 0; // any 0→-1000 today
  });

  // scenario 1: 0 → -1000 same day
  // first case in the day is 0 => currentCase (second one in the day) is -1000
  const isFirstDayRecovery =
    isCurrentDiffNegative && isLastTodayPositive && !secondLastToday;

  // scenario 2: 0 → 0 → -1000
  const isDoubleZeroDangerZone =
    isLastTodayPositive && isSecondLastTodayPositive && isCurrentDiffNegative;

  const recentCases = todayCases.filter(
    ({ referralEndTimestamp: e }) => referralEndTimestamp - e <= FAR_CASE_MS,
  );

  const superSingleAlreadyFired = hasNegativeZeroNegativePattern(recentCases);

  // scenario 3: -1000 → 0 → -1000 same day
  const isSuperSinglePattern =
    !superSingleAlreadyFired &&
    isCurrentDiffNegative &&
    isLastTodayPositive &&
    isSecondLastTodayNegative;

  const isRecoveryThenDrop = isFirstDayRecovery || isSuperSinglePattern;

  const previousDelta = getOutcomeDelta(
    lastToday?.outcome,
    lastToday?.outcomeElapsedMs,
  );

  return {
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastDiff: lastTodayDiff,
    isCurrentDiffNegative,
    isDangerZoneFiredToday,
    superSingleAlreadyFired,
    isFarFromLastToday,
    todayCases,
    isLastTodayDiffNegative,
    diffFromLastToday,
    lastToday,
    previousDelta,
  };
};

const getExtraTimeBasedLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
  rtt,
}) => {
  const isUnizahBranch = process.env.BRANCH_NAME === "unizah";
  const isLargeRTT = typeof rtt === "number" && rtt >= 80 && rtt < 95;

  const extraBotMessages = [];
  const logsData = await readLogsAsArray();

  const {
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastDiff,
    isCurrentDiffNegative,
    isDangerZoneFiredToday,
    isFarFromLastToday,
    todayCases,
    isLastTodayDiffNegative,
    diffFromLastToday,
    previousDelta,
  } = analyzeReferralTimingPatterns(logsData, referralEndTimestamp, diff);

  const isFirstCaseToday = !todayCases?.length;

  const isHotCluster = !isFirstCaseToday && diffFromLastToday <= HOT_CLUSTER_MS;

  const gapMin = (diffFromLastToday / 60000).toFixed(1);

  let extraWait = 0;

  const logCtx = `referralId=${referralId} diffPath=${lastDiff ?? "none"}→${diff}`;

  const extraBasedRtt = getRttExtraWait(rtt);
  if (extraBasedRtt) {
    extraWait += extraBasedRtt;
    const sign = extraBasedRtt > 0 ? "+" : "";

    extraBotMessages.push(`✅ rtt ${logCtx} wait=${sign}${extraBasedRtt}ms`);
  }

  if (extraBackendDelayMs === 0) {
    extraWait += -1;
    extraBotMessages.push(`✅ backend-delay ${logCtx} delay=0ms wait=-1ms`);
  }

  if (isDoubleZeroDangerZone || isRecoveryThenDrop) {
    const isUsingFullWait = !isDangerZoneFiredToday;
    const dangerWait = getDangerZoneExtraWait(
      isUsingFullWait,
      previousDelta,
      isFarFromLastToday,
    );

    extraWait += dangerWait;
    extraBotMessages.push(
      `⚠️ danger-zone ${logCtx} type=${
        isDoubleZeroDangerZone ? "double-zero" : "recovery-drop"
      } gap=${gapMin}min fullWait=${isUsingFullWait} previousDelta=${previousDelta} far=${isFarFromLastToday} wait=+${dangerWait}ms`,
    );
    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  if (isCurrentDiffNegative) {
    const waiValue =
      isFirstCaseToday || isFarFromLastToday
        ? WAITS_MAP.far
        : WAITS_MAP.default;

    const maxNewWait = Math.abs(diff) / 1000 + waiValue;

    if (isLastTodayDiffNegative) {
      const consecutiveNegativeCountToday = getConsecutiveNegativeCountToday(
        todayCases,
        isCurrentDiffNegative,
      );

      if (consecutiveNegativeCountToday >= 3 && !isHotCluster) {
        const value = isFarFromLastToday ? maxNewWait : 2;
        extraWait += value;

        extraBotMessages.push(
          `🔥 negative-chain ${logCtx} count=${consecutiveNegativeCountToday} hotCluster=${isHotCluster} far=${isFarFromLastToday} boost=+${value}ms`,
        );
      } else {
        const waitValue = isFarFromLastToday
          ? maxNewWait
          : isHotCluster
            ? Math.ceil(maxNewWait / 3)
            : Math.ceil(maxNewWait / 2);

        extraWait += waitValue;

        extraBotMessages.push(
          isFarFromLastToday
            ? `↔️ far-negative ${logCtx} gap=${gapMin}min wait=+${waitValue}ms`
            : `🔁 consecutive-negative ${logCtx} hotCluster=${isHotCluster} gap=${gapMin}min wait=+${waitValue}ms`,
        );
      }
    } else {
      extraWait += maxNewWait;
      const negativeText = isFirstCaseToday
        ? "🌅 first-day-negative"
        : "✅ first-negative";
      extraBotMessages.push(
        `${negativeText} ${logCtx} gap=${gapMin}min wait=+${maxNewWait}ms`,
      );
    }
  }

  const isFarAndLastNegative = isFarFromLastToday && isLastTodayDiffNegative;

  const isSuspiciousStableCase = isFirstCaseToday;

  // we made isFarAndLastNegative not suspicious based 378358 where we need to decrease 1 and use 3 not 4

  if (diff >= 0) {
    let value = WAITS_MAP.default;

    if (isFirstCaseToday) {
      value = WAITS_MAP.far + (isLargeRTT && isUnizahBranch ? 2 : 0);
    } else if (isFarFromLastToday) {
      value = WAITS_MAP.far;
    } else if (isHotCluster) {
      value = WAITS_MAP.hotCluster;
    }

    extraWait += value;

    const farText = isFirstCaseToday
      ? "🌅 first-day-stable"
      : isFarAndLastNegative
        ? "↔️ far-stable-last-negative"
        : "↔️ far-stable";

    extraBotMessages.push(
      isFarFromLastToday
        ? `${farText} ${logCtx} gap=${gapMin}min wait=+${value}ms`
        : `✅ stable ${logCtx} hotCluster=${isHotCluster} gap=${gapMin}min wait=+${value}ms`,
    );
  }

  return {
    computedExtraBotMessages: extraBotMessages,
    computedExtraWait: extraWait,
  };
};

export default getExtraTimeBasedLogs;
