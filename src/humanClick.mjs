/*
 *
 * Helper: `humanClick`.
 *
 */
import sleep from "./sleep.mjs";

// const humanClick = async (page, cursor, selectorOrElementHandle) => {
//   try {
//     let elementHandle = selectorOrElementHandle;

//     if (typeof selectorOrElementHandle === "string") {
//       try {
//         await page.waitForSelector(selectorOrElementHandle, {
//           visible: true,
//           timeout: 4000,
//         });

//         elementHandle = await page.$(selectorOrElementHandle);
//       } catch (error) {
//         console.log(
//           `Element ${selectorOrElementHandle} not found when waiting for selector=${selectorOrElementHandle}, (humanClick)`
//         );
//       }
//     }

//     if (!elementHandle) {
//       console.log(`Element ${selectorOrElementHandle} not found, (humanClick)`);
//       return;
//     }

//     const box = await elementHandle.boundingBox();

// if (!box) {
//   console.log(
//     `Element ${selectorOrElementHandle} not found (no box), (humanClick)`
//   );
//   return;
// }

//     const moveDelay = 7 + Math.random() * 10;

//     // Move to and click submit
//     await cursor.click(elementHandle, {
//       clickCount: 1,
//       moveDelay: moveDelay,
//       randomizeMoveDelay: true,
//       radius: 3,
//       hesitate: 3 + Math.random() * 12,
//       waitForClick: 3 + Math.random() * 10,
//     });
//   } catch (error) {
//     console.log(
//       `❌ humanClick error for selector "${selectorOrElementHandle}":`,
//       error
//     );
//   }
// };

// export default humanClick;

/**
 * Generate a random point near a given point (small noise).
 */
const jitter = (x, y, range = 3) => ({
  x: x + (Math.random() - 0.5) * range * 2,
  y: y + (Math.random() - 0.5) * range * 2,
});

/**
 * Cubic Bezier interpolation.
 */
const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return {
    x:
      u ** 3 * p0.x +
      3 * u ** 2 * t * p1.x +
      3 * u * t ** 2 * p2.x +
      t ** 3 * p3.x,
    y:
      u ** 3 * p0.y +
      3 * u ** 2 * t * p1.y +
      3 * u * t ** 2 * p2.y +
      t ** 3 * p3.y,
  };
};

const humanClick = async (page, target, log) => {
  const moveTime = 640 + Math.random() * 10;
  const hoverTime = 190 + Math.random() * 10;
  const hesitate = 150 + Math.random() * 10;
  const pressTime = 160 + Math.random() * 10;

  let element = target;
  if (typeof target === "string") {
    element = await page.$(target);

    if (!element) {
      console.log(`Element ${target} not found, (humanClick)`);
      return;
    }
  }

  const box = await element.boundingBox();

  if (!box) {
    console.log(`Element ${target} not found (no box), (humanClick)`);
    return;
  }

  const start = {
    x: 100 + Math.random() * 90,
    y: 100 + Math.random() * 90,
  };

  const end = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };

  const cp1 = jitter(
    start.x + (end.x - start.x) / 3,
    start.y + (end.y - start.y) / 3,
    50
  );
  const cp2 = jitter(
    start.x + ((end.x - start.x) * 2) / 3,
    start.y + ((end.y - start.y) * 2) / 3,
    50
  );

  const steps = 36;
  const delay = moveTime / steps;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { x, y } = bezier(start, cp1, cp2, end, t);
    await page.mouse.move(x, y);
    await sleep(delay);
  }

  await sleep(hoverTime);
  await sleep(hesitate);

  await page.mouse.down();
  await sleep(pressTime);
  await page.mouse.up();

  if (log) {
    console.log("CLICK_OPTIONS", {
      moveTime,
      hoverTime,
      hesitate,
      pressTime,
    });
  }
};

export default humanClick;
