/*
 *
 * Helper: `humanClick`.
 *
 */
import humanMouseMove from "./humanMouseMove.mjs";
import maybeDoSomethingHuman from "./maybeDoSomethingHuman.mjs";

const humanClick = async (page, cursor, selectorOrElementHandle) => {
  try {
    let elementHandle = selectorOrElementHandle;

    if (typeof selectorOrElementHandle === "string") {
      try {
        await page.waitForSelector(selectorOrElementHandle, {
          visible: true,
          timeout: 2000,
        });

        elementHandle = await page.$(selectorOrElementHandle);
      } catch (error) {
        console.log(
          `Element ${selectorOrElementHandle} not found when waiting for selector=${selectorOrElementHandle}, (humanClick)`
        );
      }
    }

    if (!elementHandle) {
      console.log(`Element ${selectorOrElementHandle} not found, (humanClick)`);
      return;
    }

    await maybeDoSomethingHuman(cursor, 0.4);

    const box = await elementHandle.boundingBox();

    if (!box) {
      console.log(
        `Element ${selectorOrElementHandle} not found (no box), (humanClick)`
      );
      return;
    }

    const target = {
      x: box.x + box.width / 2 + (Math.random() * 4 - 2),
      y: box.y + box.height / 2 + (Math.random() * 4 - 2),
    };

    // Optional: move from a random point on screen
    const screenStart = {
      x: Math.random() * 300 + 100,
      y: Math.random() * 300 + 100,
    };

    await humanMouseMove(cursor, screenStart, target);

    const moveDelay = 40 + Math.random() * 40;

    // Move to and click submit
    await cursor.click(elementHandle, {
      clickCount: 1,
      moveDelay: moveDelay,
      randomizeMoveDelay: moveDelay * 0.4,
      radius: 4,
      hesitate: 15,
    });
  } catch (error) {
    console.log(
      `❌ humanClick error for selector "${selectorOrElementHandle}":`,
      error
    );
  }
};

export default humanClick;
