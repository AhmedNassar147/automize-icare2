/*
 *
 * Helper: `randomIdleDelay`.
 *
 */
const randomIdleDelay = async () => {
  const delay = 150 + Math.random() * 300;
  await new Promise((r) => setTimeout(r, delay));
};

export default randomIdleDelay;
