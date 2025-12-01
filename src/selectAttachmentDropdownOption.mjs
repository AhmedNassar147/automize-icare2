/*
 *
 * Helper: `selectAttachmentDropdownOption`.
 *
 */
import { writeFile } from "fs/promises";
import { htmlFilesPath } from "./constants.mjs";

const selectAttachmentDropdownOption = async (page, option) => {
  const timeoutMs = 5000;

  const ok = await page.evaluate(
    async (option, timeoutMs) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const normalized = option.trim().toLowerCase();

      const clickLikeHuman = (el) => {
        const opts = { bubbles: true, cancelable: true, view: window };
        el.dispatchEvent(new MouseEvent("mousedown", opts));
        el.dispatchEvent(new MouseEvent("mouseup", opts));
        el.dispatchEvent(new MouseEvent("click", opts));
      };

      const deadline = Date.now() + timeoutMs;

      // 1) Find the combobox trigger (fast polling, no waitForSelector)
      let trigger = null;
      while (Date.now() < deadline) {
        trigger = document.querySelector('div[role="combobox"]');
        if (trigger) break;
        await sleep(20);
      }
      if (!trigger) return false;

      // 2) Open dropdown without scrolling the page
      try {
        trigger.focus?.({ preventScroll: true });
      } catch {
        trigger.focus?.();
      }
      clickLikeHuman(trigger);

      // 3) Wait for listbox + option by TEXT instead of nth-child
      const listDeadline = Date.now() + timeoutMs;

      while (Date.now() < listDeadline) {
        const listbox = document.querySelector('ul[role="listbox"]');
        if (listbox) {
          const items = Array.from(
            listbox.querySelectorAll('li[role="option"]')
          );

          const match =
            items.find(
              (li) => li.textContent.trim().toLowerCase() === normalized
            ) ||
            items.find((li) =>
              li.textContent.toLowerCase().includes(normalized)
            );

          if (match) {
            clickLikeHuman(match);
            return true;
          }
        }

        await sleep(20);
      }

      return false;
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
