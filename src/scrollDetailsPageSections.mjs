/*
 *
 * Helper: `scrollDetailsPageSections`.
 *
 */
import moveFromCurrentToRandomPosition from "./moveFromCurrentToRandomPosition.mjs";
import sleep from "./sleep.mjs";

// const viewportHeight = await page.evaluate(() => window.innerHeight);

const scrollDetailsPageSections = async ({
  page,
  sectionsIndices,
  cursor,
  logString,
  noCursorMovemntIfFailed = false,
  scrollDelay = 80,
}) => {
  try {
    const sections = await page.$$("section.collapsible-container.MuiBox-root");
    console.log("Found sections:", sections?.length);

    for (const index of sectionsIndices) {
      const section = sections[index];
      if (!section) continue;

      await section.scrollIntoViewIfNeeded({ timeout: 3000 });
      await sleep(scrollDelay + Math.random() * 90);
    }

    return sections[sectionsIndices.at(-1)] || null;
  } catch (err) {
    if (!noCursorMovemntIfFailed) {
      console.log(
        `⚠️ Failed to scroll, using cursor in ${logString}:`,
        err.message
      );
      await moveFromCurrentToRandomPosition(cursor);
    }

    return null;
  }
};

export default scrollDetailsPageSections;
