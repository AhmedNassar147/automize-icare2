/*
 *
 * Helper: `getSubmissionButtonsIfFound`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
const buttonsSelector = "section.referral-button-container button";

const getSubmissionButtonsIfFound = async (page) => {
  try {
    await page.waitForSelector(buttonsSelector, {
      timeout: 1600,
      // visible: true,
    });

    const buttons = await page.$$(buttonsSelector);

    if (!buttons?.length) return false;

    return buttons;
  } catch (err) {
    createConsoleMessage(err, "error", "getSubmissionButtonsIfFound");
    return false;
  }
};

export default getSubmissionButtonsIfFound;
