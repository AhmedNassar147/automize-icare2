/*
 *
 * helper: `makeUserLoggedInOrOpenHomePage`.
 *
 */
import { createCursor } from "ghost-cursor";
import checkIfLoginPage from "./checkIfLoginPage.mjs";
import humanType from "./humanType.mjs";
import humanClick from "./humanClick.mjs";
import randomIdleDelay from "./randomIdleDelay.mjs";
import sleep from "./sleep.mjs";
import waitForHomeLink from "./waitForHomeLink.mjs";
import gotToLoginPage, { LOGIN_TIMEOUT } from "./gotToLoginPage.mjs";
import shouldCloseAppWhenLogin from "./shouldCloseAppWhenLogin.mjs";
import { homePageTableSelector } from "./constants.mjs";

const MAX_RETRIES = 3;
const loginButtonSelector = 'button[name="Input.Button"][value="login"]';

const checkHomePageFullyLoaded = async (page) => {
  try {
    await waitForHomeLink(page, 6_000);
    await page.waitForSelector(homePageTableSelector, {
      timeout: 6_000,
    });
    return true;
  } catch (err) {
    await page.screenshot({
      path: `screenshots/check-not-in-home-error-${Date.now()}.png`,
    });
    return false;
  }
};

const makeUserLoggedInOrOpenHomePage = async ({
  browser,
  cursor: _cursor,
  currentPage,
  sendWhatsappMessage,
}) => {
  const userName = process.env.CLIENT_NAME;
  const password = process.env.CLIENT_PASSWORD;

  let page = currentPage || (await browser.newPage());
  let cursor = _cursor && currentPage ? _cursor : createCursor(page);

  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      if (!currentPage || retries > 0) {
        await gotToLoginPage(page);
      }

      const isLoginPage_BEFORE = await checkIfLoginPage(page);
      console.log("isLoginPage_BEFORE", isLoginPage_BEFORE);

      await sleep(350);
      const isLoginPage_AFTER_350 = await checkIfLoginPage(page);
      console.log("isLoginPage_AFTER_350", isLoginPage_AFTER_350);

      await sleep(100);
      const isLoginPage_AFTER_450 = await checkIfLoginPage(page);
      console.log("isLoginPage_AFTER_450", isLoginPage_AFTER_450);

      await sleep(100);
      const isLoginPage_AFTER_550 = await checkIfLoginPage(page);
      console.log("isLoginPage_AFTER_550", isLoginPage_AFTER_550);

      const isLoginPage = await checkIfLoginPage(page);

      if (isLoginPage) {
        await humanType(page, cursor, "#Input_Username", userName);
        await humanType(page, cursor, "#Input_Password", password);
        await humanClick(page, cursor, loginButtonSelector);

        await sleep(3_000);
      }

      const currentPageUrl = page.url();

      const isStillInLoginPage = currentPageUrl
        .toLowerCase()
        .includes("/account/login");

      if (isStillInLoginPage) {
        const shouldCloseApp = await shouldCloseAppWhenLogin(
          page,
          sendWhatsappMessage
        );

        if (shouldCloseApp) {
          await browser.close();
          process.kill(process.pid);
          return;
        }
      }

      const isHomeLoaded = await checkHomePageFullyLoaded(page);

      if (isHomeLoaded) {
        console.log(`✅ User ${userName} is on home page.`);
        await randomIdleDelay();

        return [page, cursor, true];
      }
    } catch (error) {
      console.error(`❌ Attempt #${retries + 1} failed: ${error.message}`);
    }

    retries++;
    await sleep(400 + retries * 400);
  }

  console.error("❌ Failed to login after max retries.");
  return [page, cursor, false];
};

export default makeUserLoggedInOrOpenHomePage;
