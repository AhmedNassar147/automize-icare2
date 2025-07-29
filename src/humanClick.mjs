/*
 *
 * Helper: `humanClick`.
 *
 */
import sleep from "./sleep.mjs";
import humanMouseMove from "./humanMouseMove.mjs";

const humanClick = async (page, target, log = false) => {
  const moveTime = 695 + Math.random() * 100; // 695–795 ms
  const hoverTime = 170 + Math.random() * 30; // 170–200 ms
  const hesitate = 175 + Math.random() * 20; // 170–195 ms
  const pressTime = 190 + Math.random() * 40; // 185–230 ms

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
    y: 100 + Math.random() * 300,
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
    maxSteps: 28,
    useTinyFlicksAtEnd: false,
  });

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
    });
  }
};

export default humanClick;
