/*
 *
 * Helper: `waitForWaitingCountWithInterval`.
 *
 */
import sleep from "./sleep.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import processCollectingPatients from "./processCollectingPatients.mjs";
import { PATIENT_SECTIONS_STATUS } from "./constants.mjs";

const INTERVAL = 60_000;
const NOT_LOGGED_SLEEP_TIME = 20_000;

const reloadAndCheckIfShouldCreateNewPage = async (page, logString = "") => {
  try {
    const intervalTime = INTERVAL + Math.random() * 9000;

    console.log(`${logString}refreshing in ${intervalTime / 1000}s...`);
    await sleep(intervalTime);
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (err) {
    console.error("🔁 Failed to reload page:", err.message);

    const intervalTime = INTERVAL + Math.random() * 9000;
    console.log(`${logString}refreshing in ${intervalTime / 1000}s...`);
    await sleep(intervalTime);

    return true;
  }
};

const waitForWaitingCountWithInterval = async ({
  collectConfimrdPatient = false,
  patientsStore,
  browser,
  sendWhatsappMessage,
}) => {
  const { targetText, noCountText } =
    PATIENT_SECTIONS_STATUS[collectConfimrdPatient ? "CONFIRMED" : "WAITING"];

  let page, cursor;

  while (true) {
    try {
      const [newPage, newCursor, isLoggedIn] =
        await makeUserLoggedInOrOpenHomePage({
          browser,
          cursor,
          currentPage: page,
          sendWhatsappMessage,
        });

      page = newPage;
      cursor = newCursor;

      if (!isLoggedIn) {
        console.log(
          `🔐 Not logged in, retrying in ${NOT_LOGGED_SLEEP_TIME / 1000}s...`
        );
        await sleep(NOT_LOGGED_SLEEP_TIME);
        continue;
      }

      const { count } = await searchForItemCountAndClickItIfFound(
        page,
        targetText,
        collectConfimrdPatient
      );

      if (!count) {
        const shouldCreateNewpage = await reloadAndCheckIfShouldCreateNewPage(
          page,
          `${noCountText}, `
        );

        if (shouldCreateNewpage) {
          page = null;
        }
        continue;
      }

      console.log(
        `🧐 ${count} patient(s) found. Checking at ${new Date().toLocaleTimeString()}`
      );

      await processCollectingPatients({
        browser,
        patientsStore,
        page,
        targetText,
        cursor,
      });
    } catch (error) {
      console.error("🛑 Unexpected error during loop:", error.message);
    }

    const shouldCreateNewpage = await reloadAndCheckIfShouldCreateNewPage(page);

    if (shouldCreateNewpage) {
      page = null;
    }
  }
};

export default waitForWaitingCountWithInterval;
