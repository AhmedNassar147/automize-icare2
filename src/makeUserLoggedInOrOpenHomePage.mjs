/*
 *
 * helper: `makeUserLoggedInOrOpenHomePage`.
 *
 */
import { createCursor } from "ghost-cursor";
import checkIfLoginPage from "./checkIfLoginPage.mjs";
import humanType from "./humanType.mjs";
import humanClick from "./humanClick.mjs";
import moveFromCurrentToRandomPosition from "./moveFromCurrentToRandomPosition.mjs";
import randomIdleDelay from "./randomIdleDelay.mjs";
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

      await sleep(500);

      pageLoaded = true;
    } catch (error) {
      pageLoaded = false;
      console.log(`❌ Failed to load page: ${error.message}`);
      return [page, cursor, false];
    }
  }

  if (!pageLoaded) return [page, cursor, false];

  console.log("CHECKING LOGIN");

  const isLoginPage = await checkIfLoginPage(page);
  let isThereErrorWhenTryingToLogin = false;

  console.log("AFTER CHECKING LOGIN", {
    isLoginPage,
    pageLoaded,
    isThereErrorWhenTryingToLogin,
  });

  if (isLoginPage) {
    try {
      await humanType(page, cursor, "#Input_Username", userName);
      await humanType(page, cursor, "#Input_Password", password);

      // SAFELY handle navigation

      await humanClick(page, cursor, loginButtonSelector);

      await page.waitForNavigation({
        waitUntil: ["load", "networkidle2"],
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS * 2,
      });
    } catch (error) {
      isThereErrorWhenTryingToLogin = true;
      console.error(`❌ Login failed for ${userName}: ${error.message}`);
    }
  }

  console.log("AFTER LOGIN", {
    isLoginPage,
    pageLoaded,
    isThereErrorWhenTryingToLogin,
  });

  if (isThereErrorWhenTryingToLogin) {
    return [page, cursor, false];
  }

  try {
    await Promise.all([
      page.waitForFunction(
        () =>
          window.location.pathname
            .toLowerCase()
            .includes("/dashboard/referral"),
        { timeout: ONE_AND_HALF_MINUTE_DELAY_MS * 2 }
      ),
      page.waitForSelector(dashboardLinkSelector, {
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS * 2,
      }),
    ]);

    const message = isLoginPage
      ? `✅ User ${userName} logged in successfully and landed on home page.`
      : `✅ User ${userName} already logged in and on home page.`;

    console.log(message);
    return [page, cursor, true];
  } catch (error) {
    await page.screenshot({
      path: `screenshots/login-home-error-${Date.now()}.png`,
    });

    console.log(
      `❌ User ${userName} login succeeded, but failed to detect home page. Current URL: ${page.url()}`,
      error.message
    );
    return [page, cursor, false];
  } finally {
    await randomIdleDelay();
    await moveFromCurrentToRandomPosition(cursor);
  }
};

export default makeUserLoggedInOrOpenHomePage;
