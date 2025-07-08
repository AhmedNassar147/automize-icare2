import { EFFECTIVE_REVIEW_DURATION_MS } from "./constants.mjs";
import getCurrentAlertRemainingTime from "./getCurrentAlertRemainingTime.mjs";

const estimatedTimeBeforeProcessingAction = 16_000;
const FALLBACK_BACKWARD_MS = 60_000; // 1 minute

const formatDateToYMDHM = (date) => {
  const pad = (n) => String(n).padStart(2, "0");
  const padMs = (n) => String(n).padStart(3, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
      date.getSeconds()
    )}` +
    `.${padMs(date.getMilliseconds())}`
  );
};

const formatMsToMinutesSeconds = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
};

const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Infers when the case started based on the visible snackbar alert or fallback timing.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page instance.
 * @param {number} artificialDelayMs - Any delay that occurred before this function runs.
 * @returns Promise<{ caseStartTime: number, caseStartedAt: string, caseStartedAtMessage: string, reviewTimeMs: number, caseWillBeSubmitMSAt: number, caseWillBeSubmitFormatted: string }>
 */
const getWhenCaseStarted = async (page, artificialDelayMs = 0) => {
  const now = new Date();

  const { hasMessageFound, totalRemainingTimeMs } =
    await getCurrentAlertRemainingTime(page);

  const totalMs = hasMessageFound ? totalRemainingTimeMs : FALLBACK_BACKWARD_MS;

  // Infer case start time
  const startDate = new Date(now.getTime() - totalMs - artificialDelayMs);
  const caseStartTime = startDate.getTime();

  // Adjust review time
  const reviewTimeMs = hasMessageFound
    ? Math.max(totalMs - estimatedTimeBeforeProcessingAction, 0)
    : Math.max(
        EFFECTIVE_REVIEW_DURATION_MS - estimatedTimeBeforeProcessingAction,
        0
      );

  // Format output
  const { minutes: reviewMinutes, seconds: reviewSeconds } =
    formatMsToMinutesSeconds(reviewTimeMs);

  const caseStartedAt = formatDateToYMDHM(startDate);

  const caseStartedAtMessage = `You have ${pluralize(
    reviewMinutes,
    "minute"
  )} and ${pluralize(reviewSeconds, "second")} to review.`;

  const caseWillBeSubmitMSAt = caseStartTime + reviewTimeMs;

  const caseWillBeSubmitFormatted = formatDateToYMDHM(
    new Date(caseWillBeSubmitMSAt)
  );

  return {
    caseStartTime,
    caseStartedAt,
    caseStartedAtMessage,
    reviewTimeMs,
    caseWillBeSubmitMSAt,
    caseWillBeSubmitFormatted,
  };
};

export default getWhenCaseStarted;
