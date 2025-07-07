/*
 *
 * Helper: `getCurrentAlertRemainingTime`.
 *
 */
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

const getCurrentAlertRemainingTime = async (page) => {
  const timeout = 2000;
  let minutes = 0;
  let seconds = 0;
  let hasMessageFound = false;

  try {
    const message = await page
      .waitForSelector(".MuiSnackbar-root .MuiAlert-message", { timeout })
      .then((el) => el.evaluate((el) => el.textContent?.trim() || ""));

    const match = message.match(/(\d+)\s+minute\(s\)?.*?(\d+)\s+second\(s\)?/i);

    if (match) {
      minutes = parseInt(match[1], 10) || 0;
      seconds = parseInt(match[2], 10) || 0;
      hasMessageFound = true;
    } else {
      console.warn("⚠️ Time format not recognized in message:", message);
    }
  } catch (err) {
    console.warn("⚠️ No alert message found within timeout:", err.message);
  }

  const totalRemainingTimeMs = (minutes * 60 + seconds) * 1000;

  return {
    hasMessageFound,
    minutes,
    seconds,
    totalRemainingTimeMs,
  };
};

export default getCurrentAlertRemainingTime;
