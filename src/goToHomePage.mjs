/*
 *
 * Helper: `goToHomePage`.
 *
 */
import waitForHomeLink from "./waitForHomeLink.mjs";
import humanClick from "./humanClick.mjs";
import { dashboardLinkSelector, homePageTableSelector } from "./constants.mjs";

const goToHomePage = async (page, cursor, areadyInHome) => {
  if (!areadyInHome) {
    await humanClick(page, cursor, dashboardLinkSelector);
  }

  const timeout = 9_000;

  await Promise.all([
    waitForHomeLink(page, timeout),
    page.waitForSelector(homePageTableSelector, { timeout }),
  ]);
};

export default goToHomePage;
