import fs from "fs";
import path from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import humanClick from "./humanClick.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import goToHomePage from "./goToHomePage.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";
import selectAttactmentDropdownOption from "./selectAttactmentDropdownOption.mjs";
import getCurrentAlertRemainingTime from "./getCurrentAlertRemainingTime.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import sleep from "./sleep.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
} from "./constants.mjs";

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

  const baseMessage = `🚨 *\`${actionName.toUpperCase()}\`* Case Alert! 🚨
🆔 Referral: *${referralId}*
👤 Name: _${patientName}_\n`;

  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const sendErrorMessage = async (reason) => {
    const message = `🛑 Can't process patient ${actionName}\n${reason}`;
    await sendWhatsappMessage(phoneNumber, {
      message: `${baseMessage}❌ Status: *ERROR*\n*Reason*: _${message}_ ⚠️`,
    });
    console.log(message);
  };

  // 🔄 Login loop with retry
  let page, cursor, isLoggedIn;

  for (let i = 0; i < 3; i++) {
    [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
      browser,
      currentPage: pageFromOptions,
      cursor: cursorFromOptions,
    });

    if (isLoggedIn) {
      await sleep(1000);
      break;
    }
  }

  if (!isLoggedIn) {
    await sendErrorMessage("Login failed after 3 attempts.");
    return;
  }

  try {
    await sleep(500);

    const rows = await collectHomePageTableRows(page);

    if (!rows.length) {
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
      return await sendErrorMessage(
        "The patient wasn't found in Pending referrals."
      );
    }

    await Promise.all([
      page.waitForNavigation({
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      }),
      humanClick(page, cursor, button),
    ]);

    await sleep(40 + Math.random() * 50);

    await makeKeyboardNoise(page, logString);

    const referralButtons = await checkIfButtonsFound(page);

    if (!referralButtons) {
      const { totalRemainingTimeMs, hasMessageFound } =
        await getCurrentAlertRemainingTime(page);

      const baseDelay = 200 + Math.random() * 50;

      const delayTimeMS = hasMessageFound
        ? totalRemainingTimeMs || baseDelay
        : baseDelay;

      await goToHomePage(page, cursor);

      await sleep(delayTimeMS);

      return await processClientActionOnPatient({
        ...options,
        page,
        cursor,
      }); // retry once
    }

    console.log(`✅ Moving random cursor in ${logString}`);
    const [viewportHeight, sectionEl] = await scrollDetailsPageSections({
      page,
      cursor,
      logString,
      sectionsIndices: [1, 2],
    });

    if (!sectionEl) {
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
      return await sendErrorMessage("The File upload container was not found.");
    }

    const fileInput = await inputContainer.$('input[type="file"]');

    if (!fileInput) {
      return await sendErrorMessage("The File upload input was not found.");
    }

    const fileName = `${actionType}-${referralId}.pdf`;

    const baseFolderName = isAcceptance
      ? generatedPdfsPathForAcceptance
      : generatedPdfsPathForRejection;

    const filePath = path.join(baseFolderName, fileName);

    if (!fs.existsSync(filePath)) {
      return await sendErrorMessage(
        `The *${actionName}* file does not exist: _${fileName}_`
      );
    }

    console.log(`📎 Uploading file ${fileName} in ${logString}`);

    await cursor.move(fileInput, {
      moveDelay: 15 + Math.random() * 25,
      randomizeMoveDelay: true,
      maxTries: 4,
      moveSpeed: 1.25,
    });

    await fileInput.uploadFile(filePath);
    await sleep(500 + Math.random() * 700);

    console.log(`✅ File uploaded successfully in ${logString}`);
  } catch (error) {
    console.log(
      `🛑 Error during ${actionName} of ${referralId}:`,
      error.message
    );

    await sendErrorMessage(`Error: in ${logString} \n ${error.message}`);
  }
};

export default processClientActionOnPatient;
