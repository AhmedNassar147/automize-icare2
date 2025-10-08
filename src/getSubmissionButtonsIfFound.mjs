/*
 *
 * Helper: `getSubmissionButtonsIfFound`.
 *
 */
const buttonsSelector = "section.referral-button-container button";

const getSubmissionButtonsIfFound = async (page) => {
  try {
    await page.waitForSelector(buttonsSelector, {
      timeout: 600,
      // visible: true,
    });

    const buttons = await page.$$(buttonsSelector);

    if (!buttons?.length) return false;

    return buttons;
  } catch (err) {
    console.log("❌ Failed to get submission buttons:", err.message);
    return false;
  }
};

export default getSubmissionButtonsIfFound;
