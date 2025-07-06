/*
 *
 * Helper: `humanType`.
 *
 * Helper: Type like a human (with delays, pauses, and real mouse interaction).
 */

import maybeDoSomethingHuman from "./maybeDoSomethingHuman.mjs";
import sleep from "./sleep.mjs";

const humanType = async (page, cursor, selector, text) => {
  try {
    await maybeDoSomethingHuman(cursor, 0.3);

    const elementHandle = await page.$(selector);

    const moveDelay = 30 + Math.random() * 30;

    await cursor.click(elementHandle, {
      clickCount: 2,
      hesitate: 15,
      moveDelay: moveDelay,
      randomizeMoveDelay: moveDelay * 0.3,
      radius: 3,
    });

    const baseTypingDelay = 70 + Math.random() * 50; // 70–120ms per key

    await page.keyboard.type(text, { delay: baseTypingDelay });

    await sleep(150 + Math.random());
  } catch (error) {
    console.log(`❌ humanType error for selector "${selector}":`, error);
  }
};

export default humanType;
