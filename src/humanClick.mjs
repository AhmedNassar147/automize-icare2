/*
 *
 * Helper: `humanClick`.
 *
 */
import sleep from "./sleep.mjs";
import humanMouseMove from "./humanMouseMove.mjs";

const defaultOptions = {
  log: false,
  moveTime: 680,
  maxSteps: 20,
  hesitateTime: 130,
  hoverTime: 130,
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

  const moveTime = _moveTime + Math.random() * 110; // 670–780 ms
  const hoverTime = _hoverTime + Math.random() * 30; // 130–160 ms
  const hesitate = _hesitateTime + Math.random() * 30; // 130–160 ms
  const pressTime = 150 + Math.random() * 30; // 150–180 ms

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

  const start = {
    x: 100 + Math.random() * 500,
    y: 100 + Math.random() * 480,
  };

  const end = {
    x: box.x + box.width / 2 + (Math.random() - 0.5) * 6,
    y: box.y + box.height / 2 + (Math.random() - 0.5) * 6,
  };

  await humanMouseMove({
    page,
    start,
    end,
    moveTime,
    maxSteps,
    useTinyFlicksAtEnd: false,
  });

  if (Math.random() < 0.5) {
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
    });
  }
};

export default humanClick;
