/*
 *
 * Helper: `goToHomePage`.
 *
 */
import humanClick from "./humanClick.mjs";
import { dashboardLinkSelector, homePageTableSelector } from "./constants.mjs";
import sleep from "./sleep.mjs";

const timeout = 7_000;

const goToHomePage = async (page) => {
  try {
    await humanClick(page, dashboardLinkSelector);
    await sleep(10 + Math.random() * 20);
    await page.waitForSelector(homePageTableSelector, { timeout });

    return true;
  } catch (error) {
    console.error("Error when going to home page", error);
    return false;
  }
};

export default goToHomePage;
