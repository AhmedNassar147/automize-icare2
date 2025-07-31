/*
 *
 * Helper: `humanClick`.
 *
 */
import sleep from "./sleep.mjs";
import humanMouseMove from "./humanMouseMove.mjs";

const defaultOptions = {
  log: false,
  moveTime: 400,
  maxSteps: 14,
  hoverTime: 80,
  hesitateTime: 90,
};

const humanClick = async (page, target, options = {}) => {
  const {
    log,
    moveTime: _moveTime,
    hoverTime: _hoverTime,
    hesitateTime: _hesitateTime,
    maxSteps,
  } = {
    ...defaultOptions,
    ...options,
  };

  const moveTime = _moveTime + Math.random() * 100;
  const hoverTime = _hoverTime + Math.random() * 25;
  const hesitate = _hesitateTime + Math.random() * 25;
  const pressTime = Math.round(
    90 + (Math.random() - 0.5) * 40 + (Math.random() - 0.5) * 20
  );

  let element = target;
  if (typeof target === "string") {
    element = await page.$(target);
    if (!element) {
      console.log(`humanClick: Element ${target} not found on the page.`);
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
  const t = Math.random();
  const eased = Math.sqrt(t); // Bias toward smaller values
  const startDistance = 90 + eased * 220;

  const start = {
    x: end.x + Math.cos(startOffsetAngle) * startDistance,
    y: end.y + Math.sin(startOffsetAngle) * startDistance,
  };

  await humanMouseMove({
    page,
    start,
    end,
    moveTime,
    maxSteps,
  });

  if (Math.random() < 0.3) {
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

    await page.mouse.move(settleX, settleY, { steps: 2 });
    await sleep(8 + Math.random() * 10);
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
    });
  }
};

export default humanClick;
