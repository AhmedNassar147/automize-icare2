/*
 *
 * Helper: `getWhenCaseStarted`.
 *
 */
import { EFFECTIVE_REVIEW_DURATION_MS } from "./constants.mjs";
import getCurrentAlertRemainingTime from "./getCurrentAlertRemainingTime.mjs";

// <div role="presentation" class="MuiSnackbar-root MuiSnackbar-anchorOriginBottomRight css-1ip16uo">
// <div class="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation6 MuiAlert-root MuiAlert-filledWarning MuiAlert-filled css-cb273i" role="alert" direction="up" style="opacity: 1; transform: none; transition: opacity 225ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1);">
// <div class="MuiAlert-icon css-1l54tgj">
// <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeInherit css-1cw4hi4" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="ReportProblemOutlinedIcon">
//  <path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z">
//  </path>
// </svg>
// </div>
// <div class="MuiAlert-message css-1xsto0d">A waiting period of 15 minutes shall pass before an action can be performed. There is 6 minute(s) and 7 second(s) remaining.</div>
// <div class="MuiAlert-action css-1mzcepu">
//   <button class="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorInherit MuiIconButton-sizeSmall css-q28n79" tabindex="0" type="button" aria-label="Close" title="Close">
//      <svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall css-1k33q06" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="CloseIcon">
//       <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path>
//   </svg>
//     <span class="MuiTouchRipple-root css-w0pj6f">
//    </span>
//  </button>
// </div>
// </div>
// </div>

// const formatDateToYMDHM = (date) => {
//   const pad = (n) => String(n).padStart(2, "0");
//   const padMs = (n) => String(n).padStart(3, "0");

//   const year = date.getFullYear();
//   const month = pad(date.getMonth() + 1);
//   const day = pad(date.getDate());
//   const hours = pad(date.getHours());
//   const minutes = pad(date.getMinutes());
//   const seconds = pad(date.getSeconds());
//   const milliseconds = padMs(date.getMilliseconds());

//   return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
// };

const FALLBACK_BACKWARD_MS = 60_000; // 1 minute

const formatMsToMinutesSeconds = (ms) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return { minutes, seconds };
};

const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

const estimatedTimeBeforProcessingAction = 16_000;

/**
 * Infers when the case started based on the visible snackbar alert or falls back to estimate.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page instance.
 * @param {number} artificialDelayMs - Time already spent before this call (e.g., mouse movements).
 * @returns Promise<{{
 *   caseStartedAt: string,
 *   caseStartedAtMessage: string,
 *   reviewTimeMs: number
 * }}>
 */
const getWhenCaseStarted = async (page, artificialDelayMs = 0) => {
  const now = new Date();

  const { hasMessageFound, totalRemainingTimeMs } =
    await getCurrentAlertRemainingTime(page);

  const totalMs = hasMessageFound ? totalRemainingTimeMs : FALLBACK_BACKWARD_MS;

  const startTime = new Date(now.getTime() - totalMs - artificialDelayMs);
  const caseStartedAt = startTime.toISOString();

  const adjustedTotalMs = Math.max(
    totalMs - estimatedTimeBeforProcessingAction,
    totalMs || 0
  );

  const reviewTimeMs = hasMessageFound
    ? adjustedTotalMs
    : EFFECTIVE_REVIEW_DURATION_MS -
      FALLBACK_BACKWARD_MS -
      estimatedTimeBeforProcessingAction;

  const { minutes: reviewMinutes, seconds: reviewSeconds } =
    formatMsToMinutesSeconds(reviewTimeMs);

  const caseStartedAtMessage = `You have ${pluralize(
    reviewMinutes,
    "minute"
  )} and ${pluralize(reviewSeconds, "second")} to review.`;

  return {
    caseStartedAt,
    caseStartedAtMessage,
    reviewTimeMs,
  };
};

export default getWhenCaseStarted;
