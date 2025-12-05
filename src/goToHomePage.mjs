/*
 *
 * Helper: `goToHomePage`.
 *
 */
import humanClick from "./humanClick.mjs";
import { dashboardLinkSelector, homePageTableSelector } from "./constants.mjs";
import sleep from "./sleep.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";

const timeout = 10_000;

const goToHomePage = async (page) => {
  try {
    await humanClick(page, dashboardLinkSelector);
    await sleep(10 + Math.random() * 20);
    await page.waitForSelector(homePageTableSelector, { timeout });

    return true;
  } catch (error) {
    createConsoleMessage(error, "error", "goToHomePage");
    return false;
  }
};

export default goToHomePage;
