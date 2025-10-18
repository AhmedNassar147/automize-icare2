/*
 *
 * Helper: `generateRandomMs`.
 *
 */
const generateRandomMs = (min = 9500, max = 14400) => {
  if (min > max) [min, max] = [max, min]; // swap if reversed
  min = Math.floor(min);
  max = Math.floor(max); // ms as integers
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

export default generateRandomMs;
