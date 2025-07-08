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

      await sleep(1000);

      const isLoginPage = await checkIfLoginPage(page);

      if (isLoginPage) {
        await humanType(page, cursor, "#Input_Username", userName);
        await humanType(page, cursor, "#Input_Password", password);
        await humanClick(page, cursor, loginButtonSelector);

        await page.waitForNavigation({
          waitUntil: "networkidle2",
          timeout: LOGIN_TIMEOUT * 3,
        });
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
    await sleep(1000 + retries * 500);
  }

  console.error("❌ Failed to login after max retries.");
  return [page, cursor, false];
};

export default makeUserLoggedInOrOpenHomePage;
