/*
 *
 * Helper: `humanClick`.
 *
 */
import sleep from "./sleep.mjs";
import humanMouseMove from "./humanMouseMove.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";

const defaultOptions = {
  debug: false,
  mode: "default",
};

export const humanBehaviorConfig = {
  fast: {
    moveTime: [370, 430], // milliseconds total
    hoverTime: [75, 110], // short hover
    hesitateTime: [80, 110], // minimal hesitation
  },
  default: {
    moveTime: [590, 700],
    hoverTime: [105, 130],
    hesitateTime: [110, 130],
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
  const pressTime = 120 + Math.random() * 50;

  let element = target;
  if (typeof target === "string") {
    try {
      element = await page.$(target);
    } catch (error) {
      element = null;
    }
  }

  if (!element) {
    createConsoleMessage(`humanClick: Element ${target} not found`);
    return;
  }

  const box = await element.boundingBox();
  if (!box) {
    createConsoleMessage(`humanClick: Element ${target} has no bounding box`);
    return;
  }

  const end = {
    x: box.x + box.width / 2 + (Math.random() - 0.5) * 6,
    y: box.y + box.height / 2 + (Math.random() - 0.5) * 6,
  };

  const direction = Math.random() < 0.68 ? "top-left" : "top-right";
  const startingXPoint = pickInRange([80, 160]);

  const yOffset =
    Math.random() < 0.15 ? -pickInRange([160, 230]) : -pickInRange([125, 200]);

  const offset = {
    x:
      direction === "top-left"
        ? -startingXPoint + (Math.random() - 0.5) * 15
        : startingXPoint + (Math.random() - 0.5) * 15,
    y: yOffset + (Math.random() - 0.5) * 15,
  };

  const start = {
    x: end.x + offset.x,
    y: end.y + offset.y,
  };

  await humanMouseMove({
    page,
    start,
    end,
    moveTime,
    delayAfterDone: 10 + Math.random() * 15,
  });

  if (Math.random() < 0.55) {
    const settleX = end.x + (Math.random() - 0.5) * 1.2;
    const settleY = end.y + (Math.random() - 0.5) * 1.2;
    await page.mouse.move(settleX, settleY, { steps: 2 });
    await sleep(5 + Math.random() * 8);
  }

  await element?.hover();
  await sleep(hoverTime);
  await sleep(hesitateTime);

  await page.mouse.down();
  await sleep(pressTime);
  await page.mouse.up();

  if (debug) {
    createConsoleMessage(
      {
        mode,
        moveTime,
        hoverTime,
        hesitateTime,
        pressTime,
        start,
        end,
        direction,
      },
      "info",
      "CLICK_STATS"
    );
  }
};

export default humanClick;
