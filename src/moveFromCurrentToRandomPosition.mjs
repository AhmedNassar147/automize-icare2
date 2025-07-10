/*
 *
 * Helper: `moveFromCurrentToRandomPosition`.
 *
 */
import humanMouseMove from "./humanMouseMove.mjs";

const moveFromCurrentToRandomPosition = async (cursor) => {
  const start = cursor.getLocation();

  // Random offset direction and distance
  const offsetX = (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 60);
  const offsetY = (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 100);

  const end = {
    x: start.x + offsetX * 0.5 + (Math.random() - 0.5) * 40,
    y: start.y + offsetY * 0.5 + (Math.random() - 0.5) * 40,
  };

  await humanMouseMove(cursor, start, end);
};

export default moveFromCurrentToRandomPosition;
