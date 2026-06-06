/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { OUTCOME_MAP } from "./constants.mjs";
import getOutcomeDelta from "./getOutcomeDelta.mjs";
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const FAR_CASE_MIN = 90; // 1.5 hours
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const HOT_CLUSTER_MS = 4 * 60 * 1000;

const ULTRA_HOT_CLUSTER_MS = 25 * 1000;

const WAITS_MAP = {
  far: 3,
  default: 2,
  hotCluster: 1,
};

const getRttExtraWait = (rtt) => {
  if (!Number.isFinite(rtt)) return 0;

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

  const positiveDelta = Math.abs(previousDelta);

  if (
    previousOutcome.includes(OUTCOME_MAP.needLessWait) ||
    previousOutcome.includes(OUTCOME_MAP.lowWaiting) ||
    previousOutcome.includes(OUTCOME_MAP.moderateWaiting)
  ) {
    return previousDelta >= 2 ? 0 : 1;
  }

  if (previousOutcome.includes(OUTCOME_MAP.goodWaiting)) {
    return !positiveDelta ? 1 : 2;
  }

  if (previousOutcome.includes(OUTCOME_MAP.needMoreWait)) {
    return previousDelta + 1;
  }

  if (previousOutcome.includes(OUTCOME_MAP.nearToBlock)) {
    return previousDelta + 1;
  }

  return 0;
};

