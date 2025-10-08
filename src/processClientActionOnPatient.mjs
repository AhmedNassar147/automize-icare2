/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import { writeFile /* unlink,  readFile */ } from "fs/promises";
import { join, resolve /* basename*/ } from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import goToHomePage from "./goToHomePage.mjs";
import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import sleep from "./sleep.mjs";
import closePageSafely from "./closePageSafely.mjs";
import ensureNoiseBlocking from "./ensureNoiseBlocking.mjs";
import buildDurationText from "./buildDurationText.mjs";
import getSubmissionButtonsIfFound from "./getSubmissionButtonsIfFound.mjs";
import handleAfterSubmitDone from "./handleAfterSubmitDone.mjs";
import createDetailsPageWhatsappHandlers from "./createDetailsPageWhatsappHandlers.mjs";

// import updateSuperAcceptanceApiData from "./updateSuperAcceptanceApiData.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  htmlFilesPath,
  dashboardLinkSelector,
  homePageTableSelector,
  // acceptanceApiUrl,
  // globMedHeaders,
  // rejectionApiUrl,
  // estimatedTimeForProcessingAction,
} from "./constants.mjs";

// import humanClick from "./humanClick.mjs";
// import humanMouseMove from "./humanMouseMove.mjs";

const processClientActionOnPatient = async ({
  browser,
  actionType,
  patient,
  patientsStore,
  sendWhatsappMessage,
  continueFetchingPatientsIfPaused,
}) => {
  let preparingStartTime = Date.now();

  // const CLIENT_NAME = process.env.CLIENT_NAME;

  const {
    referralId,
    patientName,
    referralEndTimestamp,
    isSuperAcceptance,
    // providerName,
  } = patient;

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

  const [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    sendWhatsappMessage,
    startingPageUrl: HOME_PAGE_URL,
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
    4000
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

  // const isSupperAcceptanceOrRejection = isSuperAcceptance;

  await ensureNoiseBlocking(page);
  const remainingTimeMS = referralEndTimestamp - Date.now() - 83.5;

  console.log("remainingTimeMS", remainingTimeMS);

  if (remainingTimeMS > 0) {
    await sleep(remainingTimeMS);
  }

  const startTime = Date.now();

  try {
    await iconButton.click();

    let referralButtons;

    while (!referralButtons) {
      referralButtons = await getSubmissionButtonsIfFound(page);

      if (referralButtons) {
        break;
      }

      await page.click(dashboardLinkSelector);
      await sleep(120 + Math.random() * 60);
      const newReferralIdRecordResult = await collectHomePageTableRows(
        page,
        referralId,
        6000
      );

      if (newReferralIdRecordResult.iconButton) {
        await newReferralIdRecordResult.iconButton.click();
        continue;
      } else {
        const newReferralIdRecordResultX = await collectHomePageTableRows(
          page,
          referralId,
          6000
        );

        await newReferralIdRecordResultX.iconButton.click();
        continue;
      }
    }

    await selectAttachmentDropdownOption(page, actionName);

    const fileInput = await page.$('#upload-single-file input[type="file"]');
    await fileInput.uploadFile(filePath);

    const selectedButton = referralButtons[isAcceptance ? 0 : 1];

    await selectedButton.evaluate((el) => {
      el.scrollIntoView({ behavior: "auto", block: "center" });
    });

    await handleAfterSubmitDone({
      page,
      startTime,
      continueFetchingPatientsIfPaused,
      patientsStore,
      sendErrorMessage,
      sendSuccessMessage,
      closeCurrentPage,
      actionName,
      acceptanceFilePath,
      rejectionFilePath,
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
