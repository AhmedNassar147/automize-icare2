/*
 *
 * Helper: `waitForWaitingCountWithInterval`.
 *
 */
import sleep from "./sleep.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import processCollectingPatients from "./processCollectingPatients.mjs";
import closePageSafely from "./closePageSafely.mjs";
import goToHomePage from "./goToHomePage.mjs";
import {
  PATIENT_SECTIONS_STATUS,
  TABS_COLLECTION_TYPES,
} from "./constants.mjs";

const INTERVAL = 62_000;
const NOT_LOGGED_SLEEP_TIME = 25_000;

const LOCKED_OUT_SLEEP_TIME = 4 * 10 * 60_000;

const reloadAndCheckIfShouldCreateNewPage = async (page, logString = "") => {
  try {
    const intervalTime = INTERVAL + Math.random() * 9000;

    if (!page || !page?.reload) {
      await sleep(intervalTime);
      console.log(
        `Will recreate page on next loop iteration, refreshing in ${
          intervalTime / 1000
        }s...`
      );

      return true;
    }

    console.log(`${logString}refreshing in ${intervalTime / 1000}s...`);
    await sleep(intervalTime);
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (err) {
    console.error("🔁 Failed to reload page:", err.message);

    const intervalTime = INTERVAL + Math.random() * 11_000;

    console.log(
      `Will recreate page on next loop iteration, refreshing in ${
        intervalTime / 1000
      }s...`
    );
    await sleep(intervalTime);

    return true;
  }
};

const waitForWaitingCountWithInterval = async ({
  collectionTabType,
  patientsStore,
  browser,
  sendWhatsappMessage,
}) => {
  const { targetText, noCountText } =
    PATIENT_SECTIONS_STATUS[collectionTabType];

  let page, cursor;

  console.log(`🌀 Loop running for ${collectionTabType} patients...`);

  if (!patientsStore.hasReloadListener()) {
    patientsStore.on("forceReloadHomePage", async () => {
      console.log("📢 Received forceReloadHomePage event");
      if (page) {
        const currentPageUrl = page.url();

        const isHomePage = currentPageUrl
          .toLowerCase()
          .includes("dashboard/referral");

        if (!isHomePage) {
          await sleep(6_000);
        }

        try {
          await goToHomePage(page);
          await page.reload({ waitUntil: "domcontentloaded" });
          console.log("🔄 Page reloaded successfully from event.");
        } catch (err) {
          console.error("🔁 Error during manual homepage reload:", err.message);
        }
      } else {
        console.warn("⚠️ forceReloadHomePage event fired but page is null");
      }
    });
  }

  while (true) {
    try {
      const [newPage, newCursor, isLoggedIn, isErrorAboutLockedOut] =
        await makeUserLoggedInOrOpenHomePage({
          browser,
          cursor,
          currentPage: page,
          sendWhatsappMessage,
        });

      page = newPage;
      cursor = newCursor;

      if (isErrorAboutLockedOut) {
        const now = new Date();
        const unlockTime = new Date(now.getTime() + LOCKED_OUT_SLEEP_TIME);

        console.log(
          `🔐 We are locked out, retrying in ${
            LOCKED_OUT_SLEEP_TIME / 60_000
          } minutes until ${unlockTime.toLocaleTimeString("en-US", {
            hour12: false,
          })}...`
        );

        await closePageSafely(page);

        await sleep(LOCKED_OUT_SLEEP_TIME);
        page = null;
        cursor = null;
        continue;
      }

      if (!isLoggedIn) {
        console.log(
          `🔐 Not logged in, retrying in ${NOT_LOGGED_SLEEP_TIME / 1000}s...`
        );
        await sleep(NOT_LOGGED_SLEEP_TIME);
        continue;
      }

      if (!page) {
        console.log("Page is not initialized. Skipping reload...");
        await sleep(NOT_LOGGED_SLEEP_TIME);
        cursor = null;
        continue;
      }

      const { count } = await searchForItemCountAndClickItIfFound(
        page,
        targetText,
        collectionTabType !== TABS_COLLECTION_TYPES.WAITING
      );

      if (!count) {
        await sleep(10_000 + Math.random() * 1000);
        const shouldCreateNewpage = await reloadAndCheckIfShouldCreateNewPage(
          page,
          `${noCountText}, `
        );

        if (shouldCreateNewpage) {
          page = null;
          cursor = null;
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
        sendWhatsappMessage,
      });
    } catch (error) {
      console.error("🛑 Unexpected error during loop:", error.message);
    }
    const shouldCreateNewpage = await reloadAndCheckIfShouldCreateNewPage(page);

    if (shouldCreateNewpage) {
      page = null;
      cursor = null;
    }
  }
};

export default waitForWaitingCountWithInterval;
