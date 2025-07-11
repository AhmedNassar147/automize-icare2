/*
 *
 * Helper: `goToHomePage`.
 *
 */
import waitForHomeLink from "./waitForHomeLink.mjs";
import humanClick from "./humanClick.mjs";
import { dashboardLinkSelector, homePageTableSelector } from "./constants.mjs";
import sleep from "./sleep.mjs";

const timeout = 7_000;

const goToHomePage = async (page, cursor) => {
  await humanClick(page, cursor, dashboardLinkSelector);

  await Promise.allSettled([
    waitForHomeLink(page, timeout),
    sleep(50 + Math.random() * 50),
    page.waitForSelector(homePageTableSelector, { timeout }),
  ]);

  return true;
};

export default goToHomePage;
