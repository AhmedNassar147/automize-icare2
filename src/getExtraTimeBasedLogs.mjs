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
  isTooFarCase,
) => {
  const safePreviousDelta = Number.isFinite(previousDelta) ? previousDelta : 0;
  const previousReduction = Math.max(0, -safePreviousDelta);

  const extraBoost = isTooFarCase ? (previousReduction ? 1 : 2) : 0;
  const compensation = isUsingFullWait ? previousReduction : 0;

  const extraWait = (isFarFromLastToday ? 10 : 8) + compensation + extraBoost;

  const messages = [];

  if (isTooFarCase) {
    messages.push(`too-far-boost=+${extraBoost}ms`);
  }

  if (compensation > 0) {
    messages.push(`previous-reduction-compensation=+${compensation}ms`);
  }

  return {
    dangerWait: extraWait,
    dangerMessage: messages.join("_AND_"),
  };
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
      lastTodayRTT: 0,
      wasLastTodayDangerous: false,
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

  const previousDelta =
    typeof lastToday?.delta === "number"
      ? lastToday.delta
      : getOutcomeDelta(lastToday?.outcome, lastToday?.outcomeElapsedMs);

  const lastTodayRTT = lastToday?.rtt || 0;

  const messageFromLastToday = lastToday?.extraWaitMessage || "";

  const wasLastTodayDangerous = messageFromLastToday.includes("danger-zone");
  const wasUsingFullWait = messageFromLastToday.includes("fullWait=true");
  const wasFar = messageFromLastToday.includes("far=true");

  const wasLastTodayFarDangerZone =
    wasLastTodayDangerous && wasFar && wasUsingFullWait;

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
    lastTodayRTT,
    wasLastTodayFarDangerZone,
    wasLastTodayDangerous,
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
    lastTodayRTT,
    wasLastTodayFarDangerZone,
    wasLastTodayDangerous,
  } = analyzeReferralTimingPatterns(logsData, referralEndTimestamp, diff);

  const isFirstCaseToday = !todayCases?.length;

  const isHotCluster = !isFirstCaseToday && diffFromLastToday <= HOT_CLUSTER_MS;

  const timeGapHours = diffFromLastToday / (60 * 60 * 1000);

  const gapMin = (diffFromLastToday / 60000).toFixed(1);

  let extraWait = 0;

  const logCtx = `referralId=${referralId} diffPath=${lastDiff ?? "none"}→${diff}`;

  const rawExtraBasedRtt = getRttExtraWait(rtt);

  const shouldIgnorePositiveRtt =
    wasLastTodayFarDangerZone &&
    !isFarFromLastToday &&
    rawExtraBasedRtt > 0 &&
    isCurrentDiffNegative;

  const extraBasedRtt = shouldIgnorePositiveRtt ? 0 : rawExtraBasedRtt;

  const isTooFarCase =
    isFarFromLastToday && timeGapHours >= 5 && extraBasedRtt <= 0;

  if (extraBasedRtt) {
    extraWait += extraBasedRtt;
    const sign = extraBasedRtt > 0 ? "+" : "";

    extraBotMessages.push(`✅ rtt ${logCtx} wait=${sign}${extraBasedRtt}ms`);
  }

  if (shouldIgnorePositiveRtt) {
    extraBotMessages.push(
      `🚫 rtt-ignored-after-far-danger ${logCtx} rtt=${rtt} rawWait=+${rawExtraBasedRtt}ms`,
    );
  }

  if (extraBackendDelayMs === 0) {
    extraWait += -1;
    extraBotMessages.push(`✅ backend-delay ${logCtx} delay=0ms wait=-1ms`);
  }

  if (isDoubleZeroDangerZone || isRecoveryThenDrop) {
    const isUsingFullWait = true;
    // const isUsingFullWait = !isDangerZoneFiredToday;
    const { dangerWait, dangerMessage } = getDangerZoneExtraWait(
      isUsingFullWait,
      previousDelta,
      isFarFromLastToday,
      isTooFarCase,
    );

    extraWait += dangerWait;
    extraBotMessages.push(
      `⚠️ danger-zone ${logCtx} type=${
        isDoubleZeroDangerZone ? "double-zero" : "recovery-drop"
      } gap=${gapMin}min fullWait=${isUsingFullWait} previousDelta=${previousDelta} far=${isFarFromLastToday} wait=+${dangerWait}ms${
        dangerMessage ? `_AND_${dangerMessage}` : ""
      }`,
    );

    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  if (isCurrentDiffNegative) {
    const initialWait =
      isFirstCaseToday || isFarFromLastToday
        ? WAITS_MAP.far
        : WAITS_MAP.default;

    let maxNewWait = Math.abs(diff) / 1000 + initialWait;

    if (isLastTodayDiffNegative) {
      if (isTooFarCase && previousDelta <= 0) {
        const boostValue = wasLastTodayDangerous ? 2 : 3;
        maxNewWait += boostValue;

        extraBotMessages.push(
          `📊 far-negative-long-gap ${logCtx} extraBasedRtt=${extraBasedRtt} hours=${timeGapHours.toFixed(
            1,
          )} previousDelta=${previousDelta} wait=+${boostValue}ms`,
        );
      }

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
            : `🔁 consecutive-negative ${logCtx} hotCluster=${isHotCluster} far=${isFarFromLastToday} gap=${gapMin}min wait=+${waitValue}ms`,
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

  if (diff >= 0) {
    let value = WAITS_MAP.default;

    const extrTime = isUnizahBranch ? (isFirstCaseToday ? 2 : 1) : 0;

    if (isFirstCaseToday || isFarFromLastToday) {
      value = WAITS_MAP.far + extrTime;
    } else if (isHotCluster) {
      value = WAITS_MAP.hotCluster;
    }

    const isStableAfterNegative =
      !isFarFromLastToday &&
      !isHotCluster &&
      isLastTodayDiffNegative &&
      isLargeRTT &&
      rtt > lastTodayRTT;

    if (isStableAfterNegative) {
      value += 1;
    }

    if (!isStableAfterNegative && isTooFarCase && previousDelta <= 0) {
      value += 1;

      extraBotMessages.push(
        `✅ long-gap-boost ${logCtx} extraBasedRtt=${extraBasedRtt} hours=${timeGapHours.toFixed(
          1,
        )} previousDelta=${previousDelta} wait=+1ms`,
      );
    }

    extraWait += value;

    const farText = isFirstCaseToday ? "🌅 first-day-stable" : "↔️ far-stable";

    extraBotMessages.push(
      isFarFromLastToday
        ? `${farText} ${logCtx} gap=${gapMin}min wait=+${value}ms`
        : `✅ stable ${logCtx} hotCluster=${isHotCluster} gap=${gapMin}min wait=+${value}ms`,
    );

    if (isStableAfterNegative) {
      extraBotMessages.push(
        `✅ stable-after-negative-rtt-boost ${logCtx} rtt=${rtt} lastTodayRTT=${lastTodayRTT} gap=${gapMin}min wait=+1ms`,
      );
    }
  }

  return {
    computedExtraBotMessages: extraBotMessages,
    computedExtraWait: extraWait,
  };
};

export default getExtraTimeBasedLogs;
