import { writeFile } from "fs/promises";
import { htmlFilesPath } from "./constants.mjs";

const selectAttachmentDropdownOption = async (page, option) => {
  const timeoutMs = 6000;

  const ok = await page.evaluate(
    async (option, timeoutMs) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const clickLikeHuman = (el) => {
        const opts = { bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new MouseEvent("mousedown", opts));
        el.dispatchEvent(new MouseEvent("mouseup", opts));
        el.dispatchEvent(new MouseEvent("click", opts));
      };

      try {
        const deadline = Date.now() + timeoutMs;

        let trigger = null;
        while (Date.now() < deadline) {
          trigger = document.querySelector('div[role="combobox"]');
          if (trigger) break;
          await sleep(20);
        }
        if (!trigger) return false;

        clickLikeHuman(trigger);

        const listDeadline = Date.now() + timeoutMs;
        const itemOrder = option === "Acceptance" ? 1 : 2;
        const selector = `ul[role="listbox"] li[role="option"]:nth-child(${itemOrder})`;

        while (Date.now() < listDeadline) {
          const listItem = document.querySelector(selector);
          if (listItem) {
            clickLikeHuman(listItem);
            return true;
          }
          await sleep(15);
        }

        return false;
      } catch (error) {
        return false;
      }
    },
    option,
    timeoutMs
  );

  if (!ok) {
    const _error = `⚠️ Error selecting dropdown option "${option}" (not found or not clickable within timeout=${timeoutMs}ms)`;
    const html = await page.content();
    await writeFile(`${htmlFilesPath}/dropdown-option-not-found.html`, html);
    console.log(_error);
    return [false, _error];
  }
  return [true];
};

export default selectAttachmentDropdownOption;
