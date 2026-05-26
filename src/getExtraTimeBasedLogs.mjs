/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const HOT_CLUSTER_MS = 4 * 60 * 1000;

const getRttExtraWait = (rtt) => {
  if (!Number.isFinite(rtt)) return 0;

  if (rtt >= 1000) return +6;
  if (rtt >= 500) return +4;
  if (rtt >= 150) return +2;
  if (rtt >= 98) return +1;

  // extremely responsive session
  if (rtt <= 60) return -1;

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

const isSameDay = (ts, currentDayKey) =>
  ts && new Date(ts).toISOString().slice(0, 10) === currentDayKey;

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
    };
  }

  const currentDayKey = new Date(referralEndTimestamp)
    .toISOString()
    .slice(0, 10);

  // today's cases for pattern detection
  const todayCases = logsData.filter(({ referralEndTimestamp: e }) =>
    isSameDay(e, currentDayKey),
  );

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
  };
};

const getExtraTimeBasedLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
  rtt,
}) => {
  const IS_UNIZA_BRANCH = process.env.BRANCH_NAME === "Unizah";
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
    extraBotMessages.push(`✅ backend-delay ${logCtx} delay=0ms wait=+0ms`);
  }

  if (extraBackendDelayMs > 1000) {
    extraWait += 3;
    extraBotMessages.push(
      `✅ backend-delay ${logCtx} delay=${extraBackendDelayMs}ms threshold=1000ms wait=+2ms`,
    );
  }

  if (isDoubleZeroDangerZone || isRecoveryThenDrop) {
    const isUsingFullWait =
      isDoubleZeroDangerZone || !isDangerZoneFiredToday || isFarFromLastToday;
    const dangerWait = isUsingFullWait ? 10 : 6;

    extraWait += dangerWait;
    extraBotMessages.push(
      `⚠️ danger-zone ${logCtx} type=${isDoubleZeroDangerZone ? "double-zero" : "recovery-drop"} gap=${gapMin}min fullWait=${isUsingFullWait} wait=+${dangerWait}ms`,
    );
    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  if (isCurrentDiffNegative) {
    const maxNewWait =
      (Math.abs(diff) / 1000) * 2 +
      (IS_UNIZA_BRANCH ? 3 : isFirstCaseToday || isFarFromLastToday ? 2 : 1);

    if (isLastTodayDiffNegative) {
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
    } else {
      extraWait += maxNewWait;
      const negativeText = isFirstCaseToday
        ? "🌅 first-day-negative"
        : "✅ first-negative";
      extraBotMessages.push(`${negativeText} ${logCtx} wait=+${maxNewWait}ms`);
    }

    const consecutiveNegativeCountToday = getConsecutiveNegativeCountToday(
      todayCases,
      isCurrentDiffNegative,
    );

    if (
      isLastTodayDiffNegative &&
      consecutiveNegativeCountToday >= 3 &&
      !isHotCluster
    ) {
      const value = isFarFromLastToday ? 3 : 2;
      extraWait += value;

      extraBotMessages.push(
        `🔥 negative-chain ${logCtx} count=${consecutiveNegativeCountToday} hotCluster=${isHotCluster} far=${isFarFromLastToday} boost=+${value}ms`,
      );
    }
  }

  const isLastNegativeButFarToday =
    isLastTodayDiffNegative && isFarFromLastToday;

  const STABLE_WAITS = {
    suspiciousCase: 4,
    hotCluster: 1,
    far: 3,
    default: 2,
  };

  const isSuspiciousCase = isFirstCaseToday || isLastNegativeButFarToday;

  if (diff >= 0) {
    const value = isSuspiciousCase
      ? STABLE_WAITS.suspiciousCase
      : isHotCluster
        ? STABLE_WAITS.hotCluster
        : isFarFromLastToday
          ? STABLE_WAITS.far
          : STABLE_WAITS.default;

    extraWait += value;

    const farText = isFirstCaseToday
      ? "🌅 first-day-stable"
      : isLastNegativeButFarToday
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
