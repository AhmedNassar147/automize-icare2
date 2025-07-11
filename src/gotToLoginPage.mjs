/*
 *
 * Helper: `gotToLoginPage`.
 *
 */
import { APP_URL } from "./constants.mjs";

const LOGIN_TIMEOUT = 1.5 * 60 * 1000;

const gotToLoginPage = async (page) => {
  await page.goto(APP_URL, {
    waitUntil: "networkidle2",
    timeout: LOGIN_TIMEOUT,
  });

  await page.waitForNavigation({
    waitUntil: ["load", "networkidle2"],
    timeout: 28_000,
  });

  const currentUrl = page.url().toLowerCase();

  console.log("currentUrl", currentUrl);

  if (currentUrl.includes("account/login") || currentUrl.includes("signin")) {
    try {
      await page.waitForNavigation({
        waitUntil: ["load", "networkidle2"],
        timeout: 3_000,
      });
    } catch (error) {
      console.log("LOGIN_SECOND waitForNavigation", error.message);
    }
  }
};

export default gotToLoginPage;
