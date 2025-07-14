/*
 *
 * Helper: `selectAttachmentDropdownOption`.
 *
 */
import { writeFile } from "fs/promises";
import humanClick from "./humanClick.mjs";
// import sleep from "./sleep.mjs";
import { htmlFilesPath } from "./constants.mjs";

const selectAttachmentDropdownOption = async ({
  page,
  cursor,
  option,
  sectionEl,
}) => {
  const mainObject = sectionEl || page;

  // const normalized = option.trim().toLowerCase();

  const dropdownTrigger = await mainObject.waitForSelector(
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
    return [false, "couldn't find the dropdown trigger"];
  }

  // Step 2: Try to click (fast), fallback to humanClick if needed
  try {
    await dropdownTrigger
      .scrollIntoViewIfNeeded({ timeout: 3000 })
      .catch(() => {});

    await dropdownTrigger.click();
  } catch (err) {
    console.log(
      "⚠️ Default click failed, falling back to humanClick.",
      err.message
    );
    await humanClick(page, cursor, dropdownTrigger);
  }

  // Step 3: Try to find and click the matching dropdown option
  try {
    const itemOrder = option === "Acceptance" ? 1 : 2;

    const selector = `ul[role="listbox"] li[role="option"]:nth-child(${itemOrder})`;

    const optionEl = await page.waitForSelector(selector, {
      timeout: 5000,
      visible: true,
    });

    await optionEl.click();
    return [true];
  } catch (error) {
    const _error = `⚠️ Error selecting dropdown option "${option}": ${error.message}`;

    console.log(_error);
    return [false, _error];
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
