/*
 *
 * Helper: `generateRandomInt`.
 *
 */
const generateRandomInt = (min = 10000, max = 15000, step = 1000) => {
  const start = Math.ceil(min / step);
  const end = Math.floor(max / step);
  if (end < start) throw new Error("No multiples in range");
  const k = Math.floor(Math.random() * (end - start + 1)) + start;
  return k * step;
};

export default generateRandomInt;
