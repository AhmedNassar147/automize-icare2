/*
 * Helper: searchForItemCountAndClickItIfFound
 *
 * Looks for a card containing the given `targetText` (e.g., "Pending Referrals"),
 * checks the count next to it, and clicks the card if count > 0.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} targetText - Text to look for inside <small> (e.g., "Pending Referrals")
 * @returns {Promise<{ clicked: boolean, count: number }>}
 */
const searchForItemCountAndClickItIfFound = async (
  page,
  targetText,
  shouldClickHeaderItem
) => {
  const targetTextElement = "small.MuiBox-root";

  try {
    await page.waitForSelector(targetTextElement, { timeout: 60 * 1000 });
  } catch {
    console.log(`❌ Could not find targetTextElement='${targetTextElement}'`);
    return { clicked: false, count: 0 };
  }

  const { clickable, count, uid } = await page.evaluate(
    ({ targetText, targetTextElement, shouldClickHeaderItem }) => {
      const labels = document.querySelectorAll(targetTextElement);

      if (!labels || !labels.length) {
        return { clickable: false, count: 0, uid: null };
      }

      for (const label of labels) {
        if (label.textContent.trim() === targetText) {
          const card = label.closest(".MuiCard-root");
          if (!card) continue;

          const countEl = card.querySelector("h6");
          const raw =
            countEl && countEl.textContent ? countEl.textContent.trim() : "";

          const count = Number.isNaN(parseInt(raw, 10)) ? 0 : parseInt(raw, 10);

          if (count > 0) {
            const uid = `target_to_click_${Math.random()
              .toString(36)
              .slice(2, 8)}`;

            if (shouldClickHeaderItem) {
              card.setAttribute("data-click-target", uid);
            }
            return { clickable: true, count, uid };
          }

          return { clickable: false, count, uid: null };
        }
      }

      return { clickable: false, count: 0, uid: null };
    },
    { targetText, targetTextElement, shouldClickHeaderItem }
  );

  const hasClicableData = !!(clickable && uid);

  if (!hasClicableData) {
    console.log(`ℹ️ '${targetText}' found but count=${count}, not clicked`);
    return { clicked: false, count };
  }

  if (shouldClickHeaderItem) {
    await page.click(`[data-click-target="${uid}"]`);
    console.log(`✅ Clicked '${targetText}' card with count=${count}`);
    return { clicked: true, count };
  }

  console.log(`✅ count=${count} found for '${targetText}' card.`);
  return { clicked: true, count };
};

export default searchForItemCountAndClickItIfFound;
