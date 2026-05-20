/*
 *
 * Helper: `getWaitBasedRefferalDatesAndLogs`.
 *
 */
import { readLogsAsArray } from "./summarizeLogsAfterAcceptance.mjs";

const NEARST_CASE_IN_MIN = 6;
const NEARST_CASE_IN_MS = NEARST_CASE_IN_MIN * 60000;

const FAR_CASE_MIN = 1.5 * 60;
const FAR_CASE_MS = FAR_CASE_MIN * 60000;

const getWaitBasedRefferalDatesAndLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
}) => {
  const IS_UNIZA_BRANCH = process.env.BRANCH_NAME === "Unizah";

  const logsData = await readLogsAsArray(referralEndTimestamp);

  let lastReferralLog = logsData?.[logsData.length - 1] || {};

  const {
    diff: lastDiff,
    extraWait: lastExtraWait,
    referralEndTimestamp: lastReferralEndTimestamp,
    referralId: lastReferralId,
  } = lastReferralLog || {};

  const diffBetweenLastAndCurrent = lastReferralEndTimestamp
    ? referralEndTimestamp - lastReferralEndTimestamp
    : 0;

  const isNearToLastCase =
    diffBetweenLastAndCurrent > 0 &&
    diffBetweenLastAndCurrent <= NEARST_CASE_IN_MS;

  let extraWait = 0;
  const extraBotMessages = [];

  if (isNearToLastCase) {
    extraBotMessages.push(
      // `Please Tell \`Ahmed\` of this: Found Near case \`${diffBetweenLastAndCurrent}\` <= ${NEARST_CASE_IN_MIN} minutes where referralId=\`${referralId}\``,
      `Found Near case  \`${diffBetweenLastAndCurrent / 60000}mins\` <= ${NEARST_CASE_IN_MIN} minutes`,
    );
  }

  const isFarFromLastCase =
    diffBetweenLastAndCurrent > 0 && diffBetweenLastAndCurrent >= FAR_CASE_MS;

  if (isFarFromLastCase) {
    extraBotMessages.push(
      // `Please Tell \`Ahmed\` of this: Found far case \`${diffBetweenLastAndCurrent}\` >= ${FAR_CASE_MIN} minutes where referralId=\`${referralId}\``,
      `Found far case \`${diffBetweenLastAndCurrent / 60000}mins\` >= ${FAR_CASE_MIN} minutes`,
    );
  }

  if (diff >= 0) {
    const isLastDiffEqualOrGreaterThanZero =
      typeof lastDiff === "number" ? lastDiff >= 0 : true; // default to normal when no history

    if (isLastDiffEqualOrGreaterThanZero) {
      extraWait = isFarFromLastCase
        ? IS_UNIZA_BRANCH
          ? 8
          : 6
        : IS_UNIZA_BRANCH
          ? 6
          : 3;
    } else {
      extraWait = isFarFromLastCase
        ? IS_UNIZA_BRANCH
          ? 8
          : 7
        : IS_UNIZA_BRANCH
          ? 6
          : 4;
    }
  }

  if (diff < 0) {
    const diffToWaitValue = (Math.abs(diff) / 1000) * 2;
    const maxNewWait = (IS_UNIZA_BRANCH ? 6 : 5) + diffToWaitValue;

    if (typeof lastDiff === "number" && lastDiff < 0) {
      const _lastExtraWait = lastExtraWait || 0;
      const computedWait = isFarFromLastCase
        ? maxNewWait
        : Math.ceil(maxNewWait / 2);

      extraWait = computedWait;
    } else {
      // first time seeing value < 0
      extraWait = maxNewWait;
    }
    extraBotMessages.push(
      // `Please Tell \`Ahmed\` of this: Found diff of \`${diff}\` Less than 0 where referralId=\`${referralId}\``,
      `Found diff of \`${diff}\` Less than 0`,
    );
  }

  // if (extraBackendDelayMs >= 2000) {
  //   extraWait += 6;
  //   extraWait = Math.max(extraWait, 12);
  // }

  // if (extraBackendDelayMs < 1000) {
  //   extraBotMessages.push(
  //     // `Please Tell \`Ahmed\` of this: Found extra backend delay of \`${extraBackendDelayMs}\` < 1000 where referralId=\`${referralId}\``,
  //     `Found extra backend delay of \`${extraBackendDelayMs}\` < 1000`,
  //   );
  // }

  return {
    computedExtraWait: extraWait,
    computedExtraBotMessages: extraBotMessages,
  };
};

export default getWaitBasedRefferalDatesAndLogs;
