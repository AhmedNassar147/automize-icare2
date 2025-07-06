/*
 *
 * Helper: `randomIdleDelay`.
 *
 */
const randomIdleDelay = async () => {
  const delay = 250 + Math.random() * 400;
  await new Promise((r) => setTimeout(r, delay));
};

export default randomIdleDelay;
