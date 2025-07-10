/*
 *
 * Helper: `humanMouseMove`.
 *
 * Helper: Move mouse from point A to B like a human (with noise, pauses, corrections).
 */
const humanMouseMove = async (cursor, start, end, options) => {
  // Move to start if needed
  await cursor.moveTo([start, end], {
    moveDelay: 3 + Math.random() * 30,
    randomizeMoveDelay: true,
    moveSpeed: 0.7 + Math.random(),
    ...(options || {}),
  });
};

export default humanMouseMove;
