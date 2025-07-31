/*
 *
 * Helper: `humanClick`.
 *
 */
import sleep from "./sleep.mjs";
import humanMouseMove from "./humanMouseMove.mjs";

const defaultOptions = {
  debug: false,
  mode: "default",
};

export const humanBehaviorConfig = {
  fast: {
    moveTime: [370, 430], // milliseconds total
    maxSteps: [14, 18], // fewer steps but still curved
    hoverTime: [75, 95], // short hover
    hesitateTime: [80, 100], // minimal hesitation
    startDistance: [70, 170], // short entrance
  },
  default: {
    moveTime: [540, 720],
    maxSteps: [19, 22],
    hoverTime: [100, 130],
    hesitateTime: [95, 125],
    startDistance: [140, 210],
  },
};

const pickInRange = ([min, max]) => min + Math.random() * (max - min);

const humanClick = async (page, target, options = {}) => {
  const { mode: _mode, debug } = { ...defaultOptions, ...options };

  const mode = _mode === "fast" ? "fast" : "default";

  const config = humanBehaviorConfig[mode];

  const moveTime = pickInRange(config.moveTime);
  const hoverTime = pickInRange(config.hoverTime);
  const hesitateTime = pickInRange(config.hesitateTime);
  const pressTime = 130 + Math.random() * 50;
  const startDistance = pickInRange(config.startDistance);
  const maxSteps = Math.floor(pickInRange(config.maxSteps));

  let element = target;
  if (typeof target === "string") {
    element = await page.$(target);
    if (!element) {
      console.log(`humanClick: Element ${target} not found`);
      return;
    }
  }

  const box = await element.boundingBox();
  if (!box) {
    console.log(`humanClick: Element ${target} has no bounding box`);
    return;
  }

  const end = {
    x: box.x + box.width / 2 + (Math.random() - 0.5) * 6,
    y: box.y + box.height / 2 + (Math.random() - 0.5) * 6,
  };

  const startOffsetAngle = Math.random() * 2 * Math.PI;
  const eased = Math.sqrt(Math.random()); // bias toward smaller
  const actualDistance = startDistance * eased;

  const start = {
    x: end.x + Math.cos(startOffsetAngle) * actualDistance,
    y: end.y + Math.sin(startOffsetAngle) * actualDistance,
  };

  await humanMouseMove({
    page,
    start,
    end,
    moveTime,
    maxSteps,
  });

  if (Math.random() < 0.55) {
    const settleX = end.x + (Math.random() - 0.5) * 1.2;
    const settleY = end.y + (Math.random() - 0.5) * 1.2;
    await page.mouse.move(settleX, settleY, { steps: 2 });
    await sleep(5 + Math.random() * 8);
  }

  await element.hover();
  await sleep(hoverTime);
  await sleep(hesitateTime);

  await page.mouse.down();
  await sleep(pressTime);
  await page.mouse.up();

  if (debug) {
    console.log("CLICK_STATS", {
      mode,
      moveTime,
      hoverTime,
      hesitateTime,
      pressTime,
      maxSteps,
      startDistance,
      start,
      end,
    });
  }
};

export default humanClick;
