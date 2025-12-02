/*
 *
 * Helper: `selectAttachmentDropdownOption` (instant-polling fast version).
 *
 */
import { writeFile } from "fs/promises";
import { htmlFilesPath } from "./constants.mjs";

const selectAttachmentDropdownOption = async (page, option) => {
  const timeoutMs = 6500;

  const ok = await page.evaluate(
    async (option, timeoutMs) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const clickFast = (el) => {
        const ev = { bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new MouseEvent("mousedown", ev));
        el.dispatchEvent(new MouseEvent("mouseup", ev));
        el.dispatchEvent(new MouseEvent("click", ev));
      };

      const startTime = Date.now();

      let trigger = null;
      while (Date.now() - startTime < timeoutMs) {
        trigger = document.querySelector('div[role="combobox"]');
        if (trigger) break;
        await sleep(10);
      }
      if (!trigger) return false;

      try {
        trigger.focus();
      } catch (e) {
        trigger.focus();
      }
      clickFast(trigger);

      const itemOrder = option === "Acceptance" ? 1 : 2;
      const selector = `ul[role="listbox"] li[role="option"]:nth-child(${itemOrder})`;

      const listStart = Date.now();
      while (Date.now() - listStart < timeoutMs) {
        const li = document.querySelector(selector);
        if (li) {
          clickFast(li);
          return true;
        }
        await sleep(10);
      }

      return false;
    },
    option,
    timeoutMs
  );

  if (!ok) {
    const errorMsg = `⚠️ Instant-polling failed to select dropdown option "${option}"`;
    const html = await page.content();
    await writeFile(`${htmlFilesPath}/dropdown-option-not-found.html`, html);
    console.log(errorMsg);
    return [false, errorMsg];
  }

  return [true];
};

export default selectAttachmentDropdownOption;
