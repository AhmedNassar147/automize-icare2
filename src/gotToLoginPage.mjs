/*
 *
 * Helper: `gotToLoginPage`.
 *
 */
import { APP_URL } from "./constants.mjs";

export const LOGIN_TIMEOUT = 1.5 * 60 * 1000;

const gotToLoginPage = async (page) => {
  await page.goto(APP_URL, {
    waitUntil: "networkidle2",
    timeout: LOGIN_TIMEOUT * 2,
  });

  await page.waitForNavigation({
    waitUntil: ["load", "networkidle2"],
    timeout: LOGIN_TIMEOUT * 4,
  });
};

export default gotToLoginPage;
