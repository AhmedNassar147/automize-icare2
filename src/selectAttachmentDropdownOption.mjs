const selectAttachmentDropdownOption = async (page, option) => {
  const timeoutMs = 6000;

  const ok = await page.evaluate(
    async (option, timeoutMs) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const fire = (el, type) => {
        el.dispatchEvent(
          new MouseEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            view: window,
          })
        );
      };

      const normalized = option.trim().toLowerCase();
      const until = Date.now() + timeoutMs;

      // --- 1) Find combobox trigger ---
      let trigger;
      while (Date.now() < until) {
        trigger = document.querySelector('div[role="combobox"]');
        if (trigger) break;
        await sleep(25);
      }
      if (!trigger) return false;

      // --- 2) Open dropdown WITHOUT focus and WITHOUT scroll ---
      // We explicitly block scrollIntoView by temporarily overriding it
      const originalScroll = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = () => {};

      fire(trigger, "mousedown");
      fire(trigger, "mouseup");
      fire(trigger, "click");

      // Restore scrollIntoView immediately
      Element.prototype.scrollIntoView = originalScroll;

      // --- 3) Wait for the listbox ---
      let optionElement;
      while (Date.now() < until) {
        const listbox = document.querySelector('ul[role="listbox"]');
        if (listbox) {
          const items = [...listbox.querySelectorAll('li[role="option"]')];

          optionElement =
            items.find(
              (li) => li.textContent.trim().toLowerCase() === normalized
            ) ||
            items.find((li) =>
              li.textContent.toLowerCase().includes(normalized)
            );

          if (optionElement) break;
        }
        await sleep(25);
      }

      if (!optionElement) return false;

      // --- 4) Click option WITHOUT scrolling ---
      const originalScroll2 = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = () => {};

      fire(optionElement, "mousedown");
      fire(optionElement, "mouseup");
      fire(optionElement, "click");

      Element.prototype.scrollIntoView = originalScroll2;

      return true;
    },
    option,
    timeoutMs
  );

  return ok ? [true] : [false, "Dropdown option not found or not clickable"];
};
