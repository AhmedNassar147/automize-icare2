/*
 *
 * Helper: `humanMouseMove`.
 *
 * Helper: Move mouse from point A to B like a human (with noise, pauses, corrections).
 */
const humanMouseMove = async (cursor, start, end, options) => {
  // Move to start if needed
  await cursor.moveTo(start);

  await cursor.moveTo(end, {
    moveDelay: 40 + Math.random() * 50, // time between points in ms
    randomizeMoveDelay: 5, // adds ± up to 5ms randomness
    moveSpeed: 0.5, // lower is slower (0.1 to 1 is reasonable),
    ...(options || {}),
  });
};

export default humanMouseMove;
