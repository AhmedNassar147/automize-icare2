/*
 *
 * Helper: `isRecaptchaQuotaExceeded`.
 *
 */
const isRecaptchaQuotaExceeded = async (page) => {
  const frame = page
    .frames()
    .find((f) => f.url().includes("/recaptcha/api2/anchor"));

  return await frame.evaluate(() => {
    return (
      document
        .querySelector("#rc-anchor-invisible-over-quota")
        ?.textContent?.includes(
          "This site is exceeding reCAPTCHA Enterprise free quota",
        ) ?? false
    );
  });
};

export default isRecaptchaQuotaExceeded;
