/*
 *
 * Helper: `selectAttachmentDropdownOption`.
 *
 */
import { writeFile } from "fs/promises";
import humanClick from "./humanClick.mjs";
import { htmlFilesPath } from "./constants.mjs";

const selectAttachmentDropdownOption = async (page, option) => {
  const mainObject = page;

  // const normalized = option.trim().toLowerCase();

  const dropdownTrigger = await mainObject.waitForSelector(
    'div[role="combobox"]',
    {
      timeout: 5000,
      // visible: true,
    }
  );

  if (!dropdownTrigger) {
    console.log(`❌ dropdown trigger not found.`);

    const html = await page.content();
    await writeFile(`${htmlFilesPath}/dropdown-trigger-not-found.html`, html);
    return [false, "couldn't find the dropdown trigger"];
  }

  // Step 2: Try to click (fast), fallback to humanClick if needed
  try {
    await dropdownTrigger.click();
  } catch (err) {
    console.log(err.message);
    await humanClick(page, dropdownTrigger, {
      mode: "fast",
    });
  }

  // Step 3: Try to find and click the matching dropdown option
  try {
    const itemOrder = option === "Acceptance" ? 1 : 2;

    const selector = `ul[role="listbox"] li[role="option"]:nth-child(${itemOrder})`;

    const optionEl = await page.waitForSelector(selector, {
      timeout: 6500,
      // visible: true,
    });

    await optionEl.click();
    return [true];
  } catch (error) {
    const _error = `⚠️ Error selecting dropdown option "${option}": ${error.message}`;

    const html = await page.content();
    await writeFile(`${htmlFilesPath}/dropdown-option-not-found.html`, html);
    console.log(_error);
    return [false, _error];
  }
};

export default selectAttachmentDropdownOption;
