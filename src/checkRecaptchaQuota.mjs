/*
 *
 * Helper: `checkRecaptchaQuota`.
 *
 */
import sleep from "./sleep.mjs";

const QUOTA_MESSAGE = "This site is exceeding reCAPTCHA Enterprise free quota";

const checkRecaptchaQuota = async (
  page,
  timeoutMs = 3000,
  intervalMs = 200,
) => {
  const startedAt = Date.now();
  let lastFrameUrl = null;

  while (Date.now() - startedAt < timeoutMs) {
    const frame = page.frames().find((currentFrame) => {
      const url = currentFrame.url();

      return url.includes("/recaptcha/") && url.includes("/anchor");
    });

    if (!frame) {
      await sleep(intervalMs);
      continue;
    }

    lastFrameUrl = frame.url();

    try {
      const result = await frame.evaluate((quotaMessage) => {
        const quotaElement = document.querySelector(
          "#rc-anchor-invisible-over-quota",
        );

        const text = quotaElement?.textContent?.replace(/\s+/g, " ").trim();

        return {
          documentReady: document.readyState !== "loading",
          quotaElementFound: !!quotaElement,
          quotaExceeded: text?.includes(quotaMessage) ?? false,
        };
      }, QUOTA_MESSAGE);

      if (result.quotaElementFound) {
        return {
          frameFound: true,
          quotaExceeded: result.quotaExceeded,
          frameUrl: lastFrameUrl,
        };
      }

      /*
       * The frame exists but its document may still be loading.
       */
      if (!result.documentReady) {
        await sleep(intervalMs);
        continue;
      }

      /*
       * The frame finished loading and the quota element does not exist.
       */
      return {
        frameFound: true,
        quotaExceeded: false,
        frameUrl: lastFrameUrl,
      };
    } catch {
      /*
       * The frame may have navigated, reloaded, or detached while checking.
       */
      await sleep(intervalMs);
    }
  }

  return {
    frameFound: !!lastFrameUrl,
    quotaExceeded: false,
    frameUrl: lastFrameUrl,
  };
};

export default checkRecaptchaQuota;
