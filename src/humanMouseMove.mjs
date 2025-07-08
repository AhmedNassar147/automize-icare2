/*
 *
 * Helper: `humanMouseMove`.
 *
 * Helper: Move mouse from point A to B like a human (with noise, pauses, corrections).
 */
const humanMouseMove = async (cursor, start, end, options) => {
  // Move to start if needed
  await cursor.moveTo(start, {
    moveDelay: 6 + Math.random(),
    randomizeMoveDelay: true,
    moveSpeed: 0.7 + Math.random() * 0.1,
  });

  await cursor.moveTo(end, {
    moveDelay: 6 + Math.random() * 30, // time between points in ms
    randomizeMoveDelay: true,
    moveSpeed: 0.6 + Math.random() * 0.2, // lower is slower (0.1 to 1 is reasonable),
    ...(options || {}),
  });
};

export default humanMouseMove;
