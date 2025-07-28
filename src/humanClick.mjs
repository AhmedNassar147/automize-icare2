/*
 *
 * Helper: `humanClick`.
 *
 */
import sleep from "./sleep.mjs";

// // const humanClick = async (page, cursor, selectorOrElementHandle) => {
// //   try {
// //     let elementHandle = selectorOrElementHandle;

// //     if (typeof selectorOrElementHandle === "string") {
// //       try {
// //         await page.waitForSelector(selectorOrElementHandle, {
// //           visible: true,
// //           timeout: 4000,
// //         });

// //         elementHandle = await page.$(selectorOrElementHandle);
// //       } catch (error) {
// //         console.log(
// //           `Element ${selectorOrElementHandle} not found when waiting for selector=${selectorOrElementHandle}, (humanClick)`
// //         );
// //       }
// //     }

// //     if (!elementHandle) {
// //       console.log(`Element ${selectorOrElementHandle} not found, (humanClick)`);
// //       return;
// //     }

// //     const box = await elementHandle.boundingBox();

// // if (!box) {
// //   console.log(
// //     `Element ${selectorOrElementHandle} not found (no box), (humanClick)`
// //   );
// //   return;
// // }

// //     const moveDelay = 7 + Math.random() * 10;

// //     // Move to and click submit
// //     await cursor.click(elementHandle, {
// //       clickCount: 1,
// //       moveDelay: moveDelay,
// //       randomizeMoveDelay: true,
// //       radius: 3,
// //       hesitate: 3 + Math.random() * 12,
// //       waitForClick: 3 + Math.random() * 10,
// //     });
// //   } catch (error) {
// //     console.log(
// //       `❌ humanClick error for selector "${selectorOrElementHandle}":`,
// //       error
// //     );
// //   }
// // };

// // export default humanClick;

// /**
//  * Generate a random point near a given point (small noise).
//  */
// const jitter = (x, y, range = 3) => ({
//   x: x + (Math.random() - 0.5) * range * 2,
//   y: y + (Math.random() - 0.5) * range * 2,
// });

// /**
//  * Cubic Bezier interpolation.
//  */
// const bezier = (p0, p1, p2, p3, t) => {
//   const u = 1 - t;
//   return {
//     x:
//       u ** 3 * p0.x +
//       3 * u ** 2 * t * p1.x +
//       3 * u * t ** 2 * p2.x +
//       t ** 3 * p3.x,
//     y:
//       u ** 3 * p0.y +
//       3 * u ** 2 * t * p1.y +
//       3 * u * t ** 2 * p2.y +
//       t ** 3 * p3.y,
//   };
// };

// const humanClick = async (page, target, log) => {
// const moveTime = 640 + Math.random() * 10;
// const hoverTime = 190 + Math.random() * 10;
// const hesitate = 150 + Math.random() * 10;
// const pressTime = 160 + Math.random() * 10;

//   let element = target;
//   if (typeof target === "string") {
//     element = await page.$(target);

//     if (!element) {
//       console.log(`Element ${target} not found, (humanClick)`);
//       return;
//     }
//   }

//   const box = await element.boundingBox();

//   if (!box) {
//     console.log(`Element ${target} not found (no box), (humanClick)`);
//     return;
//   }

//   const start = {
//     x: 100 + Math.random() * 90,
//     y: 100 + Math.random() * 90,
//   };

//   const end = {
//     x: box.x + box.width / 2,
//     y: box.y + box.height / 2,
//   };

//   const cp1 = jitter(
//     start.x + (end.x - start.x) / 3,
//     start.y + (end.y - start.y) / 3,
//     50
//   );
//   const cp2 = jitter(
//     start.x + ((end.x - start.x) * 2) / 3,
//     start.y + ((end.y - start.y) * 2) / 3,
//     50
//   );

//   const steps = 36;
//   const delay = moveTime / steps;

//   for (let i = 0; i <= steps; i++) {
//     const t = i / steps;
//     const { x, y } = bezier(start, cp1, cp2, end, t);
//     await page.mouse.move(x, y);
//     await sleep(delay);
//   }

//   await sleep(hoverTime);
//   await sleep(hesitate);

//   await page.mouse.down();
//   await sleep(pressTime);
//   await page.mouse.up();

//   if (log) {
//     console.log("CLICK_OPTIONS", {
//       moveTime,
//       hoverTime,
//       hesitate,
//       pressTime,
//     });
//   }
// };

// export default humanClick;

const jitter = (x, y, range = 3) => ({
  x: x + (Math.random() - 0.5) * range * 2,
  y: y + (Math.random() - 0.5) * range * 2,
});

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

const humanClick = async (page, target, log = false) => {
  const moveTime = 695 + Math.random() * 100; // 695–795 ms
  const hoverTime = 170 + Math.random() * 30; // 170–200 ms
  const hesitate = 160 + Math.random() * 20; // 160–180 ms
  const pressTime = 185 + Math.random() * 40; // 185–225 ms

  let element = target;
  if (typeof target === "string") {
    element = await page.$(target);
    if (!element) {
      console.log(`Element ${target} not found (humanClick)`);
      return;
    }
  }

  const box = await element.boundingBox();
  if (!box) {
    console.log(`Element ${target} has no bounding box`);
    return;
  }

  const end = {
    x: box.x + box.width / 2 + (Math.random() - 0.5) * 6,
    y: box.y + box.height / 2 + (Math.random() - 0.5) * 6,
  };

  const start = {
    x: 100 + Math.random() * 500,
    y: 100 + Math.random() * 300,
  };

  const cp1 = jitter(
    start.x + (end.x - start.x) / 3,
    start.y + (end.y - start.y) / 3,
    40
  );

  const cp2 = jitter(
    start.x + ((end.x - start.x) * 2) / 3,
    start.y + ((end.y - start.y) * 2) / 3,
    40
  );

  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.max(
    20,
    Math.round(distance / 8) + Math.floor(Math.random() * 4)
  );
  const delay = moveTime / steps;

  let last = start;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const { x, y } = bezier(start, cp1, cp2, end, t);
    const jitteredDelay = Math.max(8, delay + Math.random() * 4 - 2);
    await page.mouse.move(x, y);
    last = { x, y };
    await sleep(jitteredDelay);
  }

  const dist = Math.hypot(end.x - last.x, end.y - last.y);

  if (dist > 2) {
    const correctionSteps = Math.min(8, Math.max(3, Math.round(dist / 2)));
    await sleep(20 + Math.random() * 15);
    await page.mouse.move(end.x, end.y, { steps: correctionSteps });
  }

  // 🧠 Micro-settling (with safety clipping)
  if (Math.random() < 0.6) {
    const settleOffsetX = (Math.random() - 0.5) * 1.5;
    const settleOffsetY = (Math.random() - 0.5) * 1.5;

    const settleX = Math.min(
      box.x + box.width,
      Math.max(box.x, end.x + settleOffsetX)
    );
    const settleY = Math.min(
      box.y + box.height,
      Math.max(box.y, end.y + settleOffsetY)
    );

    await sleep(15 + Math.random() * 10);
    await page.mouse.move(settleX, settleY, { steps: 2 });
  }

  await element.hover();
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
      steps,
      finalCorrection: dist > 2,
    });
  }
};

export default humanClick;
