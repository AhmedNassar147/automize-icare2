/*
 *
 * Helper: `scrollDetailsPageSections`.
 *
 */
import moveFromCurrentToRandomPosition from "./moveFromCurrentToRandomPosition.mjs";
import sleep from "./sleep.mjs";

const scrollDetailsPageSections = async ({
  page,
  sectionsIndices,
  cursor,
  logString,
  noCursorMovemntIfFailed = false,
  scrollDelay = 125,
}) => {
  try {
    console.log(`✅ Scrolling sections in ${logString}`);

    const sections = await page.$$("section.collapsible-container.MuiBox-root");
    console.log("Found sections:", sections?.length);

    const viewportHeight = await page.evaluate(() => window.innerHeight);

    for (const index of sectionsIndices) {
      const section = sections[index];
      if (!section) continue;

      await page.evaluate(
        (el) => el.scrollIntoView({ behavior: "smooth", block: "center" }),
        section
      );

      await sleep(scrollDelay + Math.random() * 60);
    }

    return [viewportHeight, sections[sectionsIndices.at(-1)] || null];
  } catch (err) {
    console.warn(
      `⚠️ Failed to scroll, using cursor in ${logString}:`,
      err.message
    );

    if (!noCursorMovemntIfFailed) {
      await moveFromCurrentToRandomPosition(cursor);
    }

    return [null, null];
  }
};

export default scrollDetailsPageSections;
