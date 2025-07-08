/*
 *
 * Helper: `randomIdleDelay`.
 *
 */
import sleep from "./sleep.mjs";

const randomIdleDelay = async () => await sleep(120 + Math.random() * 100);

export default randomIdleDelay;
