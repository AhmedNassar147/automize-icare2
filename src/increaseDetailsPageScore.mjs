/*
 *
 * Helper: `increaseDetailsPageScore`.
 *
 */

import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import helpIncreaseDetailsPageRecaptchaScore from "./helpIncreaseDetailsPageRecaptchaScore.mjs";
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
  await iconButton.click();

  console.time("super_acceptance_time");
  await helpIncreaseDetailsPageRecaptchaScore({
    page,
    cursor,
    actionName: Math.random() < 0.5 ? "Rejection" : "Acceptance",
    isUploadFormOn: false,
  });
  console.timeEnd("super_acceptance_time");

  await sleep(200 + Math.random() * 100);
  await goToHomePage(page);
  await sleep(100 + Math.random() * 100);
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
      await sleep(5000 + Math.random() * 4000);
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
