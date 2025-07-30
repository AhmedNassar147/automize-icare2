/*
 *
 * Helper: `humanScrollToElement`.
 *
 */
import sleep from "./sleep.mjs";

const humanScrollToElement = async (
  page,
  elementHandle,
  isPageUsingStrictRecaptchaMode
) => {
  if (!isPageUsingStrictRecaptchaMode) {
    await elementHandle
      .scrollIntoViewIfNeeded({ timeout: 3000 })
      .catch(() => {});
    return;
  }

  const box = await elementHandle.boundingBox();
  if (!box) {
    console.log("❌ humanScrollToElement: Element bounding box not found.");
    return;
  }

  const targetY = box.y;

  let currentY = await page.evaluate(() => window.scrollY);

  while (currentY < targetY - 10) {
    const distance = targetY - currentY;

    // Adjust scroll step based on distance — faster when far
    let scrollStep;
    if (distance > 500) {
      scrollStep = 78 + Math.random() * 20;
    } else if (distance > 200) {
      scrollStep = 55 + Math.random() * 15;
    } else {
      scrollStep = 40 + Math.random() * 10;
    }

    const deltaY = Math.min(scrollStep, distance);
    await page.mouse.wheel({ deltaY });
    await sleep(15 + Math.random() * 10);

    currentY += deltaY;
  }

  // if (targetY - currentY < 100) {
  //   await sleep(10 + Math.random() * 8);
  // await elementHandle.evaluate((el) => {
  //   el.scrollIntoView({ behavior: "smooth", block: "end" });
  // });
  // }
};

export default humanScrollToElement;