const getDangerZoneExtraWait = (
  isFarFromLastToday,
  isTooFarCase,
  previousDelta,
) => {
  const safePreviousDelta = Number.isFinite(previousDelta) ? previousDelta : 0;
  let previousReduction = Math.max(0, -safePreviousDelta);
  previousReduction = previousReduction ? Math.min(previousReduction, 2) : 0;

  const extraBoost = isTooFarCase && !previousReduction ? 1 : 0;
  const compensation = previousReduction;

  // we made it 6 according to this case id 378569
  // in this case we are in increasing
  const extraWait = (isFarFromLastToday ? 10 : 6) + compensation + extraBoost;

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
  const wasUsingFullWait = _messageFromLastToday.includes("fullWait=true");
  const wasFar = _messageFromLastToday.includes("far=true");

  const wasLastTodayFarDangerZone =
    wasLastTodayDangerous && wasFar && wasUsingFullWait;

  const isCurrentCaseDangerZone = isDoubleZeroDangerZone || isRecoveryThenDrop;

  const lastTodayRTT = _lastTodayRTT || 0;

  const safeLastExtraWait = Number.isFinite(lastExtraWait) ? lastExtraWait : 0;

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
    wasLastTodayFarDangerZone,
    wasLastTodayDangerous,
    timeDiffFromLastCase,
    lastCaseReferralId,
    lastTodayOutcome,
    lastTodayOutcomeElapsedMs,
    lastExtraWait: safeLastExtraWait,
    lastFinalWait,
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
  const { BRANCH_NAME /* DOES_SYSTEM_REDUCE_WAIT */ } = process.env;

  const isUnizahBranch = BRANCH_NAME === "unizah";
  // const doesSystemReducingWait = DOES_SYSTEM_REDUCE_WAIT === "Y";

  const isLargeRTT = typeof rtt === "number" && rtt >= 80 && rtt < 95;

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
    wasLastTodayFarDangerZone,
    wasLastTodayDangerous,
    timeDiffFromLastCase,
    lastCaseDiff,
    lastCaseReferralId,
    lastTodayOutcome,
    lastTodayOutcomeElapsedMs,
    isCurrentCaseDangerZone,
    lastExtraWait,
    lastFinalWait,
  } = analyzeReferralTimingPatterns(logsData, referralEndTimestamp, diff);

  const isFirstCaseToday = !todayCases?.length;

  const isHotCluster = !isFirstCaseToday && diffFromLastToday <= HOT_CLUSTER_MS;

  const isUltraHotCluster =
    !!lastFinalWait && timeDiffFromLastCase <= ULTRA_HOT_CLUSTER_MS;

  if (isUltraHotCluster) {
    const computedExtraWait =
      lastExtraWait > 6
        ? Math.max(3, Math.floor(lastExtraWait / 2))
        : lastExtraWait || 1;

    const message =
      `🌉 ultra-hot-cluster referralId=${referralId} ` +
      `diffPath=${lastCaseDiff ?? "none"}→${diff} ` +
      `previousWait=${lastFinalWait} base=${baseWaitingTime} ` +
      `lastExtra=${lastExtraWait} wait=-${computedExtraWait}`;

    return {
      computedExtraBotMessages: [message],
      computedExtraWait: -computedExtraWait,
    };
  }

  const timeGapHours = diffFromLastToday / (60 * 60 * 1000);
  const timeDiffFromLastCaseHours = timeDiffFromLastCase / (60 * 60 * 1000);

  const gapMin = (diffFromLastToday / 60000).toFixed(1);

  const rawExtraBasedRtt = getRttExtraWait(rtt);

  const isCurrentCaseJustAfterDanger =
    wasLastTodayDangerous && !isFarFromLastToday;

  const shouldIgnorePositiveRtt =
    isCurrentCaseJustAfterDanger && rawExtraBasedRtt > 0;

  const extraBasedRtt = shouldIgnorePositiveRtt ? 0 : rawExtraBasedRtt;

  const isTooFarCase =
    isFarFromLastToday && timeGapHours >= 5 && extraBasedRtt <= 0;

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

  let extraWait = bridgeWait;

  const logCtx = `referralId=${referralId} diffPath=${lastTodayDiff ?? "none"}→${diff}`;

  if (bridgeWait) {
    extraBotMessages.push(
      `🌉 first-day-bridge referralId=${referralId} diffPath=${lastCaseDiff ?? "none"}→${diff} wait=+${bridgeWait}ms_AND_${bridgeMessage}`,
    );
  }

  if (isCurrentCaseJustAfterDanger) {
    const afterDangerReduction = getAfterDangerReduction(
      previousDelta,
      lastTodayOutcome,
      lastTodayOutcomeElapsedMs,
    );

    extraWait -= afterDangerReduction;

    extraBotMessages.push(
      `🌉 first-case-after-danger ${logCtx} previousDelta=${previousDelta} previousOutcome=${lastTodayOutcome}_${lastTodayOutcomeElapsedMs} wait=-${afterDangerReduction}ms`,
    );
  }

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
    // check case 378337
    const value = isFarFromLastToday ? 2 : 1;
    extraWait -= value;
    extraBotMessages.push(
      `✅ backend-delay ${logCtx} delay=0ms wait=-${value}ms`,
    );
  }

  if (isCurrentCaseDangerZone) {
    const { dangerWait, dangerMessage } = getDangerZoneExtraWait(
      isFarFromLastToday,
      isTooFarCase,
      previousDelta,
    );

    extraWait += dangerWait;
    extraBotMessages.push(
      `⚠️ danger-zone ${logCtx} type=${
        isDoubleZeroDangerZone ? "double-zero" : "recovery-drop"
      } gap=${gapMin}min fullWait=${isFarFromLastToday} previousDelta=${previousDelta} far=${isFarFromLastToday} wait=+${dangerWait}ms${
        dangerMessage ? `_AND_${dangerMessage}` : ""
      }`,
    );

    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  const isNotFarAndNotHotCluster = !isFarFromLastToday && !isHotCluster;

  if (isCurrentDiffNegative) {
    const initialWait =
      isFirstCaseToday || isFarFromLastToday
        ? WAITS_MAP.far
        : isNotFarAndNotHotCluster
          ? 1
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
    let value = isNotFarAndNotHotCluster ? 1 : WAITS_MAP.default;

    const extrTime = isUnizahBranch ? (isFirstCaseToday ? 2 : 1) : 0;

    if (isFirstCaseToday || isFarFromLastToday) {
      value = WAITS_MAP.far + extrTime;
    } else if (isHotCluster) {
      value = WAITS_MAP.hotCluster;
    }

    const isStableAfterNegative =
      isNotFarAndNotHotCluster &&
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
