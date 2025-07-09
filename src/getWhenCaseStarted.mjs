/*
 *
 * Helper: `getWhenCaseStarted`.
 *
 */
import { EFFECTIVE_REVIEW_DURATION_MS } from "./constants.mjs";
import getCurrentAlertRemainingTime from "./getCurrentAlertRemainingTime.mjs";

const estimatedTimeBeforeProcessingAction = 5000;

const formatMsToMinutesSeconds = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
};

const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const baseBackwordTimeMS = 3_000;

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
  const caseStartedAt = startDate.toLocaleString();

  const fallbackEffectiveTime =
    EFFECTIVE_REVIEW_DURATION_MS - baseBackwordTimeMS;

  const diff = totalRemainingTimeMs - estimatedTimeBeforeProcessingAction;

  const reviewTimeMs = hasMessageFound
    ? totalRemainingTimeMs > estimatedTimeBeforeProcessingAction
      ? diff || totalRemainingTimeMs
      : totalRemainingTimeMs
    : fallbackEffectiveTime - estimatedTimeBeforeProcessingAction;

  // Format output
  const { minutes: reviewMinutes, seconds: reviewSeconds } =
    formatMsToMinutesSeconds(reviewTimeMs);

  const caseStartedAtMessage = `You have ${pluralize(
    reviewMinutes,
    "minute"
  )} and ${pluralize(reviewSeconds, "second")} to review.`;

  const caseWillBeSubmittedAtMS =
    caseStartAtMs +
    (fallbackEffectiveTime - estimatedTimeBeforeProcessingAction);

  const caseWillBeSubmitAt = new Date(caseWillBeSubmittedAtMS).toLocaleString();

  return {
    caseLeftOffTimeInMins: backTime / 1000 / 60,
    caseStartAtMs,
    caseStartedAt,
    caseStartedAtMessage,
    reviewTimeMs,
    caseWillBeSubmittedAtMS,
    caseWillBeSubmitAt,
  };
};

export default getWhenCaseStarted;
