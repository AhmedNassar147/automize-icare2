/*
 *
 * Helper: `scrollIntoView`.
 *
 * Human-like scrollIntoView using ghost-cursor with fallback and stealth.
 */
import sleep from "./sleep.mjs";

const scrollIntoView = async (page, cursor, selector, options = {}) => {
  const scrollDelay = options?.scrollDelay ?? 30 + Math.random() * 100;
  const scrollSpeed = options?.scrollSpeed ?? 2 + Math.random() * 0.5;
  const waitForSelector = options?.waitForSelector ?? true;

  if (!selector) {
    return;
  }

  const isStringSelector = typeof selector === "string";
  let elementHandle = null;

  try {
    if (isStringSelector && waitForSelector) {
      await page.waitForSelector(selector, { timeout: 12000 });
    }

    if (isStringSelector) {
      elementHandle = await page.$(selector);
      if (!elementHandle) {
        console.log(`⚠️ Element not found for selector: ${selector}`);
        return;
      }
    } else {
      elementHandle = selector;
    }

    if (elementHandle) {
      try {
        await cursor.scrollIntoView(elementHandle, {
          scrollDelay,
          scrollSpeed,
        });
      } catch (err) {
        console.log(
          "⚠️ cursor.scrollIntoView failed, using fallback",
          err.message
        );

        const box = await elementHandle.boundingBox();

        if (box) {
          await page.mouse.wheel({ deltaY: box.y });
          // Optional: simulate user-triggered scroll event
          await page.evaluate((el) => {
            el.dispatchEvent(
              new WheelEvent("wheel", {
                bubbles: true,
                cancelable: true,
                deltaY: 100,
              })
            );
          }, elementHandle);
        }
      }

      await sleep(100 + Math.random() * 300);
    }
  } catch (error) {
    console.error(
      `Error while scrollIntoView selector "${selector}":`,
      error.message
    );
  }
};

export default scrollIntoView;
