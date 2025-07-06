/*
 *
 * Helper: `navigateToDetailsAndCaptureData`.
 *
 */
import { createCursor } from "ghost-cursor";
import maybeDoSomethingHuman from "./maybeDoSomethingHuman.mjs";
import randomIdleDelay from "./randomIdleDelay.mjs";
import randomMouseJitter from "./randomMouseJitter.mjs";
import humanClick from "./humanClick.mjs";
import sleep from "./sleep.mjs";

const navigateToDetailsAndCaptureData = () => {
  const apiTargets = [
    "/referrals/details",
    "/referrals/patient-info",
    "/referrals/icds",
    "/referrals/cpts",
    "/referrals/attachments",
    "/referrals/attachment-types?languageCode=1",
  ];

  const navigateAndCaptureReferrals = async (page, buttonSelector) => {
    const cursor = createCursor(page);
    const results = {};
    const responses = {};

    // Patch navigator.webdriver = false
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    // Set fingerprint-like behavior
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );
    await page.setViewport({
      width: 1366,
      height: 768 + Math.floor(Math.random() * 50),
    });
    await page.setExtraHTTPHeaders({ "accept-language": "en-US,en;q=0.9" });

    // Passive network listener
    page.on("response", async (response) => {
      const url = response.url();
      const isTarget = apiTargets.some((target) => url.includes(target));
      const isJson = (response.headers()["content-type"] || "").includes(
        "json"
      );

      if (isTarget && isJson && !responses[url]) {
        try {
          const data = await response.json();
          responses[url] = data;
          console.log("✅ Captured:", url);
        } catch (err) {
          console.log("⚠️ Error parsing JSON from:", url);
        }
      }
    });

    await sleep(1000);
    await maybeDoSomethingHuman(cursor, 0.4);
    await randomMouseJitter(cursor, 1);

    const element = await page.$(buttonSelector);
    const box = await element.boundingBox();
    await cursor.move(box.x + 5, box.y + 5, { steps: 10 });
    await sleep(200 + Math.random() * 200);
    await cursor.click();

    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 60000 });
    await maybeDoSomethingHuman(cursor, 0.5);
    await randomIdleDelay();
    await randomMouseJitter(cursor, 2);

    // Sequential wait with jitter for each API response
    const expectedResponses = [];
    for (const target of apiTargets) {
      await sleep(Math.random() * 400 + 200);
      expectedResponses.push(
        page
          .waitForResponse(
            (res) =>
              res.url().includes(target) &&
              (res.request().method() === "POST" ||
                target.includes("attachment-types")) &&
              res.status() === 200,
            { timeout: 20000 }
          )
          .then((res) => res.json())
          .catch(() => null)
      );
    }

    const responsesData = await Promise.all(expectedResponses);

    apiTargets.forEach((url, i) => {
      results[url] = responsesData[i] || responses[url] || null;
    });

    console.log("✅ All data collected");
    return results;
  };
};

export default navigateToDetailsAndCaptureData;
