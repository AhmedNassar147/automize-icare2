/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { OUTCOME_MAP } from "./constants.mjs";
import getOutcomeDelta from "./getOutcomeDelta.mjs";
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60 * 1000;
const ULTRA_HOT_CLUSTER_MS = 30 * 1000;
const HOT_CLUSTER_MS = 3 * 60 * 1000;
const NEAR_CLUSTER_MS = 23 * 60 * 1000;

const WAITS_MAP = {
  hot: 0,
  nearHot: 1,
  medium: 2,
  far: 3,
};

const getRttExtraWait = (rtt) => {
  if (!Number.isFinite(rtt)) return 0;
  // if (rtt >= 150) return +2;
  if (rtt >= 100) return +1;

  // extremely responsive session
  // if (rtt < 75) return -1;

  return 0;
};

const getNegativeCountBeforeCurrent = (todayCases, diff) => {
  let count = diff < 0 ? 1 : 0;

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

const getFirstDayBridgeExtraWait = ({
  referralEndTimestamp,
  hoursGap,
  referralIdGap,
  lastCaseDiff,
  currentDiff,
  extraBasedRtt,
  isFirstCaseToday,
  startZero,
}) => {
  if (
    startZero ||
    !isFirstCaseToday ||
    !Number.isFinite(hoursGap) ||
    !Number.isFinite(currentDiff) ||
    currentDiff >= 0
  ) {
    return {
      bridgeWait: 0,
      bridgeMessage: "",
    };
  }

  const currentHour = new Date(referralEndTimestamp).getHours();

  // Ignore very early first-day cases; allow bridge from 8:00 AM onward.
  if (currentHour < 8) {
    return {
      bridgeWait: 0,
      bridgeMessage: "",
    };
  }

  const lastWasStable = typeof lastCaseDiff === "number" && lastCaseDiff >= 0;
  const rttCompensation = extraBasedRtt > 0 ? extraBasedRtt : 0;

  if (hoursGap >= 12 && referralIdGap >= 30) {
    const value = Math.max(0, (lastWasStable ? 27 : 3) - rttCompensation);

    return {
      bridgeWait: value,
      bridgeMessage:
        `tier=large hour=${currentHour} hours=${hoursGap.toFixed(1)} ` +
        `idGap=${referralIdGap} lastStable=${lastWasStable} ` +
        `rttCompensation=${rttCompensation}`,
    };
  }

  if (hoursGap >= 8 && referralIdGap >= 12) {
    const value = Math.max(0, (lastWasStable ? 17 : 3) - rttCompensation);

    return {
      bridgeWait: value,
      bridgeMessage:
        `tier=medium hour=${currentHour} hours=${hoursGap.toFixed(1)} ` +
        `idGap=${referralIdGap} lastStable=${lastWasStable} ` +
        `rttCompensation=${rttCompensation}`,
    };
  }

  return {
    bridgeWait: 0,
    bridgeMessage: "",
  };
};

const getAfterDangerReduction = (
  previousDelta,
  previousOutcome = "",
  previousElapsed,
) => {
  previousDelta = previousDelta || 0;

  const deltaMagnitude = Math.abs(previousDelta);

  if (
    previousOutcome.includes(OUTCOME_MAP.needLessWait) ||
    previousOutcome.includes(OUTCOME_MAP.lowWaiting) ||
    previousOutcome.includes(OUTCOME_MAP.moderateWaiting)
  ) {
    return deltaMagnitude >= 2 ? 0 : 2 - deltaMagnitude;
  }

  if (previousOutcome.includes(OUTCOME_MAP.goodWaiting)) {
    // this only needs 1 if outcome is good waiting without increasing
    // so if delta increased by 1 we need to reduce by 2 to get to original wait
    return deltaMagnitude > 0 ? 2 : 1;
  }

  if (
    previousOutcome.includes(OUTCOME_MAP.needMoreWait) ||
    previousOutcome.includes(OUTCOME_MAP.nearToBlock)
  ) {
    // theses always sets global wait by postive value
    // and since we need to reduce we need to go to original wait then reduce 2
    return deltaMagnitude + 2;
  }

  return 0;
};

const getDangerZoneExtraWait = (
  isFarCase,
  isTooFarCase,
  extraBackendDelayMs,
  previousDelta,
) => {
  const safePreviousDelta = Number.isFinite(previousDelta) ? previousDelta : 0;
  const previousReduction = Math.max(0, -safePreviousDelta);

  // far 10 case 378585
  // not far case  378569 and this needed 7 becouse the previous one needed to be accepted at 2502
  // not far case  378337 and this needed 5 becouse if we applied rule of delay == 0  we would claim it

  const baseDangerWait = isFarCase ? 10 : 7;
  const zeroDelayWait = extraBackendDelayMs === 0 ? -2 : 0;

  const extraBoost = isTooFarCase && !previousReduction ? 1 : 0;

  const dangerWait =
    baseDangerWait + previousReduction + extraBoost + zeroDelayWait;

  const messages = [
    `base=${baseDangerWait} phase=${isFarCase ? "far" : "normal"} previousDelta=${previousDelta}`,
  ];

  if (zeroDelayWait < 0) {
    messages.push(`backend-delay delay=0ms reduction=${zeroDelayWait}ms`);
  }

  if (extraBoost) {
    messages.push(`too-far-boost=+${extraBoost}ms`);
  }

  if (previousReduction) {
    messages.push(`previous-reduction-compensation=+${previousReduction}ms`);
  }

  return {
    dangerWait,
    dangerMessage: messages.join(" "),
  };
};

const getDiffMsBasedTimeStamp = (
  currentReferralEndTimestamp,
  lastReferralEndTimestamp,
) => {
  if (
    !Number.isFinite(lastReferralEndTimestamp) ||
    !Number.isFinite(currentReferralEndTimestamp)
  ) {
    return 0;
  }

  return currentReferralEndTimestamp - lastReferralEndTimestamp;
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
      lastTodayDiff: undefined,
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
      lastCaseOfYesterday: null,
      timeDiffFromLastCase: 0,
      lastCaseReferralId: 0,
      lastTodayOutcome: "",
      lastTodayOutcomeElapsedMs: 0,
      lastExtraWait: 0,
      lastFinalWait: Number(process.env.WAIT_FOR_ACCEPT_MS || 0),
      gapMin: 0,
    };
  }

  const currentDayKey = getLocalDayKey(referralEndTimestamp);

  const todayCases = getTodayCases(logsData, currentDayKey);

  const lastCaseOfYesterday = logsData[logsData.length - 1];

  const timeDiffFromLastCase = getDiffMsBasedTimeStamp(
    referralEndTimestamp,
    lastCaseOfYesterday?.referralEndTimestamp,
  );

  const lastToday = todayCases[todayCases.length - 1];
  const secondLastToday = todayCases[todayCases.length - 2];

  const {
    referralEndTimestamp: lastTodayTs,
    diff: lastTodayDiff,
    outcome: lastTodayOutcome,
    outcomeElapsedMs: lastTodayOutcomeElapsedMs,
    delta: lastTodayDelta,
    extraWaitMessage: messageFromLastToday,
    rtt: _lastTodayRTT,
  } = lastToday || {};

  const { waitTime: lastFinalWait, extraWait: lastExtraWait } =
    lastCaseOfYesterday;

  const diffFromLastToday = getDiffMsBasedTimeStamp(
    referralEndTimestamp,
    lastTodayTs,
  );

  const lastCaseDiff = lastCaseOfYesterday?.diff;
  const lastCaseReferralId = Number(lastCaseOfYesterday?.referralId || 0);

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
    typeof lastTodayDelta === "number"
      ? lastTodayDelta
      : getOutcomeDelta(lastTodayOutcome, lastTodayOutcomeElapsedMs);

  const _messageFromLastToday = messageFromLastToday || "";

  const wasLastTodayDangerous = _messageFromLastToday.includes("danger-zone");
  const wasFarDangerPhase = _messageFromLastToday.includes("phase=far");

  const isCurrentCaseDangerZone = isDoubleZeroDangerZone || isRecoveryThenDrop;

  const lastTodayRTT = _lastTodayRTT || 0;

  const safeLastExtraWait = Number.isFinite(lastExtraWait) ? lastExtraWait : 0;

  const gapMin = +(diffFromLastToday / 60000).toFixed(1);

  //  378548, 378585
  // it should work on case like
  // gap of 378277 nearly hour

  // it shouldn't shouldn't work on case like
  // gap of 378265 is 11 minutes
  // gap of 378336 is 6 minutes
  // gap of 378338 is 11 minutes
  // gap of 378437 is 7 minutes
  // 378548
  const isCurrentCaseNeedsDangerReduction =
    wasLastTodayDangerous && gapMin >= 10 && wasFarDangerPhase;

  return {
    isCurrentCaseDangerZone,
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastTodayDiff,
    lastCaseDiff,
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
    wasLastTodayDangerous,
    timeDiffFromLastCase,
    lastCaseReferralId,
    lastTodayOutcome,
    lastTodayOutcomeElapsedMs,
    lastExtraWait: safeLastExtraWait,
    lastFinalWait,
    isCurrentCaseNeedsDangerReduction,
    gapMin,
  };
};

