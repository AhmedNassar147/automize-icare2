/*
 *
 * Helper: `makeKeyboardNoise`.
 *
 */
import sleep from "./sleep.mjs";

const makeKeyboardNoise = async (page, noArrow) => {
  // Simulate user interaction
  await page.keyboard.press("Tab");

  await sleep(3 + Math.random() * 2);

  if (!noArrow) {
    await page.keyboard.press("ArrowDown");
  }
};

export default makeKeyboardNoise;
