/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import { writeFile /*  readFile */ } from "fs/promises";
import { join, resolve /* basename*/ } from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import goToHomePage from "./goToHomePage.mjs";
import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import closePageSafely from "./closePageSafely.mjs";
import buildDurationText from "./buildDurationText.mjs";
import handleAfterSubmitDone from "./handleAfterSubmitDone.mjs";
import isAcceptanceButtonShown from "./isAcceptanceButtonShown.mjs";
import createDetailsPageWhatsappHandlers from "./createDetailsPageWhatsappHandlers.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  htmlFilesPath,
} from "./constants.mjs";
import sleep from "./sleep.mjs";

const processClientActionOnPatient = async ({
  browser,
  actionType,
  patient,
  patientsStore,
  sendWhatsappMessage,
  continueFetchingPatientsIfPaused,
}) => {
  let preparingStartTime = Date.now();

  const { referralId, patientName, referralEndTimestamp } = patient;

  const isAcceptance = USER_ACTION_TYPES.ACCEPT === actionType;

  const actionName = isAcceptance ? "Acceptance" : "Rejection";

  const logString = `details page referralId=(${referralId})`;

  const acceptanceFilePath = join(
    generatedPdfsPathForAcceptance,
    `${USER_ACTION_TYPES.ACCEPT}-${referralId}.pdf`
  );

  const rejectionFilePath = join(
    generatedPdfsPathForRejection,
    `${USER_ACTION_TYPES.REJECT}-${referralId}.pdf`
  );

  const filePath = resolve(
    isAcceptance ? acceptanceFilePath : rejectionFilePath
  );

  const [page, _, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    sendWhatsappMessage,
    startingPageUrl: HOME_PAGE_URL,
    noCursor: true,
  });

  const { sendErrorMessage, sendSuccessMessage } =
    createDetailsPageWhatsappHandlers({
      page,
      actionName,
      referralId,
      patientName,
      continueFetchingPatientsIfPaused,
      isAcceptance,
      sendWhatsappMessage,
      logString,
    });

  const closeCurrentPage = async (navigateToHomePage) => {
    if (navigateToHomePage) {
      await goToHomePage(page);
    }
    await closePageSafely(page);
  };

  if (!isLoggedIn) {
    await sendErrorMessage(
      "Login failed after 3 attempts.",
      "user-action-no-loggedin",
      buildDurationText(preparingStartTime, Date.now())
    );
    await closeCurrentPage(false);
    return;
  }

  const referralIdRecordResult = await collectHomePageTableRows(
    page,
    referralId,
    8000
  );

  let { iconButton } = referralIdRecordResult || {};

  if (!iconButton) {
    console.log("referralIdRecordResult: ", referralIdRecordResult);
    await sendErrorMessage(
      "The Pending referrals table is empty or eye button not found.",
      "no-patients-in-home-table",
      buildDurationText(preparingStartTime, Date.now())
    );

    await closeCurrentPage(false);
    return;
  }

  let startTime = Date.now();

  try {
    const remainingMs = referralEndTimestamp - Date.now();

    const { elapsedMs, reason, isReadyByTime } = await isAcceptanceButtonShown({
      page,
      idReferral: referralId,
      remainingMs,
    });

    console.log(
      `referralId=${referralId} remainingMs=${remainingMs} isReadyByTime=${isReadyByTime} reason=${reason} elapsedMs=${elapsedMs}`
    );

    startTime = Date.now();
    console.time("took_time");
    await iconButton.click();

    await page.waitForSelector(".statusContainer", {
      timeout: 6000,
    });

    await page.evaluate(() => {
      const section = document.querySelector(
        "section.referral-button-container"
      );
      if (!section) return;
      section.style.position = "absolute";
      section.style.top = "845px";
      section.style.right = "8%";
      section.style.width = "100%";
    });

    await selectAttachmentDropdownOption(page, actionName);
    const fileInput = await page.$('#upload-single-file input[type="file"]');
    await fileInput.uploadFile(filePath);
    console.timeEnd("took_time");

    await handleAfterSubmitDone({
      page,
      startTime,
      // leftTime,
      continueFetchingPatientsIfPaused,
      patientsStore,
      sendErrorMessage,
      sendSuccessMessage,
      closeCurrentPage,
      actionName,
      acceptanceFilePath,
      rejectionFilePath,
      referralId,
    });
  } catch (error) {
    try {
      const html = await page.content();
      await writeFile(`${htmlFilesPath}/details_page_catch_error.html`, html);
    } catch (error) {
      console.log("couldn't get details page html", error.message);
    }

    const _err = error?.message || String(error);

    console.log(`🛑 Error during ${actionName} of ${referralId}:`, _err);
    await sendErrorMessage(
      `Error: ${_err}`,
      `catch-error-${actionName}-error`,
      buildDurationText(startTime, Date.now())
    );
    await closeCurrentPage(false);
  } finally {
    continueFetchingPatientsIfPaused();
  }
};

export default processClientActionOnPatient;
