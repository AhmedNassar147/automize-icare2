/*
 *
 * Helper: `scrollDetailsPageSections`.
 *
 */
import isElementInvisible from "./isElementInvisible.mjs";
import moveFromCurrentToRandomPosition from "./moveFromCurrentToRandomPosition.mjs";
import scrollIntoView from "./scrollIntoView.mjs";

const scrollDetailsPageSections = async ({
  page,
  sectionsIndices,
  cursor,
  logString,
}) => {
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  let _section = null;

  try {
    console.log(`✅ scrolling sections in ${logString}`);

    const sections = await page.$$("section.collapsible-container.MuiBox-root");

    for (const index of sectionsIndices) {
      const section = sections[index];
      if (!section) continue;

      const invisible = await isElementInvisible(section, viewportHeight);

      if (invisible) {
        await scrollIntoView(page, cursor, section);
      }

      _section = section;
    }
  } catch (err) {
    console.log(
      `⚠️ Failed to scroll sections, moving cursor instead in ${logString}`,
      err.message
    );
    await moveFromCurrentToRandomPosition(cursor);
  }

  return [viewportHeight, _section];
};

export default scrollDetailsPageSections;
