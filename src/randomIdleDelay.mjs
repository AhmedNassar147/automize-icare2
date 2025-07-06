import sleep from "./sleep.mjs";

/*
 *
 * Helper: `randomIdleDelay`.
 *
 */
const randomIdleDelay = async () => await sleep(100 + Math.random() * 200);

export default randomIdleDelay;
