/*
 *
 * Helper: `scrollIntoView`.
 *
 */
import sleep from "./sleep.mjs";

const scrollIntoView = async (page, cursor, selector, options = {}) => {
  // Randomize delay and speed unless provided
  const scrollDelay = options.scrollDelay ?? 50 + Math.random() * 150;
  const scrollSpeed = options.scrollSpeed ?? 0.3 + Math.random() * 0.5;
  const waitForSelector = options.waitForSelector ?? true;

  try {
    if (waitForSelector) {
      await page.waitForSelector(selector, { timeout: 15000 });
    }

    const elementHandle = await page.$(selector);
    if (!elementHandle) {
      console.log(`Element not found for selector: ${selector}`);
      return;
    }

    await sleep(Math.random() * 700);

    await cursor.scrollIntoView(elementHandle, {
      scrollDelay,
      scrollSpeed,
    });
  } catch (error) {
    console.log(`❌ scrollIntoView error for selector "${selector}":`, error);
  }
};

export default scrollIntoView;
