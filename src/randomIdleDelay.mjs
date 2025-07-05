/*
 *
 * Helper: `randomIdleDelay`.
 *
 */
const randomIdleDelay = async () => {
  const delay = 300 + Math.random() * 500;
  await new Promise((r) => setTimeout(r, delay));
};

export default randomIdleDelay;
