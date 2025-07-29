/*
 *
 * Helper: `makeKeyboardNoise`.
 *
 */
import sleep from "./sleep.mjs";

const makeKeyboardNoise = async (page, noArrow) => {
  // Simulate user interaction
  await page.keyboard.press("Tab");

  await sleep(5 + Math.random() * 5);

  if (!noArrow) {
    await page.keyboard.press("ArrowDown");
  }
};

export default makeKeyboardNoise;
