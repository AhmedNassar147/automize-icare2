/*
 *
 * Helper: `increaseDetailsPageScore`.
 *
 */
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
// import helpIncreaseDetailsPageRecaptchaScore from "./helpIncreaseDetailsPageRecaptchaScore.mjs";
import goToHomePage from "./goToHomePage.mjs";
import shuffle from "./shuffle.mjs";
import {
  HOME_PAGE_URL,
  PATIENT_SECTIONS_STATUS,
  TABS_COLLECTION_TYPES,
} from "./constants.mjs";
import sleep from "./sleep.mjs";
import closePageSafely from "./closePageSafely.mjs";

const { [TABS_COLLECTION_TYPES.CONFIRMED]: confirmedStatusInfo } =
  PATIENT_SECTIONS_STATUS;

const increaseDetailsPageScore = async (browser) => {
  const [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    startingPageUrl: HOME_PAGE_URL,
  });

  if (!isLoggedIn) {
    console.log("User is not logged in, cannot collect referral summary.");
    return;
  }

  const { targetText } = confirmedStatusInfo;

  await searchForItemCountAndClickItIfFound(page, targetText, true);

  const rows = await collectHomePageTableRows(page, undefined, 6000);

  const [firstRow] = shuffle(rows).filter(Boolean);
  const iconButton = await firstRow.$("td.iconCell button");

  // preconditions
  const selector = "section.referral-button-container";
  const prevUrl = page.url();

  // prepare listeners BEFORE the click
  const navPromise = page
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45_000 })
    .catch(() => null);

  const popupPromise = page
    .waitForEvent("popup", { timeout: 45_000 })
    .catch(() => null);

  const urlChangePromise = page
    .waitForFunction(
      (oldUrl) => location.href !== oldUrl,
      { timeout: 45_000 },
      prevUrl
    )
    .catch(() => null);

  // click (may navigate)
  const t0 = Date.now();
  await iconButton.click();

  // resolve where we ended up
  let targetPage = await Promise.race([
    popupPromise.then((p) => p).catch(() => null), // new tab/window
    navPromise.then(() => page).catch(() => null), // same page hard nav
    urlChangePromise.then(() => page).catch(() => null), // SPA soft nav
  ]);

  // If none fired (rare), fall back to current page
  targetPage = targetPage || page;

  // now wait for your anchor to actually be visible (with a tiny dwell for stability)
  await targetPage.waitForFunction(
    (sel, dwellMs) => {
      const el = document.querySelector(sel);
      if (!el) {
        window.__seenAt = undefined;
        return false;
      }
      const r = el.getBoundingClientRect();
      const visible = r.width > 0 && r.height > 0;
      if (!visible) {
        window.__seenAt = undefined;
        return false;
      }
      if (window.__seenAt == null) window.__seenAt = performance.now();
      return performance.now() - window.__seenAt >= dwellMs;
    },
    { timeout: 45_000 },
    selector,
    200
  );

  const elapsedMs = Date.now() - t0;
  console.log("elapsedMs", elapsedMs);

  // console.time("super_acceptance_time");
  // await helpIncreaseDetailsPageRecaptchaScore({
  //   page,
  //   cursor,
  //   actionName: Math.random() < 0.5 ? "Rejection" : "Acceptance",
  //   isUploadFormOn: false,
  // });
  // console.timeEnd("super_acceptance_time");

  await sleep(800 + Math.random() * 100);
  await goToHomePage(page);
  await sleep(150 + Math.random() * 100);
  await closePageSafely(page);
};

// export default increaseDetailsPageScore;

export default async (
  browser,
  pauseFetchingPatients,
  continueFetchingPatientsIfPaused,
  onDone
) => {
  pauseFetchingPatients();
  let range = 4;

  while (range > 0) {
    try {
      await increaseDetailsPageScore(browser);
      await sleep(7000 + Math.random() * 6000);
    } catch (error) {
      console.log("Error in increaseDetailsPageScore:", error);
      break;
    } finally {
      range -= 1;
    }
  }

  continueFetchingPatientsIfPaused();
  onDone();
};
