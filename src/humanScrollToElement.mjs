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
  if (isPageUsingStrictRecaptchaMode) {
    const box = await elementHandle.boundingBox();
    if (!box) {
      console.log("❌ humanScrollToElement: Element bounding box not found.");
      return;
    }

    const targetY = box.y;
    const scrollStep = 35 + Math.random() * 20;

    let currentY = await page.evaluate(() => window.scrollY);

    while (currentY < targetY - 10) {
      const deltaY = Math.min(scrollStep, targetY - currentY);
      await page.mouse.wheel({ deltaY });
      await sleep(10 + Math.random() * 10);
      currentY += deltaY;
    }

    await sleep(15 + Math.random() * 10);

    await elementHandle.evaluate((el) => {
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    });

    return;
  }

  await elementHandle.scrollIntoViewIfNeeded({ timeout: 3000 });
};

export default humanScrollToElement;
