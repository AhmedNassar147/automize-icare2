/*
 *
 * Helper: `scrollDetailsPageSections`.
 *
 */
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import sleep from "./sleep.mjs";

// const viewportHeight = await page.evaluate(() => window.innerHeight);

const scrollDetailsPageSections = async ({
  page,
  sectionsIndices,
  logString,
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
    console.log(`⚠️ Failed to scroll  ${logString}:`, err.message);
    await makeKeyboardNoise(page, true);

    return null;
  }
};

export default scrollDetailsPageSections;
