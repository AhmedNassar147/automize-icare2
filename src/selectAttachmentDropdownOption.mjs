/*
 *
 * Helper: `selectAttachmentDropdownOption`.
 *
 */
import humanClick from "./humanClick.mjs";
import scrollIntoView from "./scrollIntoView.mjs";
import isElementInvisible from "./isElementInvisible.mjs";

/**
 * Selects an option from a Material UI dropdown ("Acceptance" or "Rejection").
 *
 * @param {object} opts - Options object.
 * @param {import("puppeteer").Page} opts.page - Puppeteer page instance.
 * @param {import("ghost-cursor").GhostCursor} opts.cursor - Ghost cursor instance for human-like interaction.
 * @param {number} opts.viewportHeight - Viewport height for scroll visibility checks.
 * @param {"Acceptance" | "Rejection"} opts.option - The dropdown option to select.
 * @param {string} opts.logString - The subsection of the test being executed.
 * @param {import("puppeteer").ElementHandle<Element>} opts.sectionEl - The section element containing the dropdown (used for scoping).
 */

const selectAttachmentDropdownOption = async ({
  page,
  cursor,
  option,
  viewportHeight,
  sectionEl,
  logString,
}) => {
  const normalized = option?.trim().toLowerCase();

  const dropdownTrigger = await sectionEl.$('div[role="combobox"]');

  if (!dropdownTrigger) {
    console.log(`❌ Dropdown trigger not found in ${logString}`);
    return;
  }

  // Ensure visible and scroll if necessary
  const hidden = await isElementInvisible(dropdownTrigger, viewportHeight);

  if (hidden) {
    console.log(
      `👀 Dropdown trigger is out of view. Scrolling in ${logString}`
    );
    await scrollIntoView(page, cursor, dropdownTrigger);
  }

  // Open the dropdown
  console.log("🖱️ Clicking dropdown...");
  await humanClick(page, cursor, dropdownTrigger);

  // Wait for the dropdown menu to render
  await page.waitForFunction(
    () =>
      document.querySelectorAll('ul[role="listbox"] li[role="option"]').length >
      0,
    { timeout: 6000 }
  );

  const options = await page.$$('ul[role="listbox"] li[role="option"]');

  // Look for the matching option
  for (const opt of options) {
    const text = await opt.evaluate((el) =>
      el.textContent.trim().toLowerCase()
    );

    console.log(`🔍 Found dropdown option in ${logString}`, text);

    if (text.includes(normalized)) {
      console.log(`✅ Selecting option: ${option}`);
      await humanClick(page, cursor, opt);
      return;
    }
  }
};

export default selectAttachmentDropdownOption;
