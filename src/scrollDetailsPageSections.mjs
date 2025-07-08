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
}) => {
  const viewportHeight = await page.evaluate(() => window.innerHeight);

  let _section = null;

  try {
    console.log(`✅ scrolling sections in ${logString}`);

    const sections = await page.$$("section.collapsible-container.MuiBox-root");
    console.log("sections", sections.length);

    for (const index of sectionsIndices) {
      const section = sections[index];
      if (!section) continue;

      // const invisible = await isElementInvisible(section, viewportHeight);

      // await scrollIntoView(page, cursor, section);
      console.log("section", index);

      await page.evaluate(
        (el) => el.scrollIntoView({ behavior: "smooth", block: "center" }),
        section
      );
      await sleep(600);

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
