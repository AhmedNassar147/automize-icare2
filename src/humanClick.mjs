/*
 *
 * Helper: `humanClick`.
 *
 */
const humanClick = async (page, cursor, selectorOrElementHandle) => {
  try {
    let elementHandle = selectorOrElementHandle;

    if (typeof selectorOrElementHandle === "string") {
      try {
        await page.waitForSelector(selectorOrElementHandle, {
          visible: true,
          timeout: 4000,
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

    const box = await elementHandle.boundingBox();

    if (!box) {
      console.log(
        `Element ${selectorOrElementHandle} not found (no box), (humanClick)`
      );
      return;
    }

    const moveDelay = 50 + Math.random() * 30;

    // Move to and click submit
    await cursor.click(elementHandle, {
      clickCount: 1,
      moveDelay: moveDelay,
      randomizeMoveDelay: moveDelay * 0.4,
      radius: 3,
      hesitate: 4,
    });
  } catch (error) {
    console.log(
      `❌ humanClick error for selector "${selectorOrElementHandle}":`,
      error
    );
  }
};

export default humanClick;
