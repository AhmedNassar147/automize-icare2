/*
 *
 * helper: `makeUserLoggedInOrOpenHomePage`.
 *
 */
import { createCursor } from "ghost-cursor";
import checkIfLoginPage from "./checkIfLoginPage.mjs";
import humanType from "./humanType.mjs";
import humanClick from "./humanClick.mjs";
import goToHomePage from "./goToHomePage.mjs";
import sleep from "./sleep.mjs";
import { APP_URL } from "./constants.mjs";

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

  if (!pageLoaded) {
    try {
      await page.goto(APP_URL, {
        waitUntil: "networkidle2",
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS * 2,
      });

      await page.waitForNavigation({
        waitUntil: ["load", "networkidle2"],
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS * 3,
      });

      await sleep(900);

      pageLoaded = true;
    } catch (error) {
      pageLoaded = false;
      console.log(`❌ Failed to load page: ${error.message}`);
      return [page, cursor, false];
    }
  }

  if (!pageLoaded) {
    console.log("Page not loaded");
    return [page, cursor, false];
  }

  const isLoginPage = await checkIfLoginPage(page);
  let isThereErrorWhenTryingToLogin = false;

  if (isLoginPage) {
    try {
      await humanType(page, cursor, "#Input_Username", userName);
      await humanType(page, cursor, "#Input_Password", password);

      // SAFELY handle navigation

      await humanClick(page, cursor, loginButtonSelector);

      await page.waitForNavigation({
        waitUntil: "networkidle2",
        timeout: ONE_AND_HALF_MINUTE_DELAY_MS * 2,
      });
    } catch (error) {
      isThereErrorWhenTryingToLogin = true;
      console.error(`❌ Login failed for ${userName}: ${error.message}`);
    }
  }

  console.log(
    `Page loaded isLoginPage=${isLoginPage} isThereErrorWhenTryingToLogin=${isThereErrorWhenTryingToLogin}`
  );

  if (isThereErrorWhenTryingToLogin) {
    return [page, cursor, false];
  }

  try {
    await goToHomePage(page, cursor, true);
    await sleep(200);
    await page.reload({ waitUntil: "networkidle2" });
    await sleep(500);

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
  }
};

export default makeUserLoggedInOrOpenHomePage;
