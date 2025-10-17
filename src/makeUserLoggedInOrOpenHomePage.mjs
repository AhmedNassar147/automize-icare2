/*
 *
 * helper: `makeUserLoggedInOrOpenHomePage`.
 *
 */
import { createCursor } from "ghost-cursor";
import checkIfLoginPage from "./checkIfLoginPage.mjs";
// import humanType from "./humanType.mjs";
// import humanClick from "./humanClick.mjs";
import sleep from "./sleep.mjs";
import waitForHomeLink from "./waitForHomeLink.mjs";
import gotToLoginPage from "./gotToLoginPage.mjs";
import shouldCloseAppWhenLogin from "./shouldCloseAppWhenLogin.mjs";
import { homePageTableSelector } from "./constants.mjs";

const MAX_RETRIES = 3;
const loginButtonSelector = 'button[name="Input.Button"][value="login"]';

const checkHomePageFullyLoaded = async (page) => {
  try {
    await waitForHomeLink(page, 5_000);
    await page.waitForSelector(homePageTableSelector, {
      timeout: 5_000,
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
  showScoreButton,
  onClickScoreButton,
  noCursor,
}) => {
  const userName = process.env.CLIENT_NAME;
  const password = process.env.CLIENT_PASSWORD;

  let page = currentPage || (await browser.newPage());
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
            timeout: 6000,
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

          // await humanType(page, cursor, "", userName);
          // await humanType(page, cursor, "#Input_Password", password);

          // const button = await page.$(loginButtonSelector);
          // const submit_start_time = performance.now();
          // await clickButtonThatObservedByRecapctahaInvisbleV2(cursor, button);
          // const submit_end_time = performance.now();
          // console.log(
          //   `login time ${(
          //     (submit_end_time - submit_start_time) /
          //     1000
          //   ).toFixed(2)} s`
          // );
          // await humanClick(page, loginButtonSelector);

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

        // if (showScoreButton) {
        //   const hasBinding = await page.evaluate(
        //     (n) => typeof window[n] === "function",
        //     "onInjectedScoreButtonClick"
        //   );

        //   if (!hasBinding) {
        //     try {
        //       await page.exposeFunction(
        //         "onInjectedScoreButtonClick",
        //         onClickScoreButton
        //       );
        //     } catch (err) {
        //       if (!/already registered/i.test(err.message)) {
        //         console.log(
        //           "onInjectedScoreButtonClick already injected in page"
        //         );
        //       }
        //     }
        //   }

        //   await page.waitForSelector(".breadcrumb > div:nth-child(2)");
        //   await page.evaluate(() => {
        //     const container = document.querySelector(
        //       ".breadcrumb > div:nth-child(2)"
        //     );
        //     if (container && !container.querySelector(".my-injected-btn")) {
        //       const btn = document.createElement("button");
        //       btn.type = "button";
        //       btn.textContent = "run automatic score tour";
        //       btn.className = "my-injected-btn";
        //       btn.style.cssText = `
        //         background-color: #1976d2;
        //         color: #fff;
        //         border: none;
        //         padding: 6px 12px;
        //         border-radius: 4px;
        //         cursor: pointer;
        //         opacity: 1;
        //         box-shadow: 0px 2px 4px -1px rgba(0,0,0,0.2),
        //                     0px 4px 5px 0px rgba(0,0,0,0.14),
        //                     0px 1px 10px 0px rgba(0,0,0,0.12);
        //         transition: box-shadow 0.25s ease, transform 0.15s ease;
        //       `;

        //       btn.addEventListener("click", () => {
        //         window.onInjectedScoreButtonClick(); // defined by exposeFunction above
        //       });
        //       container.appendChild(btn);
        //     }
        //   });
        // }

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
