/*
 *
 * Helper: `scrollIntoView`.
 *
 */
import sleep from "./sleep.mjs";

const scrollIntoView = async (page, cursor, selector, options = {}) => {
  const scrollSpeed = options?.scrollSpeed ?? 40 + Math.random() + 0.5;
  const waitForSelector = options?.waitForSelector ?? true;

  if (!selector) return;

  const isStringSelector = typeof selector === "string";
  let elementHandle = null;

  try {
    if (isStringSelector && waitForSelector) {
      await page.waitForSelector(selector, { timeout: 12000 });
    }

    elementHandle = isStringSelector ? await page.$(selector) : selector;

    if (!elementHandle) {
      console.log(`⚠️ Element not found for selector: ${selector}`);
      return;
    }

    const afterScrollDelay = 25 + Math.random() * 25;

    try {
      await cursor.scrollIntoView(elementHandle, {
        scrollSpeed,
        scrollDelay: afterScrollDelay,
      });
    } catch (err) {
      console.log("⚠️ cursor.scrollIntoView failed, using fallback");

      const box = await elementHandle.boundingBox();
      if (!box) return;

      const totalScroll = box.y;
      const stepHeight = 72 + Math.random() * 20; // Random: 72–90 px
      const steps = Math.ceil(totalScroll / stepHeight);
      const triggerEvery = Math.floor(5 + Math.random() * 3); // Random: 5–7

      for (let i = 0; i < steps; i++) {
        const progress = i / steps;
        const inertiaFactor = 1 - Math.pow(progress, 2); // ease out
        const delay = 15 + Math.random() * 25 + inertiaFactor * 30;

        const deltaY = stepHeight * (0.9 + Math.random() * 0.2); // ~±10%
        const deltaX = (Math.random() - 0.5) * 4; // jitter [-2, 2]

        await page.mouse.wheel({ deltaY, deltaX });

        if (i % triggerEvery === 0) {
          await page.evaluate(
            (el, dy, dx) => {
              el.dispatchEvent(
                new WheelEvent("wheel", {
                  bubbles: true,
                  cancelable: true,
                  deltaY: dy,
                  deltaX: dx,
                })
              );
            },
            elementHandle,
            deltaY,
            deltaX
          );
        }

        await sleep(delay);
      }
    }
  } catch (error) {
    console.error(
      `Error while scrollIntoView selector "${selector}":`,
      error.message
    );
  }
};

export default scrollIntoView;
