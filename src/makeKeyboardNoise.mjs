/*
 *
 * Helper: `makeKeyboardNoise`.
 *
 */
import sleep from "./sleep.mjs";

const makeKeyboardNoise = async (page, noTab) => {
  // Simulate user interaction
  if (!noTab) {
    await page.keyboard.press("Tab");
    await sleep(30 + Math.random() * 20);
  }

  await page.keyboard.press("ArrowDown");
};

export default makeKeyboardNoise;