const reduceAfterPreviousLargeNegativeDiff = (
  previousDiff,
  currentDiff,
  gapMin,
) => {
  if (previousDiff > -2000) return undefined;

  const reduction = gapMin < 5 ? 0 : gapMin < 20 ? 2 : 3;

  if (!reduction) return undefined;

  const prefix = currentDiff >= 0 ? "stable" : "negative";

  return {
    reduction,
    message: `⬇️ ${prefix}-after-large-negative-diff previousDiff=${previousDiff} gap=${gapMin}min wait=-${reduction}ms`,
  };
};

const getExtraTimeBasedLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
  rtt,
  baseWaitingTime,
}) => {
  const { IS_STABLE_WAITING_BRANCH /* DOES_SYSTEM_REDUCE_WAIT */ } =
    process.env;

  const isStableWaitingBranch = IS_STABLE_WAITING_BRANCH === "Y";
  // const doesSystemReducingWait = DOES_SYSTEM_REDUCE_WAIT === "Y";

  const extraBotMessages = [];
  const logsData = await readLogsAsArray();

  const {
    isDoubleZeroDangerZone,
    isRecoveryThenDrop,
    lastTodayDiff,
    isCurrentDiffNegative,
    isDangerZoneFiredToday,
    isFarFromLastToday,
    todayCases,
    isLastTodayDiffNegative,
    diffFromLastToday,
    previousDelta,
    lastTodayRTT,
    wasLastTodayDangerous,
    timeDiffFromLastCase,
    lastCaseDiff,
    lastCaseReferralId,
    lastTodayOutcome,
    lastTodayOutcomeElapsedMs,
    isCurrentCaseDangerZone,
    lastExtraWait,
    lastFinalWait,
    isCurrentCaseNeedsDangerReduction,
    gapMin,
    lastCaseOfYesterday,
  } = analyzeReferralTimingPatterns(logsData, referralEndTimestamp, diff);

  const isFirstCaseToday = !todayCases?.length;

  const timeGapHours = diffFromLastToday / (60 * 60 * 1000);
  const timeDiffFromLastCaseHours = timeDiffFromLastCase / (60 * 60 * 1000);

  const isHotCluster = !isFirstCaseToday && diffFromLastToday <= HOT_CLUSTER_MS;

  const isUltraHotCluster =
    !!lastFinalWait && timeDiffFromLastCase <= ULTRA_HOT_CLUSTER_MS;

  const isNearCluster =
    diffFromLastToday > HOT_CLUSTER_MS && diffFromLastToday <= NEAR_CLUSTER_MS;

  const isTooFarCase = isFarFromLastToday && timeGapHours >= 5;

  const isFarOrFirstDayCase = isFirstCaseToday || isFarFromLastToday;

  // const isMediumGap =
  //   diffFromLastToday > NEAR_CLUSTER_MS && diffFromLastToday < FAR_CASE_MS;

  // for these case 378554, 378546
  if (isUltraHotCluster) {
    const reductionWait =
      lastExtraWait > 6
        ? Math.max(3, Math.floor(lastExtraWait / 2))
        : lastExtraWait || 1;

    const message =
      `🌉 ultra-hot-cluster referralId=${referralId} ` +
      `diffPath=${lastCaseDiff ?? "none"}→${diff} ` +
      `previousWait=${lastFinalWait} base=${baseWaitingTime} ` +
      `lastExtra=${lastExtraWait} wait=-${reductionWait}`;

    return {
      computedExtraBotMessages: [message],
      computedExtraWait: -reductionWait,
    };
  }

  const rawExtraBasedRtt = getRttExtraWait(rtt);
  const isPositiveRtt = rawExtraBasedRtt > 0;

  // const shouldIgnorePositiveRtt =
  //   isPositiveRtt &&
  //   (wasLastTodayDangerous || isCurrentCaseNeedsDangerReduction);

  const shouldIgnorePositiveRtt =
    isPositiveRtt && isCurrentCaseNeedsDangerReduction;

  const extraBasedRtt = shouldIgnorePositiveRtt ? 0 : rawExtraBasedRtt;

  const isZeroBackendDelay = extraBackendDelayMs === 0;

  const referralIdGap = lastCaseReferralId
    ? Number(referralId) - lastCaseReferralId
    : undefined;

  const { bridgeMessage, bridgeWait } = getFirstDayBridgeExtraWait({
    referralEndTimestamp,
    currentDiff: diff,
    lastCaseDiff,
    hoursGap: timeDiffFromLastCaseHours,
    referralIdGap: referralIdGap || 0,
    extraBasedRtt,
    isFirstCaseToday,
    startZero: true,
  });

  const waitBucket = isFarOrFirstDayCase
    ? "far"
    : isHotCluster
      ? "hot"
      : isNearCluster
        ? "nearHot"
        : "medium";

  let extraWait = bridgeWait;

  const logCtx = `referralId=${referralId} diffPath=${lastTodayDiff ?? "none"}→${diff} gap=${gapMin}min waitBucket=${waitBucket}`;

  if (bridgeWait) {
    extraBotMessages.push(
      `🌉 first-day-bridge referralId=${referralId} diffPath=${lastCaseDiff ?? "none"}→${diff} wait=+${bridgeWait}ms_AND_${bridgeMessage}`,
    );
  }

  if (isCurrentCaseDangerZone) {
    const { dangerWait, dangerMessage } = getDangerZoneExtraWait(
      isFarFromLastToday,
      isTooFarCase,
      extraBackendDelayMs,
      previousDelta,
    );

    extraWait += dangerWait;

    const message = [
      `⚠️ danger-zone ${logCtx}`,
      `type=${isDoubleZeroDangerZone ? "double-zero" : "recovery-drop"}`,
      `wait=+${dangerWait}ms`,
    ].join(" ");

    extraBotMessages.push(
      `${message}${dangerMessage ? `_AND_${dangerMessage}` : ""}`,
    );

    if (isPositiveRtt) {
      extraWait += extraBasedRtt;
      const sign = extraBasedRtt > 0 ? "+" : "";
      extraBotMessages.push(`✅ rtt wait=${sign}${extraBasedRtt}ms`);
    }

    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  const extrTime = isStableWaitingBranch ? (isFirstCaseToday ? 2 : 1) : 0;
  const currentWait = WAITS_MAP[waitBucket] + extrTime;

  const negativeDiffCount =
    isFirstCaseToday || !isLastTodayDiffNegative
      ? 0
      : getNegativeCountBeforeCurrent(todayCases, diff);

  if (isCurrentDiffNegative) {
    const waitBasedDiff = Math.abs(diff) / 1000;

    // let maxNewWait = currentWait + (waitBasedDiff >= 2000 ? -1 : 0);
    let maxNewWait = currentWait;

    // let waitReducedByLowerDiffMessage = undefined;

    // if (waitBasedDiff >= 2000 && !isZeroBackendDelay) {
    //   // cases 378278, 377140 need less wait to claim it
    //   reductionValue = isHotCluster ? 0 : isNearCluster ? 1 : 2;
    //   if (reductionValue) {
    //     maxNewWait -= reductionValue;
    //     waitReducedByLowerDiffMessage = `⬇️ negative-diff-2000 wait=-${reductionValue}ms`;
    //   }
    // }

    if (isLastTodayDiffNegative) {
      // if (isTooFarCase && previousDelta <= 0) {
      //   const boostValue = wasLastTodayDangerous ? 1 : 2;
      //   maxNewWait += boostValue;

      //   extraBotMessages.push(
      //     `📊 far-negative-long-gap ${logCtx} extraBasedRtt=${extraBasedRtt} hours=${timeGapHours.toFixed(
      //       1,
      //     )} previousDelta=${previousDelta} wait=+${boostValue}ms`,
      //   );
      // }

      if (negativeDiffCount >= 3 && !isHotCluster) {
        const value = maxNewWait;
        extraWait += value;

        extraBotMessages.push(
          `🔥 negative-chain count=${negativeDiffCount} wait=+${value}ms`,
        );

        // if (waitReducedByLowerDiffValue) {
        //   extraBotMessages.push(waitReducedByLowerDiffMessage);
        // }
      } else {
        const waitValue = maxNewWait;
        extraWait += waitValue;

        extraBotMessages.push(
          isFarFromLastToday
            ? `↔️ far-negative wait=+${waitValue}ms`
            : `🔁 consecutive-negative wait=+${waitValue}ms`,
        );

        // if (waitReducedByLowerDiffValue) {
        //   extraBotMessages.push(waitReducedByLowerDiffMessage);
        // }
      }
    } else {
      extraWait += maxNewWait;
      const negativeText = isFirstCaseToday
        ? "🌅 first-day-negative"
        : "✅ first-negative";
      extraBotMessages.push(`${negativeText} ${logCtx} wait=+${maxNewWait}ms`);

      // if (waitReducedByLowerDiffValue) {
      //   extraBotMessages.push(waitReducedByLowerDiffMessage);
      // }
    }

    // const reductionValue = reduceAfterPreviousLargeNegativeDiff(
    //   lastTodayDiff,
    //   diff,
    //   gapMin,
    // );

    // if (reductionValue) {
    //   extraWait -= reductionValue.reduction;
    //   extraBotMessages.push(reductionValue.message);
    // }
  }

  if (diff >= 0) {
    extraWait += currentWait;

    const prefixText = isFirstCaseToday
      ? "🌅 first-day-stable"
      : isFarFromLastToday
        ? "↔️ far-stable"
        : "✅ stable";

    extraBotMessages.push(`${prefixText} ${logCtx} wait=+${currentWait}ms`);

    // if (negativeDiffCount >= 2) {
    //   const value = 2;
    //   extraWait -= value;
    //   extraBotMessages.push(
    //     `✅ previous-negative-more-than-2 ${logCtx} wait=-${value}ms`,
    //   );
    // }

    // for cases like 378278
    const reductionValue = reduceAfterPreviousLargeNegativeDiff(
      lastTodayDiff,
      diff,
      gapMin,
    );

    if (
      reductionValue &&
      !isZeroBackendDelay &&
      !isCurrentCaseNeedsDangerReduction
    ) {
      extraWait -= reductionValue.reduction;
      extraBotMessages.push(reductionValue.message);
    }
  }

  let afterDangerReduction = 0;

  if (isCurrentCaseNeedsDangerReduction) {
    afterDangerReduction = getAfterDangerReduction(
      previousDelta,
      lastTodayOutcome,
      lastTodayOutcomeElapsedMs,
    );

    extraWait -= afterDangerReduction;

    extraBotMessages.push(
      `🌉 first-case-after-danger previousDelta=${previousDelta} previousOutcome=${lastTodayOutcome}_${lastTodayOutcomeElapsedMs} wait=-${afterDangerReduction}ms`,
    );

    if (shouldIgnorePositiveRtt) {
      extraBotMessages.push(
        `🚫 rtt-ignored-after-far-danger rtt=${rtt} rawWait=+${rawExtraBasedRtt}ms`,
      );
    }
  }

  if (isZeroBackendDelay) {
    // 1-  we need to reduce if previous was danger check case 378589
    // 2-  we need to reduce if previous was not danger check case 377247
    let value = 2;
    if (wasLastTodayDangerous) {
      value = Math.max(1, 3 - (afterDangerReduction || 1));
    }

    extraWait -= value;

    extraBotMessages.push(`✅ backend-delay delay=0ms  wait=-${value}ms`);
  }

  if (extraBackendDelayMs >= 2000) {
    // we need check if we should reduce or not like case 378526
    extraBotMessages.push(
      `⚠️ backend-delay Ahmed should check if we need to reduce or not when delay=${extraBackendDelayMs}ms\n\nWe have a similar case (378526) with ${extraBackendDelayMs}ms delay`,
    );
  }

  return {
    computedExtraBotMessages: extraBotMessages,
    computedExtraWait: extraWait,
  };
};

export default getExtraTimeBasedLogs;
