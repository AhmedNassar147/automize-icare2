/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 *
 */
import { createCursor } from "ghost-cursor";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import humanClick from "./humanClick.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import goToHomePage from "./goToHomePage.mjs";
import moveFromCurrentToRandomPosition from "./moveFromCurrentToRandomPosition.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";
import selectAttactmentDropdownOption from "./selectAttactmentDropdownOption.mjs";
import getCurrentAlertRemainingTime from "./getCurrentAlertRemainingTime.mjs";
import sleep from "./sleep.mjs";
import { USER_ACTION_TYPES, generatedPdfsPath, APP_URL } from "./constants.mjs";

// https://referralprogram.globemedsaudi.com/referrals/accept-referral
// {"data":{"isSuccessful":true},"statusCode":"Success","errorMessage":null}

const checkIfButtonsFound = async (page) => {
  try {
    const section = await page.waitForSelector(
      "section.referral-button-container",
      {
        timeout: 1000,
      }
    );

    if (!section) return false;

    const buttons = await section.$$("button");

    return buttons;
  } catch (e) {
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

  console.time("process");

  let page = pageFromOptions;
  let cursor = cursorFromOptions;

  if (!pageFromOptions || !cursorFromOptions) {
    page = await browser.newPage();
    cursor = createCursor(page);

    await page.goto(APP_URL, {
      waitUntil: "networkidle2",
      timeout: 120_000,
    });
  }

  const { referralId, patientName } = patient;

  const logString = `details page for referralId=(${referralId})`;

  const isAcceptance = USER_ACTION_TYPES.ACCEPT === actionType;

  const actionName = isAcceptance ? "Acceptance" : "Rejection";

  const baseMessage = `🚨 *\`${actionName.toUpperCase()}\`* Case Alert! 🚨
🆔 Referral: *${referralId}*
👤 Name: _${patientName}_

`;

  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  try {
    await sleep(600);
    const rows = await collectHomePageTableRows(page);

    if (!rows.length) {
      const message = `🛑 Can't process patient ${actionName}\nThe Pending referral are empty.`;

      await sendWhatsappMessage(phoneNumber, {
        message: `${baseMessage}❌ Status: *ERROR*\n*Reason*: _${message}_ ⚠️`,
      });

      console.log(message);
      return;
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
      const message = `🛑 Can't process patient ${actionName}\nThe patient wasn't found in Pending referrals.`;

      await sendWhatsappMessage(phoneNumber, {
        message: `${baseMessage}❌ Status: *ERROR*\n*Reason*: _${message}_ ⚠️`,
      });

      console.log(message);
      return;
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
      try {
        await goToHomePage(page, cursor);
      } catch (error) {
        console.log(
          "Error when get back to home when process user action",
          error.message
        );
      }

      const { totalRemainingTimeMs, hasMessageFound } =
        await getCurrentAlertRemainingTime(page);

      const delayTimeMS = hasMessageFound
        ? totalRemainingTimeMs || 50
        : 250 + Math.random() * 50;

      await sleep(delayTimeMS);
      return processClientActionOnPatient({ ...options, page, cursor });
    }

    console.log(`✅ moving radnom cursor in ${logString}`);
    // await moveFromCurrentToRandomPosition(cursor);

    const [viewportHeight, sectionEl] = await scrollDetailsPageSections({
      page,
      cursor,
      logString,
      sectionsIndices: [1, 2],
    });

    if (!sectionEl) {
      const message = `🛑 Can't process patient ${actionName}\nThe upload section not found.`;

      await sendWhatsappMessage(phoneNumber, {
        message: `${baseMessage}❌ Status: *ERROR*\n*Reason*: _${message}_ ⚠️`,
      });

      console.log(message);
      return;
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
      const message = `🛑 Can't process patient ${actionName}\nThe File upload container not found.`;

      await sendWhatsappMessage(phoneNumber, {
        message: `${baseMessage}❌ Status: *ERROR*\n*Reason*: _${message}_ ⚠️`,
      });

      console.log(message);
      return;
    }

    const fileInput = await inputContainer.$('input[type="file"]');

    if (!fileInput) {
      const message = `🛑 Can't process patient ${actionName}\nThe File upload input not found.`;

      await sendWhatsappMessage(phoneNumber, {
        message: `${baseMessage}❌ Status: *ERROR*\n*Reason*: _${message}_ ⚠️`,
      });

      console.log(message);

      return;
    }

    console.log(
      `🖱️ Moving cursor to file input before uploading in ${logString}`
    );

    await cursor.move(fileInput, {
      moveDelay: 20 + Math.random() * 30,
      randomizeMoveDelay: true,
      maxTries: 4,
      moveSpeed: 1.25,
    });

    const fileName = `${actionType}-${referralId}.pdf`;

    const filePath = `${generatedPdfsPath}/${fileName}`;

    console.log(`🖱️ Upload file=${fileName} in ${logString}...`);
    await fileInput.uploadFile(filePath);

    // // ✅ Then trigger `change` event (only needed if UI doesn't react)
    // await fileInput.evaluate((input) => {
    //   const evt = new Event("change", { bubbles: true });
    //   input.dispatchEvent(evt);
    // });

    console.log(`📎 File uploaded successfully in ${logString}`);
  } catch (error) {
    console.log(
      `Error when client action=${actionType} in ${logString}`,
      error.message
    );
  }

  console.timeEnd("process");
};

export default processClientActionOnPatient;
