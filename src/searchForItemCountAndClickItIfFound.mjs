/**
 * Search for a dashboard card by header text and optionally click it if its count > 0.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} targetText - The text to match (e.g. "Pending Referrals")
 * @param {boolean} shouldClickHeaderItem - Whether to click the card when found
 * @returns Promise<{{ clicked: boolean, count: number }}> - Click result and count
 */
const searchForItemCountAndClickItIfFound = async (
  page,
  targetText,
  shouldClickHeaderItem
) => {
  const targetTextElement = "small[class*='MuiBox-root']"; // More flexible selector

  try {
    await page.waitForSelector(targetTextElement, { timeout: 60_000 });
  } catch {
    console.log(`❌ Could not find '${targetTextElement}' on the page`);
    return { clicked: false, count: 0 };
  }

  const { clickable, count, uid } = await page.evaluate(
    ({ targetText, targetTextElement, shouldClickHeaderItem }) => {
      const labels = document.querySelectorAll(targetTextElement);

      if (!labels.length) {
        return { clickable: false, count: 0, uid: null };
      }

      for (const label of labels) {
        const labelText = label.textContent?.trim().toLowerCase();
        if (labelText === targetText.toLowerCase()) {
          const card = label.closest(".MuiCard-root");
          if (!card) continue;

          const countEl = card.querySelector("h6");
          const raw = countEl?.textContent?.trim() || "";
          const parsedCount = parseInt(raw, 10);
          const count = Number.isNaN(parsedCount) ? 0 : parsedCount;

          if (count > 0) {
            const uid = `clickable_${Math.random().toString(36).slice(2, 10)}`;
            if (shouldClickHeaderItem) {
              card.setAttribute("data-click-target", uid);
            }
            return { clickable: true, count, uid };
          }

          return { clickable: false, count: 0, uid: null };
        }
      }

      return { clickable: false, count: 0, uid: null };
    },
    { targetText, targetTextElement, shouldClickHeaderItem }
  );

  if (!clickable || !uid) {
    console.log(`ℹ️ '${targetText}' found but count=${count}, not clicked.`);
    return { clicked: false, count };
  }

  if (shouldClickHeaderItem) {
    try {
      await page.click(`[data-click-target="${uid}"]`);
      console.log(`✅ Clicked '${targetText}' card with count=${count}`);
      return { clicked: true, count };
    } catch (err) {
      console.log(`❌ Failed to click '${targetText}' card:`, err.message);
      return { clicked: false, count };
    }
  }

  console.log(`✅ '${targetText}' card found with count=${count}`);
  return { clicked: false, count };
};

export default searchForItemCountAndClickItIfFound;
