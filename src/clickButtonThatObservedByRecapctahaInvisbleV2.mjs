/*
 *
 * Helper: `clickButtonThatObservedByRecapctahaInvisbleV2`.
 *
 */
import sleep from "./sleep.mjs";

const bezierCurvePoints = (p0, p1, p2, p3, steps = 16) => {
  const points = [];
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const x =
      Math.pow(1 - t, 3) * p0.x +
      3 * Math.pow(1 - t, 2) * t * p1.x +
      3 * (1 - t) * Math.pow(t, 2) * p2.x +
      Math.pow(t, 3) * p3.x;

    const y =
      Math.pow(1 - t, 3) * p0.y +
      3 * Math.pow(1 - t, 2) * t * p1.y +
      3 * (1 - t) * Math.pow(t, 2) * p2.y +
      Math.pow(t, 3) * p3.y;

    points.push({ x, y });
  }
  return points;
};

const moveMouseWithCurve = async (
  page,
  from,
  to,
  curveStrength = 60,
  steps = 16
) => {
  const control1 = {
    x: from.x + (Math.random() - 0.5) * curveStrength,
    y: from.y + (Math.random() - 0.5) * curveStrength,
  };

  const control2 = {
    x: to.x + (Math.random() - 0.5) * curveStrength,
    y: to.y + (Math.random() - 0.5) * curveStrength,
  };

  const points = bezierCurvePoints(from, control1, control2, to, steps);
  for (const pt of points) {
    await page.mouse.move(pt.x, pt.y);
    await sleep(5 + Math.random() * 8);
    if (Math.random() < 0.25) {
      await sleep(5 + Math.random() * 5);
    }
  }
};

const fireMovementEvent = async (page, finalPoint) => {
  await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return;

      el.dispatchEvent(
        new MouseEvent("mouseover", { clientX: x, clientY: y, bubbles: true })
      );
      el.dispatchEvent(
        new MouseEvent("mouseenter", { clientX: x, clientY: y, bubbles: false })
      );
      el.dispatchEvent(
        new MouseEvent("mousemove", { clientX: x, clientY: y, bubbles: true })
      );
    },
    { x: finalPoint.x, y: finalPoint.y }
  );
};

const fireMouseEvent = async (page, eventName, finalClick) => {
  await page.evaluate(
    (eventName, { x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (el) {
        el.dispatchEvent(
          new MouseEvent(eventName, {
            bubbles: true,
            cancelable: true,
            clientX: x,
            clientY: y,
          })
        );
      }
    },
    eventName,
    finalClick
  );
};

export const clickButtonThatObservedByRecapctahaInvisbleV2 = async (
  page,
  buttonElementHandle
) => {
  const box = await buttonElementHandle.boundingBox();
  if (!box) {
    console.warn("Button bounding box not found.");
    return;
  }

  const center = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };

  const start = {
    x: center.x + (Math.random() - 0.5) * 100,
    y: box.y - 180 + Math.random() * 60,
  };

  const insideTargets = [
    { x: box.x + 10, y: center.y },
    { x: box.x + box.width - 10, y: center.y },
    { x: center.x, y: box.y + 4 },
    { x: center.x, y: box.y + box.height - 6 },
  ];
  const randomInside =
    insideTargets[Math.floor(Math.random() * insideTargets.length)];

  await sleep(3 + Math.random() * 5);

  // Step 1: Move from start to center
  await moveMouseWithCurve(
    page,
    start,
    center,
    45,
    20 + (Math.random() < 0.45 ? 1 : 0)
  );

  await sleep(15 + Math.random() * 20);

  // Step 2: Move to random inside target
  await moveMouseWithCurve(
    page,
    center,
    randomInside,
    12,
    11 + Math.floor(Math.random() * 4)
  );
  await fireMovementEvent(page, randomInside);
  await sleep(5 + Math.random() * 8);

  // Optional micro jitter again
  if (Math.random() < 0.8) {
    console.log("Optional micro jitter again (done)");
    await page.mouse.move(
      randomInside.x + (Math.random() - 0.5) * 2,
      randomInside.y + (Math.random() - 0.5) * 2
    );
  }

  await sleep(10 + Math.random() * 10);

  const finalClick = {
    x: center.x + (Math.random() - 0.5) * 3,
    y: center.y + (Math.random() - 0.5) * 3,
  };

  finalClick.x = Math.min(Math.max(finalClick.x, box.x), box.x + box.width);
  finalClick.y = Math.min(Math.max(finalClick.y, box.y), box.y + box.height);

  // Step 3: Settle back to center
  await moveMouseWithCurve(
    page,
    randomInside,
    finalClick,
    16,
    13 + Math.floor(Math.random() * 4)
  );

  await buttonElementHandle.hover(); // Step 1
  await fireMovementEvent(page, finalClick); // Step 2
  await page.mouse.move(finalClick.x, finalClick.y); // Step 3
  await sleep(60 + Math.random() * 40); // Step 4

  const holdTime = 90 + Math.random() * (Math.random() < 0.3 ? 120 : 70);

  await fireMouseEvent(page, "mousedown", finalClick);
  await sleep(5 + Math.random() * 8);
  await page.mouse.down();
  await sleep(holdTime); // simulate holding

  await fireMouseEvent(page, "mouseup", finalClick);
  await sleep(20 + Math.random() * 20);
  await page.mouse.up();
  await fireMouseEvent(page, "click", finalClick);
};

export default clickButtonThatObservedByRecapctahaInvisbleV2;
