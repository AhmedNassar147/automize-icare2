/*
 *
 * Helper: `moveFromCurrentToRandomPosition`.
 *
 */
import humanMouseMove from "./humanMouseMove.mjs";
import randomIdleDelay from "./randomIdleDelay.mjs";

const moveFromCurrentToRandomPosition = async (cursor) => {
  const start = cursor.getPosition();

  // Random offset direction and distance
  const offsetX = (Math.random() > 0.5 ? 1 : -1) * (80 + Math.random() * 60);
  const offsetY = (Math.random() > 0.5 ? 1 : -1) * (120 + Math.random() * 100);

  const end = {
    x: start.x + offsetX,
    y: start.y + offsetY,
  };

  // Optional mid-point to avoid linear path
  const midPoint = {
    x: start.x + offsetX * 0.5 + (Math.random() - 0.5) * 40,
    y: start.y + offsetY * 0.5 + (Math.random() - 0.5) * 40,
  };

  // Step 1: Move to midpoint with human noise
  await humanMouseMove(cursor, start, midPoint, {
    moveDelay: 30 + Math.random() * 30,
    randomizeMoveDelay: 5 + Math.random() * 5,
    moveSpeed: 0.5 + Math.random() * 0.2,
  });

  // Step 2: Move from midpoint to final point
  await humanMouseMove(cursor, midPoint, end, {
    moveDelay: 30 + Math.random() * 40,
    randomizeMoveDelay: 4 + Math.random() * 4,
    moveSpeed: 0.6 + Math.random() * 0.2,
  });

  // Small final pause
  if (Math.random() > 0.3) {
    await randomIdleDelay();
  }
};

export default moveFromCurrentToRandomPosition;
