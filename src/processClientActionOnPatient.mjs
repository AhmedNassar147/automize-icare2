/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import fs from "fs";
import path from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import humanClick from "./humanClick.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import goToHomePage from "./goToHomePage.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";
import selectAttactmentDropdownOption from "./selectAttactmentDropdownOption.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import collectReferralDetailsDateFromAPI from "./collectReferralDetailsDateFromAPI.mjs";
import sleep from "./sleep.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
} from "./constants.mjs";

// https://referralprogram.globemedsaudi.com/referrals/accept-referral
// {"data":{"isSuccessful":true},"statusCode":"Success","errorMessage":null}

// https://referralprogram.globemedsaudi.com/referrals/reject-referral
// {"data":{"isSuccessful":true},"statusCode":"Success","errorMessage":null

const checkIfButtonsFound = async (page) => {
  try {
    const section = await page.waitForSelector(
      "section.referral-button-container",
      { timeout: 1000 }
    );
    if (!section) return false;
    return await section.$$("button");
  } catch {
    return false;
  }
};

const MAX_RETRIES_FOR_SUBMISSION_BUTTONS = 4;
let submissionButtonsRetry = 0;

const processClientActionOnPatient = async (options) => {
  const {
    browser,
    actionType,
    patient,
    patientsStore,
    sendWhatsappMessage,
    page: pageFromOptions,
    cursor: cursorFromOptions,
  } = options;

  const { referralId, patientName } = patient;

  const actionName =
    actionType === USER_ACTION_TYPES.ACCEPT ? "Acceptance" : "Rejection";

  const isAcceptance = USER_ACTION_TYPES.ACCEPT === actionType;

  const logString = `details page for referralId=(${referralId})`;

  console.time(`action in ${logString}`);

  const baseMessage = `🚨 *\`${actionName.toUpperCase()}\`* Case Alert! 🚨
🆔 Referral: *${referralId}*
👤 Name: _${patientName}_\n`;

  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const sendErrorMessage = async (reason) => {
    const message = `🛑 Can't process patient ${actionName}\n${reason}`;
    await sendWhatsappMessage(phoneNumber, {
      message: `${baseMessage}❌ Status: *ERROR*\n*Reason*: _${message}_ ⚠️`,
    });
    console.log(`${message} in ${logString}`);
  };

  const [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    currentPage: pageFromOptions,
    cursor: cursorFromOptions,
  });

  if (!isLoggedIn) {
    await page.screenshot({
      path: `screenshots/user-action-no-loggedin-for-${referralId}-${Date.now()}.png`,
    });
    await sendErrorMessage("Login failed after 3 attempts.");
    return;
  }

  try {
    await sleep(150);

    const rows = await collectHomePageTableRows(page);

    if (!rows.length) {
      await page.screenshot({
        path: `screenshots/no-patients-in-home-table-${referralId}-${Date.now()}.png`,
      });
      return await sendErrorMessage("The Pending referrals list is empty.");
    }

    let button = null;

    for (const row of rows) {
      const currentReferralId = await getReferralIdBasedTableRow(page, row);

      if (currentReferralId === referralId) {
        button = await row.$("td:last-child button");
        break;
      }
    }

    if (!button) {
      await page.screenshot({
        path: `screenshots/navigation-button-not-found-for-${referralId}-${Date.now()}.png`,
      });
      return await sendErrorMessage(
        "The patient wasn't found in Pending referrals."
      );
    }

    const detailsApiDataPromise = collectReferralDetailsDateFromAPI({
      page,
      referralId,
      useOnlyDetailsApi: true,
    });

    console.log(`✅ clicking patient button for referralId=(${referralId})`);
    await humanClick(page, cursor, button);

    console.log(
      `✅ waiting 1.4s in ${logString} to make user action ${actionName}`
    );

    await sleep(1400);

    await makeKeyboardNoise(page, logString);

    const { timingData } = await detailsApiDataPromise;
    const { caseActualLeftMs } = timingData || {};

    console.log("timingData", timingData);

    const hasTimeingDataButStillHasLeftTime =
      !!timingData && caseActualLeftMs > 0;

    if (hasTimeingDataButStillHasLeftTime) {
      await goToHomePage(page, cursor);

      await sleep(
        caseActualLeftMs > 500 ? caseActualLeftMs - 500 : caseActualLeftMs
      );

      return await processClientActionOnPatient({
        ...options,
        page,
        cursor,
      }); // retry once
    }

    const referralButtons = await checkIfButtonsFound(page);

    const hasReachedMaxRetriesForSubmission =
      submissionButtonsRetry >= MAX_RETRIES_FOR_SUBMISSION_BUTTONS;

    if (!referralButtons && !hasReachedMaxRetriesForSubmission) {
      submissionButtonsRetry += 1;
      await goToHomePage(page, cursor);

      await sleep(80);

      return await processClientActionOnPatient({
        ...options,
        page,
        cursor,
      }); // retry once
    }

    if (!referralButtons && hasReachedMaxRetriesForSubmission) {
      await page.screenshot({
        path: `screenshots/submission-buttons-not-found-reachedMax-${hasReachedMaxRetriesForSubmission}-${Date.now()}.png`,
      });
      return await sendErrorMessage(
        `We tried times(${submissionButtonsRetry}) to find The submission buttons, but they wern't found.`
      );
    }

    console.log(`✅ Moving random cursor in ${logString}`);
    submissionButtonsRetry = 0;
    const [viewportHeight, sectionEl] = await scrollDetailsPageSections({
      page,
      cursor,
      logString,
      sectionsIndices: [1, 2],
      noCursorMovemntIfFailed: true,
    });

    if (!sectionEl) {
      await page.screenshot({
        path: `screenshots/upload-section-not-found-${referralId}-${Date.now()}.png`,
      });
      return await sendErrorMessage("The upload section was not found.");
    }

    await selectAttactmentDropdownOption({
      page,
      cursor,
      option: actionName,
      viewportHeight,
      sectionEl,
      logString,
    });

    const inputContainer = await sectionEl.$('div[id="upload-single-file"]');

    if (!inputContainer) {
      await page.screenshot({
        path: `screenshots/inputContainer-not-found-${referralId}-${Date.now()}.png`,
      });
      return await sendErrorMessage("The File upload container was not found.");
    }

    const fileInput = await inputContainer.$('input[type="file"]');

    if (!fileInput) {
      await page.screenshot({
        path: `screenshots/fileInput-not-found-${referralId}-${Date.now()}.png`,
      });
      return await sendErrorMessage("The File upload input was not found.");
    }

    const fileName = `${actionType}-${referralId}.pdf`;

    const baseFolderName = isAcceptance
      ? generatedPdfsPathForAcceptance
      : generatedPdfsPathForRejection;

    const filePath = path.join(baseFolderName, fileName);

    if (!fs.existsSync(filePath)) {
      return await sendErrorMessage(
        `The *${actionName}* file does not exist: _${filePath}_`
      );
    }

    console.log(`📎 Uploading file ${fileName} in ${logString}`);

    // let browseButton = await inputContainer.$(
    //   "button.MuiTypography-root.MuiLink-button"
    // );

    // if (!browseButton) {
    //   const [_browseButton] = await inputContainer.$x(
    //     './/button[contains(text(), "browse")]'
    //   );

    //   browseButton = _browseButton;
    // }

    // if (!browseButton) {
    //   await page.screenshot({
    //     path: `screenshots/browse-button-not-found-${referralId}-${Date.now()}.png`,
    //   });

    //   return await sendErrorMessage(`The "browse" button was not found.`);
    // }

    await makeKeyboardNoise(page, logString);

    console.log(`🖱️ Moving to "browse" button visually...`);

    // await cursor.move(browseButton, {
    //   moveDelay: 10 + Math.random() * 12,
    //   randomizeMoveDelay: true,
    //   maxTries: 6,
    //   moveSpeed: 1.4 + Math.random() * 0.3,
    // });

    await fileInput.uploadFile(filePath);
    await sleep(20);

    console.log(`✅ File uploaded successfully in ${logString}`);

    const [acceptButton, rejectButton] = referralButtons;

    const selectedButton = isAcceptance ? acceptButton : rejectButton;

    await page.evaluate(
      (el) => el.scrollIntoView({ behavior: "smooth", block: "center" }),
      selectedButton
    );

    await sleep(20);

    await humanClick(page, cursor, selectedButton);
  } catch (error) {
    console.log(
      `🛑 Error during ${actionName} of ${referralId}:`,
      error.message
    );

    await page.screenshot({
      path: `screenshots/catch-error-${actionName}-error-${referralId}-${Date.now()}.png`,
    });

    await sendErrorMessage(`Error: in ${logString} \n ${error.message}`);
  }

  console.timeEnd(`action in ${logString}`);
};

export default processClientActionOnPatient;
