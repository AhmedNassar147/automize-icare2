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
    timeout: LOGIN_TIMEOUT,
  });

  await page.waitForNavigation({
    waitUntil: ["load", "networkidle2"],
    timeout: 6000,
  });

  try {
    await page.waitForNavigation({
      waitUntil: ["load", "networkidle2"],
      timeout: 6000,
    });
  } catch (error) {
    console.log("LOGIN_SECOND waitForNavigation", error.message);
  }
};

export default gotToLoginPage;
