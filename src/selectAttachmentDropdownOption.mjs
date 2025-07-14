/*
 *
 * Helper: `selectAttachmentDropdownOption`.
 *
 */
import { writeFile } from "fs/promises";
import humanClick from "./humanClick.mjs";
// import sleep from "./sleep.mjs";
import { htmlFilesPath } from "./constants.mjs";

/**
 * Selects an option from a Material UI dropdown ("Acceptance" or "Rejection").
 *
 * @param {object} opts - Options object.
 * @param {import("puppeteer").Page} opts.page - Puppeteer page instance.
 * @param {import("ghost-cursor").GhostCursor} opts.cursor - Ghost cursor instance.
 * @param {"Acceptance" | "Rejection"} opts.option - Option to select.
 * @param {string} opts.logString - Label for logging.
 * @param {import("puppeteer").ElementHandle<Element>} opts.sectionEl - Scope element containing the dropdown.
 */
const selectAttachmentDropdownOption = async ({
  page,
  cursor,
  option,
  sectionEl,
  logString,
}) => {
  // const normalized = option.trim().toLowerCase();

  // Step 1: Find the dropdown trigger inside section
  let dropdownTrigger = await (sectionEl || page).waitForSelector(
    'div[role="combobox"]',
    {
      timeout: 5000,
      visible: true,
    }
  );

  if (!dropdownTrigger) {
    console.log(`❌ dropdown trigger found.`);

    const html = await page.content();
    await writeFile(`${htmlFilesPath}/dropdown-trigger-not-found.html`, html);
    return false;
  }

  // Step 2: Try to click (fast), fallback to humanClick if needed
  try {
    await dropdownTrigger.click();
  } catch (err) {
    console.log(
      "⚠️ Default click failed, falling back to humanClick.",
      err.message
    );
    await dropdownTrigger.scrollIntoViewIfNeeded().catch(() => {});
    await humanClick(page, cursor, dropdownTrigger);
  }

  // Step 3: Try to find and click the matching dropdown option
  try {
    const itemOrder = option === "Acceptance" ? 1 : 2;

    const selector = `ul[role="listbox"] li[role="option"]:nth-child(${itemOrder})`;

    try {
      await page.waitForSelector(selector, { timeout: 4000, visible: true });
    } catch (error) {
      console.log(
        "Error when waiting for dropdown options selector:",
        error.message
      );
    }

    await page.click(selector);

    return true;
  } catch (error) {
    console.log(
      `⚠️ Error selecting dropdown option "${option}":`,
      error.message
    );
    return false;
  }
};

export default selectAttachmentDropdownOption;

// console.log(
//   `❌ Dropdown trigger not found in "${logString}", trying fallback...`
// );

// dropdownTrigger = await sectionEl.waitForSelector('div[role="combobox"]', {
//   timeout: 5000,
//   visible: true,
// });

// const found = await page.$$eval(
//   'ul[role="listbox"] li[role="option"]',
//   (items, normalized) => {
//     const match = items.find((el) =>
//       (el.textContent || "").toLowerCase().includes(normalized)
//     );
//     if (match) match.click();
//     return !!match;
//   },
//   normalized
// );

// if (!found) {
//   console.log(`❌ Option "${option}" not found in dropdown.`);
// }

// const matchingOptionHandle = await page.waitForFunction(
//   (targetText) => {
//     const items = Array.from(
//       document.querySelectorAll('ul[role="listbox"] li[role="option"]')
//     );
//     return items.find((el) =>
//       el.textContent?.trim().toLowerCase().includes(targetText)
//     );
//   },
//   { timeout: 4000 },
//   normalized
// );

// const elementHandle = matchingOptionHandle?.asElement();

// if (elementHandle) {
//   await humanClick(page, cursor, elementHandle);
// } else {
//   console.log(`❌ Option "${option}" not found.`);
// }
