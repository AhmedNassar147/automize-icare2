/*
 *
 * Helper: `makeKeyboardNoise`.
 *
 */
import sleep from "./sleep.mjs";

const makeKeyboardNoise = async (page, noArrow) => {
  // Simulate user interaction
  await page.keyboard.press("Tab");

  await sleep(15 + Math.random() * 10);

  if (!noArrow) {
    await page.keyboard.press("ArrowDown");
  }
};

export default makeKeyboardNoise;
