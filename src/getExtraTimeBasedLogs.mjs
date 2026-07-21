/*
 *
 * Helper: `getExtraTimeBasedLogs`.
 *
 */
import { OUTCOME_MAP } from "./constants.mjs";
import getOutcomeDelta from "./getOutcomeDelta.mjs";
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const HOT_CLUSTER_MS = 3 * 60 * 1000;
const ULTRA_HOT_CLUSTER_MS = 30 * 1000;
const NEAR_CLUSTER_MS = 23 * 60 * 1000;
const FAR_CASE_MS = 90 * 60 * 1000;

const WAITS_MAP = {
  hot: 0,
  nearHot: 1,
  // medium: 2,
  // far: 3,
  // for reduce
  medium: 3,
  far: 4,
};

const DANGER_ZONE_PHASES = {
  far: "far",
  normal: "normal",
};

const getRttExtraWait = (rtt) => {
  if (!Number.isFinite(rtt)) return 0;
  if (rtt >= 130) return +2;
  if (rtt >= 97) return +1;

  // extremely responsive session
  if (rtt < 70) return -1;

  return 0;
};

const getDiffCountBeforeCurrent = (checkNegative, todayCases, diff) => {
  const check = (diff) => (checkNegative ? diff < 0 : (diff || 0) >= 0);

  let count = check(diff) ? 1 : 0;

  for (let i = todayCases.length - 1; i >= 0; i--) {
    const item = todayCases[i];

    if (typeof item?.diff !== "number") {
      break;
    }

    if (check(item.diff)) {
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

// we need to dig when current case after normal danger wait
// if u check the 378745 case the previous one was normal danger and it should be
// accepted on 2547 not 2549 and it was accepted on 2547 we need to not increase/decrease
// the next one wait time which is 378745 case id

const getAfterDangerReduction = (
  lastTodayPreviousDelta,
  previousOutcome = "",
  dangerZonePhase,
) => {
  lastTodayPreviousDelta = lastTodayPreviousDelta || 0;

  const deltaMagnitude = Math.abs(lastTodayPreviousDelta);

  const wasNormalDangerZone = dangerZonePhase === DANGER_ZONE_PHASES.normal;

  if (
    previousOutcome.includes(OUTCOME_MAP.needLessWait) ||
    previousOutcome.includes(OUTCOME_MAP.lowWaiting) ||
    previousOutcome.includes(OUTCOME_MAP.moderateWaiting)
  ) {
    if (wasNormalDangerZone) {
      return deltaMagnitude >= 2 ? -Math.max(1, deltaMagnitude - 2) : 0;
    }

    return deltaMagnitude >= 3 ? 1 : 2;
  }

  if (previousOutcome.includes(OUTCOME_MAP.goodWaiting)) {
    // this only needs 1 if outcome is good waiting without increasing
    // so if delta increased by 1 we need to reduce by 2 to get to original wait
    // for mormal danger zone case like (378745) we need to reduce by 1
    return deltaMagnitude > 0
      ? wasNormalDangerZone
        ? 1
        : 2
      : wasNormalDangerZone
        ? 0
        : 2;
  }

  if (
    previousOutcome.includes(OUTCOME_MAP.needMoreWait) ||
    previousOutcome.includes(OUTCOME_MAP.nearToBlock)
  ) {
    // theses always sets global wait by postive value
    // and since we need to reduce we need to go to original wait then reduce 2
    // for mormal danger zone case like (378745) we need to reduce by 1
    return deltaMagnitude + (wasNormalDangerZone ? 1 : 2);
  }

  // for mormal danger zone case like (378745) we don't need to reduce
  return wasNormalDangerZone ? 0 : 2;
};

const getDangerZoneExtraWait = (
  shouldUseFullWait,
  isTooFarCase,
  extraBackendDelayMs,
  lastTodayPreviousDelta,
  gapMin,
) => {
  const previousReduction = Math.max(0, -lastTodayPreviousDelta);

  // far 10 case 378585
  // not far case  378569 and this needed 7 becouse the previous one needed to be accepted at 2502
  // not far case  378337 and this needed 5 becouse if we applied rule of delay == 0  we would claim it
  const baseDangerWait = shouldUseFullWait ? 10 : gapMin < 15 ? 6 : 7;
  const zeroDelayWait = extraBackendDelayMs === 0 ? -2 : 0;

  // we use the too far for case like 378994
  // it was too far gap more than 8 hours
  // const extraBoost = isTooFarCase ? 1 : 0;
  const extraBoost = 0;

  const dangerWait =
    baseDangerWait +
    // we should exclude the previous reduction when not far case example 378738
    (shouldUseFullWait ? previousReduction : 0) +
    extraBoost +
    zeroDelayWait;

  const phase = shouldUseFullWait
    ? DANGER_ZONE_PHASES.far
    : DANGER_ZONE_PHASES.normal;

  const messages = [
    `base=${baseDangerWait} phase=${phase} lastTodayPreviousDelta=${lastTodayPreviousDelta}`,
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

const getCaseDelta = (initialValue, outcome, elapsedMs) => {
  const delta =
    typeof initialValue === "number"
      ? initialValue
      : getOutcomeDelta(outcome, elapsedMs);

  return Number.isFinite(delta) ? delta : 0;
};

const analyzeReferralTimingPatterns = (
  logsData,
  referralEndTimestamp,
  diff,
  doesSystemReducingWait,
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
      lastTodayPreviousDelta: 0,
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
      wasLastCaseNormalDangerous: false,
      lastCaseOutcome: "",
      lastCaseOutcomeElapsedMs: 0,
      gapMinLastCase: 0,
      lastCasePreviousDelta: 0,
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

  const {
    waitTime: lastFinalWait,
    extraWait: lastExtraWait,
    outcome: lastCaseOutcome,
    outcomeElapsedMs: lastCaseOutcomeElapsedMs,
    delta: lastDelta,
  } = lastCaseOfYesterday;

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

  const lastTodayPreviousDelta = getCaseDelta(
    lastTodayDelta,
    lastTodayOutcome,
    lastTodayOutcomeElapsedMs,
  );

  const lastCasePreviousDelta = getCaseDelta(
    lastDelta,
    lastCaseOutcome,
    lastCaseOutcomeElapsedMs,
  );

  const _messageFromLastToday = messageFromLastToday || "";

  const wasLastTodayDangerous = _messageFromLastToday.includes("danger-zone");
  const wasFarDangerPhase = _messageFromLastToday.includes("phase=far");

  const isCurrentCaseDangerZone =
    !doesSystemReducingWait && (isDoubleZeroDangerZone || isRecoveryThenDrop);

  const lastTodayRTT = _lastTodayRTT || 0;

  const safeLastExtraWait = Number.isFinite(lastExtraWait) ? lastExtraWait : 0;

  const gapMin = +(diffFromLastToday / 60000).toFixed(1);
  const gapMinLastCase = +(timeDiffFromLastCase / 60000).toFixed(1);

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
    wasLastTodayDangerous && gapMinLastCase >= 10 && wasFarDangerPhase;

  const wasLastCaseNormalDangerous =
    wasLastTodayDangerous && !wasFarDangerPhase;

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
    lastTodayPreviousDelta,
    lastTodayRTT,
    wasLastTodayDangerous,
    wasFarDangerPhase,
    timeDiffFromLastCase,
    lastCaseReferralId,
    lastTodayOutcome,
    lastTodayOutcomeElapsedMs,
    lastExtraWait: safeLastExtraWait,
    lastFinalWait,
    isCurrentCaseNeedsDangerReduction,
    gapMin,
    wasLastCaseNormalDangerous,
    lastCaseOutcome,
    lastCaseOutcomeElapsedMs,
    gapMinLastCase,
    lastCasePreviousDelta,
  };
};

// this is a danger zone case
// 15/07/2026 09:23:45 am| -2000 - (<) |380964| 2435_14
// that should reduce all day cases

const getExtraTimeBasedLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
  rtt,
  baseWaitingTime,
  forceReduceWait,
}) => {
  const { IS_STABLE_WAITING_BRANCH, DOES_SYSTEM_REDUCE_WAIT } = process.env;

  const isStableWaitingBranch = IS_STABLE_WAITING_BRANCH === "Y";
  const doesSystemReducingWait =
    forceReduceWait || DOES_SYSTEM_REDUCE_WAIT === "Y";

  const extraBotMessages = [
    doesSystemReducingWait ? "⚠️ system-reducing-wait" : "",
  ].filter(Boolean);

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
    lastTodayPreviousDelta,
    lastTodayRTT,
    wasLastTodayDangerous,
    wasFarDangerPhase,
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
    wasLastCaseNormalDangerous,
    lastCaseOutcome,
    lastCaseOutcomeElapsedMs,
    gapMinLastCase,
    lastCasePreviousDelta,
  } = analyzeReferralTimingPatterns(
    logsData,
    referralEndTimestamp,
    diff,
    doesSystemReducingWait,
  );

  const isLastCaseNegative = lastCaseDiff && lastCaseDiff < 0;

  const isLastCaseTodayNegative = lastTodayDiff && lastTodayDiff < 0;

  const lastTodayCaseNegativeDiffValue = isLastCaseNegative
    ? Math.abs(lastTodayDiff) / 1000
    : 0;

  const isFirstCaseToday = !todayCases?.length;

  const timeGapHours = diffFromLastToday / (60 * 60 * 1000);
  const timeDiffFromLastCaseHours = timeDiffFromLastCase / (60 * 60 * 1000);

  const isHotCluster =
    !isFarFromLastToday && timeDiffFromLastCase <= HOT_CLUSTER_MS;

  const isUltraHotCluster =
    !!lastFinalWait && timeDiffFromLastCase <= ULTRA_HOT_CLUSTER_MS;

  const isNearCluster =
    timeDiffFromLastCase > HOT_CLUSTER_MS &&
    timeDiffFromLastCase <= NEAR_CLUSTER_MS;

  const isTooFarCase = isFarFromLastToday && timeGapHours >= 6;

  const isFarOrFirstDayCase = isFirstCaseToday || isFarFromLastToday;

  const currentHours = new Date().getHours();

  const isLargeRtt = (rtt || 0) > 100;

  // const isMediumGap =
  //   diffFromLastToday > NEAR_CLUSTER_MS && diffFromLastToday < FAR_CASE_MS;

  // for these case  378546,378768
  if (isUltraHotCluster && !isCurrentCaseDangerZone) {
    const wait =
      lastExtraWait > 6
        ? Math.max(3, Math.floor(lastExtraWait / 2))
        : lastExtraWait <= 0
          ? lastExtraWait
          : 0;

    const message =
      `🌉 ultra-hot-cluster referralId=${referralId} ` +
      `diffPath=${lastCaseDiff ?? "none"}→${diff} ` +
      `previousWait=${lastFinalWait} base=${baseWaitingTime} ` +
      `lastExtra=${lastExtraWait} wait=${wait}`;

    // you could see intelgram
    // ultra-hot-cluster referralId=378768
    // diffPath=-1000→-1000
    // previousWait=2547 base=2544
    // lastExtra=3 wait=0
    // and since previous case updated to 2547ms as wait and baseWaitingTime is staled we need to add the value.
    return {
      computedExtraBotMessages: [message],
      computedExtraWait: wait,
    };
  }

  const rawExtraBasedRtt = getRttExtraWait(rtt);
  const isPositiveRtt = rawExtraBasedRtt > 0;

  const isCurrentNeedsReductionAfterNormalDanger =
    wasLastCaseNormalDangerous &&
    gapMinLastCase >= 12 &&
    !isCurrentDiffNegative;

  // const willReductAfterDanger =
  //   isCurrentNeedsReductionAfterNormalDanger ||
  //   isCurrentCaseNeedsDangerReduction;

  const willReductAfterDanger = false;

  const shouldIgnorePositiveRtt = isPositiveRtt && willReductAfterDanger;

  const extraBasedRtt = shouldIgnorePositiveRtt ? 0 : rawExtraBasedRtt;

  const isZeroBackendDelay = extraBackendDelayMs === 0;

  const referralIdGap = lastCaseReferralId
    ? Number(referralId) - lastCaseReferralId
    : undefined;

  const waitBucket = isFarOrFirstDayCase
    ? "far"
    : isHotCluster
      ? "hot"
      : isNearCluster
        ? "nearHot"
        : "medium";

  let extraWait = 0;

  let rttMessage = "";

  const shouldUseRtt = !willReductAfterDanger && !!extraBasedRtt;
  // extraBasedRtt < 0 || (isPositiveRtt && !shouldIgnorePositiveRtt);

  if (shouldUseRtt) {
    extraWait += extraBasedRtt;
    const sign = extraBasedRtt > 0 ? "+" : "-";
    rttMessage = `✅ rtt wait=${sign}${extraBasedRtt}ms`;
  }

  const logCtx = `referralId=${referralId} diffPath=${lastTodayDiff ?? "none"}→${diff} gap=${gapMinLastCase}min waitBucket=${waitBucket}`;

  if (isCurrentCaseDangerZone) {
    const { dangerWait, dangerMessage } = getDangerZoneExtraWait(
      // isFarFromLastToday && currentHours >= 12,
      isFarFromLastToday,
      isTooFarCase,
      extraBackendDelayMs,
      lastTodayPreviousDelta,
      gapMin,
    );

    extraWait += dangerWait;

    const message = [
      `⚠️ danger-zone ${logCtx}`,
      `type=${isDoubleZeroDangerZone ? "double-zero" : "recovery-drop"}`,
      `wait=+${dangerWait}ms`,
      rttMessage,
    ]
      .filter(Boolean)
      .join(" ");

    extraBotMessages.push(
      `${message}${dangerMessage ? `_AND_${dangerMessage}` : ""}`,
    );

    return {
      computedExtraBotMessages: extraBotMessages,
      computedExtraWait: extraWait,
    };
  }

  const shouldBoostWaitAfterDanger =
    !!wasLastTodayDangerous && isCurrentDiffNegative && isLargeRtt;

  const extrTime = isStableWaitingBranch ? (isFirstCaseToday ? 2 : 1) : 0;
  let currentWait =
    doesSystemReducingWait && isFirstCaseToday
      ? 0
      : WAITS_MAP[waitBucket] + extrTime;

  if (currentWait && doesSystemReducingWait) {
    currentWait = -currentWait;
  }

  const isTwoHoursOrMoreLeft = timeDiffFromLastCaseHours >= 2;

  const isCurrentAndPreviousDiffZero =
    !isCurrentDiffNegative && !isLastCaseTodayNegative;

  // const shouldReduceIfFirstCase = isFirstCaseToday && gapMinLastCase >= 15; ( when !doesSystemReducingWait)
  // const shouldReduceIfFirstCase = isFirstCaseToday && gapMinLastCase >= 4;
  const shouldReduceIfFirstCase = isFirstCaseToday;

  let shouldDecreaseInitialWait =
    shouldReduceIfFirstCase ||
    (!willReductAfterDanger &&
      isTwoHoursOrMoreLeft &&
      !shouldBoostWaitAfterDanger);

  if (
    !doesSystemReducingWait &&
    isCurrentAndPreviousDiffZero &&
    !shouldReduceIfFirstCase
  ) {
    shouldDecreaseInitialWait =
      timeDiffFromLastCaseHours < 4 ? false : shouldDecreaseInitialWait;
  }

  const positiveLastDelta = Math.abs(lastCasePreviousDelta || 0);

  const isLastCaseWasLowWaiting = [
    OUTCOME_MAP.lowWaiting,
    OUTCOME_MAP.needLessWait,
  ].includes(lastCaseOutcome);

  const isLastCaseModerateWaiting =
    lastCaseOutcome === OUTCOME_MAP.moderateWaiting;

  const negativeDiffCount = !isLastCaseNegative
    ? 0
    : getDiffCountBeforeCurrent(true, todayCases.slice(-4), diff);

  const positiveDiffCount = isLastCaseNegative
    ? 0
    : getDiffCountBeforeCurrent(false, todayCases.slice(-8), diff);

  if (shouldDecreaseInitialWait) {
    const isNotPerformedCase =
      !lastCaseOutcome || lastCaseOutcome === "not-clicked";

    let newWait = 0;

    if (isFirstCaseToday) {
      const value =
        timeDiffFromLastCaseHours <= 1
          ? -2
          : timeDiffFromLastCaseHours >= 10
            ? -6
            : timeDiffFromLastCaseHours > 4
              ? -5
              : -4;
      newWait = value;
      extraBotMessages.push(
        `🔥 reducing-for-first-case wait=${value}ms lastCasePreviousDelta=${lastCasePreviousDelta} timeDiffFromLastCaseHours=${timeDiffFromLastCaseHours}`,
      );
    } else if (isLastCaseWasLowWaiting) {
      const maxStart = timeDiffFromLastCaseHours >= 3 ? 4 : 3;
      const value = -Math.max(maxStart, 6 - (positiveLastDelta || 1));
      newWait = value;
      extraBotMessages.push(
        `🔥 reducing-after-low-waiting wait=${value}ms lastCasePreviousDelta=${lastCasePreviousDelta}`,
      );
    } else if (isLastCaseModerateWaiting) {
      const maxStart =
        timeDiffFromLastCaseHours >= 3 && positiveLastDelta > 2 ? 5 : 4;
      const value = -Math.max(2, maxStart - (positiveLastDelta || 1));
      newWait = value;

      extraBotMessages.push(
        `🔥 reducing-after-moderate wait=${value}ms lastCasePreviousDelta=${lastCasePreviousDelta}`,
      );
    } else {
      const value = timeDiffFromLastCaseHours >= 3 ? -3 : -2;
      newWait = value;
      extraBotMessages.push(
        `🔥 reducing-wait wait=${value}ms lastCaseOutcome=${lastCaseOutcome} lastCasePreviousDelta=${lastCasePreviousDelta}`,
      );
    }

    currentWait = doesSystemReducingWait ? currentWait + newWait : newWait;
  }

  if (isCurrentDiffNegative) {
    const waitBasedDiff = Math.abs(diff) / 1000;
    const valueFromNegative = (waitBasedDiff || 1) - 1;

    let maxNewWait = currentWait + valueFromNegative;

    if (isLastTodayDiffNegative) {
      const waitValue = maxNewWait;
      extraWait += waitValue;

      extraBotMessages.push(
        isFarFromLastToday
          ? `↔️ far-negative ${logCtx} wait=${waitValue}ms`
          : `🔁 consecutive-negative ${logCtx} wait=${waitValue}ms`,
      );

      if (negativeDiffCount >= 2 && !doesSystemReducingWait) {
        const isCount3OrMore = negativeDiffCount >= 3;
        // 381020 isCount3OrMore && isFarFromLastToday
        // 380825 isCount3OrMore && !isFarFromLastToday
        const value =
          (isCount3OrMore && !isFarFromLastToday) ||
          lastTodayCaseNegativeDiffValue > 1
            ? shouldDecreaseInitialWait
              ? 0
              : -1
            : 1 + (isCount3OrMore ? 1 : 0);
        extraWait += value;

        extraBotMessages.push(
          `🔥 negative-chain count=${negativeDiffCount} wait=${value}ms`,
        );
      }
    } else {
      extraWait += maxNewWait;
      extraBotMessages.push(
        `✅ first-day-negative ${logCtx} wait=${maxNewWait}ms`,
      );
    }

    if (isZeroBackendDelay) {
      let value = 1;
      extraWait += value;
      extraBotMessages.push(
        `✅ backend-delay-with-negative-diff delay=0ms  wait=+${value}ms`,
      );
    }

    // if (shouldBoostWaitAfterDanger) {
    //   const value = wasFarDangerPhase ? 2 : 1;
    //   extraWait += value;
    //   extraBotMessages.push(
    //     `🔥 boost-wait-after-danger wait=${value}ms lastCaseOutcome=${lastCaseOutcome} lastCasePreviousDelta=${lastCasePreviousDelta}`,
    //   );
    // }
  }

  if (!isCurrentDiffNegative) {
    let value = currentWait;

    if (!doesSystemReducingWait) {
      if (!isFirstCaseToday && value < 4 && !isHotCluster) {
        const isExceedingTime = timeDiffFromLastCase <= 85 * 60 * 1000;
        const isExceedingPreviousNegative = negativeDiffCount >= 2;

        let bootMessage = "";

        if (isExceedingTime) {
          value = extraBasedRtt > 0 ? 3 : 4;
          const tag = `boot-stable-wait-${value}`;
          bootMessage = `🔥 ${tag} waitWas=${currentWait}ms to wait=${value}ms gapMin=${gapMin}`;
        }

        if (isExceedingPreviousNegative && timeDiffFromLastCaseHours < 2) {
          const maxValue = isFarFromLastToday ? 5 : 4;
          value = maxValue - (extraBasedRtt > 0 ? 1 : 0);
          const tag = `boot-stable-wait-${value}`;
          bootMessage = `🔥 ${tag} waitWas=${currentWait}ms to wait=${value}ms gapMin=${gapMin} isFarFromLastToday=${isFarFromLastToday} negativeDiffCount=${negativeDiffCount}`;
        }

        if (lastTodayCaseNegativeDiffValue > 1) {
          value += lastTodayCaseNegativeDiffValue - 1;
          const tag = `boot-stable-wait-${lastTodayCaseNegativeDiffValue - 1}`;
          bootMessage = `🔥 ${tag} waitWas=${currentWait}ms to wait=${value}ms gapMin=${gapMin} isFarFromLastToday=${isFarFromLastToday} negativeDiffCount=${negativeDiffCount}`;
        }

        if (bootMessage) {
          extraBotMessages.push(bootMessage);
        }
      }

      if (positiveDiffCount > 1 && !shouldDecreaseInitialWait) {
        // 1784440529000|1784440529000|1784440528000|1784440529000|     0     |1000 |19/07/2026 08:55:29 am|   0 - (=)   |381240| 2484_5(83+4)  |1784440528903|1784440532219| 832  |  No   | 117  |   good-waiting_850   |     |🔥 boot-stable-wait-4 waitWas=1ms to wait=4ms gapMinLastCase=33.9_AND_✅ stable referralId=381240 diffPath=-1000→0 gap=33.9min waitBucket=medium wait=+4ms_AND_✅ rtt wait=+1ms
        // 1784440840000|1784440840000|1784440839000|1784440840000|     0     |1000 |19/07/2026 09:00:40 am|   0 - (=)   |381242| 2485_1(87 + 4)  |1784440839845|             |      |  No   |  78  |   near-to-block_1463 |  2  |✅ stable referralId=381242 diffPath=0→0 gap=5.2min waitBucket=nearHot wait=+1ms
        // 1784444953000|1784444953000|1784444952000|1784444953000|     0     |1000 |19/07/2026 10:09:13 am|   0 - (=)   |381249| 2489_2(88 + 1)  |1784444952824|1784444956346| 1033 |  No   |  85  |   good-waiting_829   |     |✅ stable referralId=381249 diffPath=0→0 gap=68.5min waitBucket=medium wait=+2ms
        // 1784445157000|1784445157000|1784445156000|1784445157000|     0     |1000 |19/07/2026 10:12:37 am|   0 - (=)   |381147| 2490_1(92 + 4)  |1784445156870|             |      |  No   |  96  |     not-clicked      |     |✅ stable referralId=381147 diffPath=0→0 gap=3.4min waitBucket=nearHot wait=+1ms
        // 1784447800000|1784447800000|1784447799000|1784447800000|     0     |1000 |19/07/2026 10:56:40 am|   0 - (=)   |381256| 2492_2(95 + 3)  |1784447799839|             |      |  No   |  88  |     not-clicked      |     |✅ stable referralId=381256 diffPath=0→0 gap=44min waitBucket=medium wait=+2ms
        // 1784454276000|1784454276000|1784454275000|1784454276000|     0     |1000 |19/07/2026 12:44:36 pm|   0 - (=)   |381264| 2494_1(96 + 1)  |1784454275788|             |      |  No   |  89  |     not-clicked      |     |🔥 repeated-stable-count-6 waitWas=2ms to wait=1ms gapMinLastCase=107.9 timeDiffFromLastCaseHours=1.798888888888889_AND_↔️ far-stable referralId=381264 diffPath=0→0 gap=107.9min waitBucket=far wait=+1ms
        // 1784454554000|1784454554000|1784454553000|1784454554000|     0     |1000 |19/07/2026 12:49:14 pm|   0 - (=)   |381265| 2496_2(2501 + 4)  |1784454553744|             |      |  No   |  83  |     not-clicked      |     |🔥 repeated-stable-count-7 waitWas=1ms to wait=2ms gapMinLastCase=4.6 timeDiffFromLastCaseHours=0.07722222222222222_AND_✅ stable referralId=381265 diffPath=0→0 gap=4.6min waitBucket=nearHot wait=+2ms
        // 1784458255000|1784458255000|1784458254000|1784458255000|     0     |1000 |19/07/2026 01:50:55 pm|   0 - (=)   |381267| 2498_2(2502 + 1)  |1784458254737|1784458258952| 1717 |  No   |  97  |  near-to-block_2167  |  2  |🔥 repeated-stable-count-7 waitWas=2ms to wait=1ms gapMinLastCase=61.7 timeDiffFromLastCaseHours=1.0280555555555555_AND_✅ stable referralId=381267 diffPath=0→0 gap=61.7min waitBucket=medium wait=+1ms_AND_✅ rtt wait=+1ms
        // 1784461943000|1784461943000|1784461942000|1784461943000|     0     |1000 |19/07/2026 02:52:23 pm|   0 - (=)   |381273| 2504_4(2505 + 1 + 2)  |1784461942795|             |      |  No   | 156  |  near-to-block_1463  |  2  |🔥 repeated-stable-count-9 waitWas=2ms to wait=2ms gapMinLastCase=61.5 timeDiffFromLastCaseHours=1.0244444444444445_AND_✅ stable referralId=381273 diffPath=0→0 gap=61.5min waitBucket=medium wait=+2ms_AND_✅ rtt wait=+2ms
        // 1784462808000|1784462809000|1784462808000|1784462808000|     0     |1000 |19/07/2026 03:06:48 pm| -1000 - (<) |381274| 2512_6  |1784462808714|1784462812488| 1262 |  No   |  80  | moderate-waiting_763 | -2  |⚠️ danger-zone referralId=381274 diffPath=0→-1000 gap=14.4min waitBucket=nearHot type=double-zero wait=+6ms_AND_base=6 phase=normal lastTodayPreviousDelta=0
        value = gapMin < 37 ? 4 : gapMin <= 55 ? 3 : 2;
        const tag = `repeated-stable-count-${positiveDiffCount}`;
        const bootMessage = `🔥 ${tag} waitWas=${currentWait}ms to wait=${value}ms gapMin=${gapMin} timeDiffFromLastCaseHours=${timeDiffFromLastCaseHours}`;
        extraBotMessages.push(bootMessage);
      }
    }

    // if (isCurrentNeedsReductionAfterNormalDanger) {
    //   // this for case like 378745 where it shouldn't add more wait
    //   // last case normal dangerous and current with large time gap and positive diff
    //   const reduction = getAfterDangerReduction(
    //     lastCasePreviousDelta,
    //     lastCaseOutcome,
    //     DANGER_ZONE_PHASES.normal,
    //   );
    //   // reduction < 0 ? -reduction is for:  we were late on previous case and the outcome handler
    //   // reduced the global wait by it's delta, so we need to re-add the excluded delta so we don't
    //   // reduce twice
    //   value = -reduction;
    // }

    let prefixText = isFirstCaseToday
      ? "🌅 first-day-stable"
      : isFarFromLastToday
        ? "↔️ far-stable"
        : "✅ stable";

    // if (isCurrentNeedsReductionAfterNormalDanger) {
    //   prefixText += "-after-normal-danger";
    // }

    extraWait += value;

    const sign = value < 0 ? "-" : "+";

    extraBotMessages.push(
      `${prefixText} ${logCtx} wait=${sign}${Math.abs(value)}ms`,
    );
  }

  let afterDangerReduction = 0;

  // if (isCurrentCaseNeedsDangerReduction) {
  //   afterDangerReduction = getAfterDangerReduction(
  //     lastCasePreviousDelta,
  //     lastCaseOutcome,
  //     DANGER_ZONE_PHASES.far,
  //   );

  //   extraWait -= afterDangerReduction;

  //   extraBotMessages.push(
  //     `🌉 first-case-after-far-danger previousDelta=${lastCasePreviousDelta} previousOutcome=${lastCaseOutcome}_${lastCaseOutcomeElapsedMs || ""} wait=-${afterDangerReduction}ms`,
  //   );

  //   if (shouldIgnorePositiveRtt) {
  //     extraBotMessages.push(
  //       `🚫 rtt-ignored-after-far-danger rtt=${rtt} rawWait=+${rawExtraBasedRtt}ms`,
  //     );
  //   }
  // }

  // if (isZeroBackendDelay) {
  //   // 1-  we need to reduce if previous was danger check case 378589
  //   // 2-  we need to reduce if previous was not danger check case 377247
  //   let value = 1;
  //   if (wasLastTodayDangerous && !shouldDecreaseInitialWait) {
  //     value = Math.max(1, 2 - (afterDangerReduction || 1));
  //   }

  //   extraWait -= value;

  //   extraBotMessages.push(`✅ backend-delay delay=0ms  wait=-${value}ms`);
  // }

  if (extraBackendDelayMs >= 2000) {
    extraWait += 1;
    // we need check if we should reduce or not like case 378526 and 380464
    extraBotMessages.push(
      `⚠️ backend-delay Ahmed should check if we need to reduce or not when delay=${extraBackendDelayMs}ms\n\nWe have a similar case (378526) with ${extraBackendDelayMs}ms delay`,
    );
  }

  if (rttMessage) {
    extraBotMessages.push(rttMessage);
  }

  return {
    computedExtraBotMessages: extraBotMessages,
    computedExtraWait: extraWait,
  };
};

export default getExtraTimeBasedLogs;
