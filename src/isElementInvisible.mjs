/*
 *
 * Helper: `isElementInvisible`.
 *
 */
const isElementInvisible = async (element, viewportHeight, margin = 10) => {
  const box = await element.boundingBox();
  return !box || box.y < -margin || box.y > viewportHeight + margin;
};

export default isElementInvisible;
