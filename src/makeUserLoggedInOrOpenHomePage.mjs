/*
 *
 * helper: `makeUserLoggedInOrOpenHomePage`.
 *
 */
import { createCursor } from "ghost-cursor";
import checkIfLoginPage from "./checkIfLoginPage.mjs";
import humanType from "./humanType.mjs";
import humanMouseMove from "./humanMouseMove.mjs";
import humanClick from "./humanClick.mjs";
import randomIdleDelay from "./randomIdleDelay.mjs";
import randomMouseJitter from "./randomMouseJitter.mjs";
import maybeDoSomethingHuman from "./maybeDoSomethingHuman.mjs";
import scrollIntoView from "./scrollIntoView.mjs";
import { dashboardLinkSelector } from "./constants.mjs";
import sleep from "./sleep.mjs";

const ONE_AND_HALF_MINUTE_DELAY_MS = 1.5 * 60 * 1000;
const loginButtonSelector = 'button[name="Input.Button"][value="login"]';

const makeUserLoggedInOrOpenHomePage = async (
  browser,
  _cursor,
  currentPage
) => {
  const userName = process.env.CLIENT_NAME;
  const password = process.env.CLIENT_PASSWORD;
  let page = currentPage;
  let pageLoaded = !!currentPage;

  if (!currentPage) {
    page = await browser.newPage();
  }

  const cursor = !!(_cursor && currentPage) ? _cursor : createCursor(page);

  try {
    await page.waitForFunction(() => window.innerWidth > 0, {
      timeout: ONE_AND_HALF_MINUTE_DELAY_MS,
    });
  } catch (error) {
    console.log(
      `❌ Failed to wait for window.innerWidth > 0: ${error.message}`
    );
  }

  if (!pageLoaded) {
    try {
      await page.goto("https://referralprogram.globemedsaudi.com", {
        waitUntil: "networkidle2",
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS,
      });

      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS,
      });

      pageLoaded = true;
    } catch (error) {
      pageLoaded = false;
      console.log(`❌ Failed to load page: ${error.message}`);
      return [page, cursor, false];
    }
  }

  await sleep(900);
  if (!pageLoaded) return [page, cursor, false];

  const isLoginPage = await checkIfLoginPage(page);
  let isThereErrorWhenTryingToLogin = false;

  if (!isLoginPage) {
    await randomMouseJitter(cursor, 2);
  }

  if (isLoginPage) {
    try {
      const loginApiWaitPromise = page.waitForResponse(
        (response) => {
          const url = response.url();
          const status = response.status();
          const method = response.request().method();
          return (
            url.includes("/Account/Login") &&
            status === 200 &&
            method === "POST"
          );
        },
        { timeout: ONE_AND_HALF_MINUTE_DELAY_MS * 2 }
      );

      await humanType(page, cursor, "#Input_Username", userName);
      await humanType(page, cursor, "#Input_Password", password);

      // SAFELY handle navigation

      await humanClick(page, cursor, loginButtonSelector);

      const navPromise = page.waitForNavigation({
        waitUntil: ["load", "networkidle2"],
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS,
      });

      await navPromise;
      await loginApiWaitPromise;
    } catch (error) {
      isThereErrorWhenTryingToLogin = true;
      console.error(`❌ Login failed for ${userName}: ${error.message}`);
    }
  }

  if (isThereErrorWhenTryingToLogin) return [page, cursor, false];

  try {
    await Promise.race([
      page.waitForURL(/\/dashboard\/referral(\/.*|\?.*)?$/i, {
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS,
      }),
      (async () => {
        try {
          await page.waitForSelector(dashboardLinkSelector, {
            timeout: ONE_AND_HALF_MINUTE_DELAY_MS,
          });

          await maybeDoSomethingHuman(cursor, 0.4);
          // Optional: click to go to dashboard
          // await humanClick(page, cursor, dashboardLinkSelector);
        } catch (innerError) {
          await page.screenshot({
            path: `screenshots/home-link-wait-error-${Date.now()}.png`,
          });
          console.error(
            `❌ Dashboard click failed. URL: ${page.url()}. Error: ${
              innerError.message
            }`
          );
        }
      })(),
    ]);

    await randomMouseJitter(cursor, 1);

    const message = isLoginPage
      ? `✅ User ${userName} logged in successfully and landed on home page.`
      : `✅ User ${userName} already logged in and on home page.`;

    console.log(message);
    return [page, cursor, true];
  } catch (error) {
    await page.screenshot({
      path: `screenshots/login-home-error-${Date.now()}.png`,
    });

    console.error(
      `❌ User ${userName} login succeeded, but failed to detect home page. Current URL: ${page.url()}`
    );
    return [page, cursor, false];
  } finally {
    await randomIdleDelay();
    await humanMouseMove(cursor, { x: 250, y: 300 }, { x: 500, y: 320 });
  }
};

export default makeUserLoggedInOrOpenHomePage;
