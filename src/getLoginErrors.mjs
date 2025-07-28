/*
 *
 * Helper: `getLoginErrors`.
 *
 */
const errorSelector = ".validation-summary-errors ul li";

/**
 * Extracts login error messages shown in the DOM after form submission.
 * @param {import('puppeteer').Page} page - Puppeteer page instance.
 * @returns {Promise<string[]>} Array of error messages.
 */
const getLoginErrors = async (page) => {
  try {
    const errors = await page.$$eval(errorSelector, (items) =>
      items.map((li) => li?.textContent?.trim()).filter(Boolean)
    );

    return errors.filter(Boolean);
  } catch (error) {
    // Optional debug log:
    // console.warn("⚠️ No visible login error found in DOM:", error.message);
    return [];
  }
};

export default getLoginErrors;
