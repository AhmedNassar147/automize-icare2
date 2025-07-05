/*
 *
 * Helper: `maybeDoSomethingHuman`.
 *
 */
import randomIdleDelay from "./randomIdleDelay.mjs";
import randomMouseJitter from "./randomMouseJitter.mjs";

const maybeDoSomethingHuman = async (cursor, probability = 0.8) => {
  if (Math.random() > probability) {
    await randomMouseJitter(cursor, 2);
    await randomIdleDelay();
  }
};

export default maybeDoSomethingHuman;
