/*
 *
 * Helper: `waitForWaitingCountWithInterval`.
 *
 */
import sleep from "./sleep.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import closePageSafely from "./closePageSafely.mjs";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import processCollectingPatients from "./processCollectingPatients.mjs";
import openUserMenuAndClickHome from "./openUserMenuAndClickHome.mjs";
import { PATIENT_SECTIONS_STATUS } from "./constants.mjs";

const MAX_FAILURE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const RETRY_FAILURE_DURATION_MS = 3 * 60 * 1000; // 3 minutes
const NORMAL_TIMEOUT_DURATION = 1.5 * 60 * 1000; // 1.5 minutes
const MAX_REFRESH_RETRIES = 10;

const waitForWaitingCountWithInterval = async (options) => {
  let {
    collectConfimrdPatient = false,
    patientsStore,
    browser,
    currentPage,
    failureStartTime = null,
  } = options;

  const { targetText, noCountText } =
    PATIENT_SECTIONS_STATUS[collectConfimrdPatient ? "CONFIRMED" : "WAITING"];

  let refreshCount = 0;

  while (true) {
    let page, cursor, isLoggedIn;

    try {
      [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage(
        browser,
        cursor,
        currentPage
      );
    } catch (err) {
      console.log("🛑 Error during login/home open:", err.message);
      await closePageSafely(page);
      await sleep(NORMAL_TIMEOUT_DURATION);
      currentPage = undefined;
      cursor = undefined;
      failureStartTime = failureStartTime || Date.now();
      continue;
    }

    if (!page) {
      console.warn("⚠️ Page not available, skipping...");
      await sleep(NORMAL_TIMEOUT_DURATION);
      currentPage = undefined;
      cursor = undefined;
      continue;
    }

    if (!isLoggedIn) {
      const now = Date.now();
      const start =
        typeof failureStartTime === "number" ? failureStartTime : now;
      const isMaxFailureReached = now - start > MAX_FAILURE_DURATION_MS;

      const warningMessage = isMaxFailureReached
        ? "Reached 5 minutes. Closing page..."
        : "Refreshing page...";

      console.warn(`⚠️ Login failed. ${warningMessage}`);

      if (isMaxFailureReached) {
        await closePageSafely(page);
        await sleep(RETRY_FAILURE_DURATION_MS);
        currentPage = undefined;
        cursor = undefined;
        failureStartTime = null;
        refreshCount = 0;
      } else {
        await sleep(NORMAL_TIMEOUT_DURATION);
        await page.reload({ waitUntil: "networkidle2" });
        currentPage = page;
        cursor = cursor;
        failureStartTime = start;
        refreshCount++;
      }

      if (refreshCount >= MAX_REFRESH_RETRIES) {
        console.warn("⏹️ Too many refreshes. Pausing for cooldown.");
        await sleep(4 * NORMAL_TIMEOUT_DURATION);
        refreshCount = 0;
      }

      continue;
    }

    // Reset failure timer and refresh counter
    failureStartTime = null;
    refreshCount = 0;

    console.log(
      `🧐 Searching for next patients... at ${new Date().toLocaleTimeString()}`
    );

    let clicked = false;
    let count = 0;

    const shouldClickHeaderItem = collectConfimrdPatient;

    try {
      const result = await searchForItemCountAndClickItIfFound(
        page,
        targetText,
        shouldClickHeaderItem
      );

      clicked = result.clicked;
      count = result.count;
    } catch (err) {
      console.error(
        "🔍 Error while searching for patient section:",
        err.message
      );
      await sleep(NORMAL_TIMEOUT_DURATION);
      await openUserMenuAndClickHome(page, cursor);
      currentPage = page;
      cursor = cursor;
      refreshCount++;
      continue;
    }

    if (!count) {
      console.log(`${noCountText}, refreshing...`);
      await sleep(NORMAL_TIMEOUT_DURATION);
      await openUserMenuAndClickHome(page, cursor);
      currentPage = page;
      cursor = cursor;
      refreshCount++;
      continue;
    }

    await processCollectingPatients({
      browser,
      patientsStore,
      page,
      targetText,
      cursor,
    });

    await openUserMenuAndClickHome(page, cursor);

    currentPage = page;
    cursor = cursor;
  }
};

export default waitForWaitingCountWithInterval;
