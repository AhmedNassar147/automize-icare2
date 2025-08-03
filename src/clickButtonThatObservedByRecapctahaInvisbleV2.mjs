/*
 *
 * Helper: `clickButtonThatObservedByRecapctahaInvisbleV2`.
 *
 */
const clickButtonThatObservedByRecapctahaInvisbleV2 = async (
  cursor,
  buttonElementHandle
) => {
  const box = await buttonElementHandle.boundingBox();
  if (!box) {
    console.warn("Button bounding box not found.");
    return;
  }

  // Move cursor over the button with realistic human-like motion
  await cursor.move(buttonElementHandle, {
    moveDelay: 300 + Math.random() * 300,
    randomizeMoveDelay: true,
    overshootThreshold: 500,
  });

  // Human-like click on the element
  await cursor.click(buttonElementHandle, {
    hesitate: 100 + Math.random() * 200,
    waitForClick: 100 + Math.random() * 150,
    randomizeMoveDelay: true,
  });
};
export default clickButtonThatObservedByRecapctahaInvisbleV2;
