/*
 *
 * Helper: `moveFromCurrentToRandomPosition`.
 *
 */
import humanMouseMove from "./humanMouseMove.mjs";
import randomIdleDelay from "./randomIdleDelay.mjs";

const moveFromCurrentToRandomPosition = async (cursor) => {
  const start = cursor.getLocation();

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
  await humanMouseMove(cursor, start, midPoint);

  // Step 2: Move from midpoint to final point
  await humanMouseMove(cursor, midPoint, end);

  // Small final pause
  if (Math.random() > 0.3) {
    await randomIdleDelay();
  }
};

export default moveFromCurrentToRandomPosition;
