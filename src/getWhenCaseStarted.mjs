/*
 *
 * Helper: `getWhenCaseStarted`.
 *
 */
import { EFFECTIVE_REVIEW_DURATION_MS } from "./constants.mjs";
import getCurrentAlertRemainingTime from "./getCurrentAlertRemainingTime.mjs";

const estimatedTimeBeforeProcessingAction = 15_000;

const formatDateToYMDHM = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeStyle: "medium",
    timeZone: "Asia/Riyadh",
    hourCycle: "h12",
  }).format(date);

const formatMsToMinutesSeconds = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
};

const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const baseBackwordTimeMS = 30_000;

/**
 * Infers when the case started based on the visible snackbar alert or fallback timing.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page instance.
 * @param {number} artificialDelayMs - Any delay that occurred before this function runs.
 * @returns Promise<{ caseStartAtMs: number, caseStartedAt: string, caseStartedAtMessage: string, reviewTimeMs: number, caseWillBeSubmtitedAtMS: number, caseWillBeSubmitAtFormatted: string }>
 */
const getWhenCaseStarted = async (page, artificialDelayMs = 0) => {
  const now = new Date();

  const { hasMessageFound, totalRemainingTimeMs } =
    await getCurrentAlertRemainingTime(page);

  const backTime = hasMessageFound
    ? EFFECTIVE_REVIEW_DURATION_MS - totalRemainingTimeMs
    : baseBackwordTimeMS;

  // Infer case start time
  const startDate = new Date(now.getTime() - backTime - artificialDelayMs);
  const caseStartAtMs = startDate.getTime();

  let reviewTimeMs = 0;

  if (hasMessageFound) {
    const diff = totalRemainingTimeMs - estimatedTimeBeforeProcessingAction;

    reviewTimeMs =
      totalRemainingTimeMs < estimatedTimeBeforeProcessingAction
        ? totalRemainingTimeMs
        : !diff
        ? baseBackwordTimeMS
        : diff;
  } else {
    reviewTimeMs =
      EFFECTIVE_REVIEW_DURATION_MS -
      baseBackwordTimeMS -
      estimatedTimeBeforeProcessingAction;
  }
  // Format output
  const { minutes: reviewMinutes, seconds: reviewSeconds } =
    formatMsToMinutesSeconds(reviewTimeMs);

  const caseStartedAtMessage = `You have ${pluralize(
    reviewMinutes,
    "minute"
  )} and ${pluralize(reviewSeconds, "second")} to review.`;

  const caseWillBeSubmittedAtMS = caseStartAtMs + reviewTimeMs;

  return {
    caseLeftOffTimeInMins: backTime / 1000 / 60,
    caseStartAtMs,
    caseStartedAt: formatDateToYMDHM(startDate),
    caseStartedAtMessage,
    reviewTimeMs,
    caseWillBeSubmittedAtMS,
    caseWillBeSubmitAt: formatDateToYMDHM(caseWillBeSubmittedAtMS),
  };
};

export default getWhenCaseStarted;
