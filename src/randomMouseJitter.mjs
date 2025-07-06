/*
 *
 * Helper: `randomMouseJitter`.
 *
 */
import humanMouseMove from "./humanMouseMove.mjs";

const randomSleep = (min, max) =>
  new Promise((res) => setTimeout(res, min + Math.random() * (max - min)));

const randomMouseJitter = async (cursor, jitterCount = 3) => {
  let baseX = 300 + Math.random() * 200;
  let baseY = 200 + Math.random() * 150;

  for (let i = 0; i < jitterCount; i++) {
    // Calculate jitter target with small random offset
    const targetX = baseX + (Math.random() * 10 - 5);
    const targetY = baseY + (Math.random() * 10 - 5);

    // Dynamic speed and delay
    const speed = 0.3 + Math.random() * 0.6; // 0.3 to 1.0
    const moveDelay = 20 + Math.random() * 50;
    const randomizeMoveDelay = 3 + Math.random() * 5;

    await humanMouseMove(
      cursor,
      { x: baseX, y: baseY },
      { x: targetX, y: targetY },
      {
        moveDelay,
        randomizeMoveDelay,
        moveSpeed: speed,
      }
    );

    // Small back-and-forth correction: move back halfway
    if (Math.random() > 0.5) {
      const backX = baseX + (targetX - baseX) / 2 + (Math.random() * 4 - 2);
      const backY = baseY + (targetY - baseY) / 2 + (Math.random() * 4 - 2);

      await humanMouseMove(
        cursor,
        { x: targetX, y: targetY },
        { x: backX, y: backY },
        {
          moveDelay,
          randomizeMoveDelay,
          moveSpeed: speed * 0.5,
        }
      );

      // Then return to jitter point
      await humanMouseMove(
        cursor,
        { x: backX, y: backY },
        { x: targetX, y: targetY },
        {
          moveDelay,
          randomizeMoveDelay,
          moveSpeed: speed,
        }
      );
    }

    // Update base for next jitter to the last point
    baseX = targetX;
    baseY = targetY;

    // Pause between jitters randomly 200–600ms
    await randomSleep(200, 600);
  }
};

export default randomMouseJitter;
