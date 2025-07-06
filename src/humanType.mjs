/*
 *
 * Helper: `humanType`.
 *
 * Helper: Type like a human (with delays, pauses, and real mouse interaction).
 */
import sleep from "./sleep.mjs";

const humanType = async (page, cursor, selector, text) => {
  try {
    const elementHandle = await page.$(selector);

    const moveDelay = 30 + Math.random() * 30;

    await cursor.click(elementHandle, {
      clickCount: 1,
      hesitate: 5,
      moveDelay: moveDelay,
      randomizeMoveDelay: moveDelay * 0.3,
      radius: 3,
    });

    const baseTypingDelay = 70 + Math.random() * 70; // 50–120ms per key

    await page.keyboard.type(text, { delay: baseTypingDelay });
    await sleep(80 + Math.random());
  } catch (error) {
    console.log(`❌ humanType error for selector "${selector}":`, error);
  }
};

export default humanType;
