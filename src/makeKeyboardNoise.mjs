/*
 *
 * Helper: `makeKeyboardNoise`.
 *
 */
import sleep from "./sleep.mjs";

const makeKeyboardNoise = async (page, logString) => {
  console.log(`✅ click tabs and arrows in ${logString}`);
  // Simulate user interaction
  await page.keyboard.press("Tab");
  await sleep(30 + Math.random() * 25);
  await page.keyboard.press("ArrowDown");
};

export default makeKeyboardNoise;
