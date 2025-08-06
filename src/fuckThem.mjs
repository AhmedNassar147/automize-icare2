/*
 *
 * Helper: `openNewPageForSubmitSimulation`.
 *
 */
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import collectHomeTableRows from "./collectHomeTableRows.mjs";
import { PATIENT_SECTIONS_STATUS, HOME_PAGE_URL } from "./constants.mjs";
import sleep from "./sleep.mjs";

const SITE_KEY = "6LcqgMcqAAAAALsWwhGQYrpDuMnke9RkJkdJnFte";

const openNewPageForSubmitSimulation = async (browser, sendWhatsappMessage) => {
  const [page, _, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    sendWhatsappMessage,
    startingPageUrl: HOME_PAGE_URL,
  });

  if (!isLoggedIn) {
    console.log("User is not logged in, for submit simulation.");
    return;
  }

  const { CONFIRMED } = PATIENT_SECTIONS_STATUS;

  await searchForItemCountAndClickItIfFound(page, CONFIRMED.targetText, true);

  const rows = await collectHomeTableRows(page);
  const [firstRow] = rows;
  const iconButton = await firstRow.$("td.iconCell button");

  await iconButton?.click();

  await page.mouse.move(100, 100);
  await sleep(10 + Math.random() * 10);
  await page.mouse.move(200, 150);
  await page.keyboard.press("ArrowDown");
  await sleep(10 + Math.random() * 15);
  await page.mouse.wheel({ deltaY: 120 });

  await page.waitForFunction(
    () => window.grecaptcha && window.grecaptcha.execute,
    { timeout: 3000 }
  );

  // recaptcha

  let token = "";

  // (async () => {
  //   const token = await grecaptcha.execute(
  //     "6LeH_x8UAAAAAKKuaaod4GsENkTJTHdeQIm8l6y2",
  //     { action: "submit" }
  //   );
  //   console.log(token);
  // })();

  // try {
  //   token = await page.evaluate(async (siteKey) => {
  //     return await grecaptcha.execute(siteKey, { action: "submit" });
  //   }, SITE_KEY);
  // } catch (error) {
  //   console.error("Error executing grecaptcha:", error.message);
  // }

  try {
    await page.waitForSelector("#recaptcha-token");
    token = await page.$eval("#recaptcha-token", (el) => el.value);
  } catch (error) {}

  const cookies = await page.cookies();

  const cookieObject = cookies.reduce((acc, cookie) => {
    acc[cookie.name] = cookie.value;
    return acc;
  }, {});

  console.log("cookieObject", cookieObject);
  console.log("token", token);
};
