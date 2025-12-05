/*
 *
 * helper: `makeUserLoggedInOrOpenHomePage`.
 *
 */
import { createCursor } from "ghost-cursor";
import checkIfLoginPage from "./checkIfLoginPage.mjs";
import sleep from "./sleep.mjs";
import waitForHomeLink from "./waitForHomeLink.mjs";
import gotToLoginPage from "./gotToLoginPage.mjs";
import shouldCloseAppWhenLogin from "./shouldCloseAppWhenLogin.mjs";
import { homePageTableSelector } from "./constants.mjs";

const MAX_RETRIES = 3;
const loginButtonSelector = 'button[name="Input.Button"][value="login"]';

const checkHomePageFullyLoaded = async (page) => {
  try {
    await waitForHomeLink(page, 10_000);
    await page.waitForSelector(homePageTableSelector, {
      timeout: 13_000,
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
  startingPageUrl,
  noCursor,
}) => {
  const userName = process.env.CLIENT_NAME;
  const password = process.env.CLIENT_PASSWORD;

  let page = currentPage || (await browser.newPage());

  if (!currentPage && page) {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });
  }

  let cursor;

  if (!noCursor) {
    cursor =
      _cursor && currentPage
        ? _cursor
        : createCursor(
            page,
            { x: 180 + Math.random(), y: 250 + Math.random() * 20 },
            false
          );
  }

  let retries = 0;

  while (retries <= MAX_RETRIES) {
    try {
      if ((!currentPage && !startingPageUrl) || retries > 0) {
        await gotToLoginPage(page);
      }

      let hasEnteredStartingPage = false;

      if (startingPageUrl && retries === 0) {
        await page.goto(startingPageUrl, {
          waitUntil: "networkidle2",
          timeout: 10_000,
        });

        const pageUrl = page.url();

        if (pageUrl.toLowerCase().includes(startingPageUrl.toLowerCase())) {
          await page.waitForSelector(homePageTableSelector, {
            timeout: 13_000,
          });

          hasEnteredStartingPage = true;
        }
      }

      if (!hasEnteredStartingPage) {
        const isLoginPage = await checkIfLoginPage(page);

        if (isLoginPage) {
          await page.focus("#Input_Username");
          await page.keyboard.type(userName, {
            delay: 100 + Math.random() * 20,
          });

          await page.focus("#Input_Password");
          await page.keyboard.type(password, {
            delay: 100 + Math.random() * 20,
          });

          await sleep(120 + Math.random() * 100);
          await page.click(loginButtonSelector);

          try {
            await page.waitForNavigation({
              waitUntil: ["load", "networkidle2"],
              timeout: 8_000,
            });
          } catch (error) {
            console.log("AFTER SUBMITTING LOGIN", error.message);
          }
        }

        const currentPageUrl = page.url();

        const isStillInLoginPage = currentPageUrl
          .toLowerCase()
          .includes("/account/login");

        if (isStillInLoginPage) {
          const { shouldCloseApp, isErrorAboutLockedOut } =
            await shouldCloseAppWhenLogin(page, sendWhatsappMessage);

          if (isErrorAboutLockedOut) {
            return [page, cursor, false, true];
          }

          if (shouldCloseApp) {
            await browser.close();
            process.kill(process.pid);
            return;
          }
        }
      }

      const isHomeLoaded =
        hasEnteredStartingPage || (await checkHomePageFullyLoaded(page));

      if (isHomeLoaded) {
        console.log(`✅ User ${userName} is in home page.`);
        await sleep(35 + Math.random() * 40);

        return [page, cursor, true];
      }
    } catch (error) {
      console.error(`❌ Attempt #${retries + 1} failed: ${error.message}`);
    }

    retries++;
    await sleep(400 + retries * 220);
  }

  console.error("❌ Failed to login after max retries.");
  return [page, cursor, false];
};

export default makeUserLoggedInOrOpenHomePage;
