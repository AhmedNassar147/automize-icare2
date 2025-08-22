/*
 *
 * Helper: `selectAttachmentDropdownOption`.
 *
 */
import { writeFile } from "fs/promises";
import humanClick from "./humanClick.mjs";
import { htmlFilesPath } from "./constants.mjs";

const selectAttachmentDropdownOption = async (
  page,
  option,
  isPageUsingStrictRecaptchaMode,
  sectionEl
) => {
  const mainObject = sectionEl || page;

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
    // await dropdownTrigger
    //   .scrollIntoViewIfNeeded({ timeout: 3000 })
    //   .catch(() => {});

    // await sleep(10 * Math.random() * 10);

    await dropdownTrigger.click();
    // await Promise.allSettled([
    //   dropdownTrigger.scrollIntoViewIfNeeded({ timeout: 2000 }),
    //   dropdownTrigger.click(),
    // ]);
  } catch (err) {
    console.log(
      "⚠️ Default click failed, falling back to humanClick.",
      err.message
    );
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

// const first = createTimeLabel("first");
// console.time(first);
// await page.keyboard.press("ArrowDown");
// console.timeEnd(first);

// const check_dropdown = createTimeLabel("check_dropdown");
// console.time(check_dropdown);
// const [hasOptionSelected, selectionError] =

// if (!hasOptionSelected) {
//   await sendErrorMessage(
//     `We tried times to select ${actionName}, but couldn't find it.\n*selectionError:* ${selectionError}`,
//     "list-item-not-found",
//     buildDurationText(startTime, Date.now())
//   );
//   await closeCurrentPage(true);
//   break;
// }
