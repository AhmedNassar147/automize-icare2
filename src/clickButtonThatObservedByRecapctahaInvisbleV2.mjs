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
      await sleep(10 + Math.random() * 20);
    }
  }
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

  await sleep(15 + Math.random() * 10);

  // Pre-hover shake (optional)
  if (Math.random() < 0.6) {
    console.log("Pre-hover shake (done)");
    await page.mouse.move(start.x + 2, start.y + 1);
    await sleep(6 + Math.random() * 6);
    await page.mouse.move(start.x - 1, start.y - 2);
    await sleep(6 + Math.random() * 6);
  }

  // Step 1: Move from start to center
  await moveMouseWithCurve(
    page,
    start,
    center,
    55,
    21 + Math.floor(Math.random() * 4)
  );
  await sleep(30 + Math.random() * 25);

  // Optional: Micro jitter
  if (Math.random() < 0.7) {
    console.log("Optional: Micro jitter (done)");
    await page.mouse.move(
      center.x + (Math.random() - 0.5) * 1.2,
      center.y + (Math.random() - 0.5) * 1.2
    );
    await sleep(5 + Math.random() * 5);
  }

  // Fire hover
  await buttonElementHandle.hover();
  await sleep(70 + Math.random() * 40);

  // Step 2: Move to random inside target
  await moveMouseWithCurve(
    page,
    center,
    randomInside,
    25,
    11 + Math.floor(Math.random() * 6)
  );
  await sleep(25 + Math.random() * 30);

  // Optional micro jitter again
  if (Math.random() < 0.4) {
    console.log("Optional micro jitter again (done)");
    await page.mouse.move(
      randomInside.x + (Math.random() - 0.5) * 2,
      randomInside.y + (Math.random() - 0.5) * 2
    );
    await sleep(10 + Math.random() * 5);
  }

  // Simulate human decision delay
  await sleep(40 + Math.random() * 30);

  // Step 3: Settle back to center
  await moveMouseWithCurve(
    page,
    randomInside,
    center,
    10,
    8 + Math.floor(Math.random() * 5)
  );
  await sleep(20 + Math.random() * 20);

  // Final micro positioning
  const finalClick = {
    x: center.x + (Math.random() - 0.5) * 3,
    y: center.y + (Math.random() - 0.5) * 3,
  };
  await page.mouse.move(finalClick.x, finalClick.y);

  await page.evaluate(
    ({ x, y }) => {
      const evt = new MouseEvent("mousemove", {
        clientX: x,
        clientY: y,
        bubbles: true,
      });
      document.elementFromPoint(x, y)?.dispatchEvent(evt);
    },
    { x: finalClick.x, y: finalClick.y }
  );
  await sleep(5 + Math.random() * 10);

  const holdTime = 90 + Math.random() * 65;
  await page.mouse.down();
  await sleep(holdTime);
  await page.mouse.up();
};

export default clickButtonThatObservedByRecapctahaInvisbleV2;
