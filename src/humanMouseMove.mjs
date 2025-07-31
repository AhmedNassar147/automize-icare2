/*
 *
 * Helper: `humanMouseMove`.
 *
 * Helper: Move mouse from point A to B like a human (with noise, pauses, corrections).
 */

import sleep from "./sleep.mjs";

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

const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

const humanMouseMove = async ({
  page,
  start,
  end,
  moveTime,
  maxSteps,
  delayAfterDone,
}) => {
  if (!page || !start || !end || typeof page.mouse?.move !== "function") {
    console.log("humanMouseMove: invalid page or coordinates");
    return;
  }

  const _maxSteps = maxSteps || 12;
  const _moveTime = moveTime ? moveTime : 20 + Math.random() * 80;

  const cp1 = jitter(
    start.x + (end.x - start.x) / 3,
    start.y + (end.y - start.y) / 3,
    37
  );

  const cp2 = jitter(
    start.x + ((end.x - start.x) * 2) / 3,
    start.y + ((end.y - start.y) * 2) / 3,
    37
  );

  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const steps = Math.min(
    _maxSteps,
    Math.max(13, Math.round(distance / 9) + Math.floor(Math.random() * 3))
  );

  const delay = _moveTime / steps;

  console.log("steps", steps);

  let last = start;
  for (let i = 0; i <= steps; i++) {
    const tLinear = i / steps;
    const t = easeInOutQuad(tLinear); // 👈 Use eased progress

    const { x, y } = bezier(start, cp1, cp2, end, t);

    if (Math.random() < 0.05 && i > 1 && i < steps - 1) {
      await sleep(4 + Math.random() * 6);
    }

    const jitteredDelay = delay * (0.85 + Math.random() * 0.3);
    await page.mouse.move(x, y);
    last = { x, y };
    await sleep(jitteredDelay);
  }

  const dist = Math.hypot(end.x - last.x, end.y - last.y);

  if (dist > 2) {
    const correctionSteps = Math.min(8, Math.max(3, Math.round(dist / 2)));
    await page.mouse.move(end.x, end.y, { steps: correctionSteps });
  }

  if (Math.random() < 0.5) {
    const settleX = end.x + (Math.random() - 0.5) * 1.2;
    const settleY = end.y + (Math.random() - 0.5) * 1.2;
    await sleep(5 + Math.random() * 10);
    await page.mouse.move(settleX, settleY, { steps: 2 });
  }

  if (delayAfterDone) {
    await sleep(delayAfterDone);
  }
};

export default humanMouseMove;
