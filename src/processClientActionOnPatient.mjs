/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import { unlink } from "fs/promises";
import { join, resolve } from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import checkPathExists from "./checkPathExists.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import humanClick from "./humanClick.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import goToHomePage from "./goToHomePage.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";
import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import collectReferralDetailsDateFromAPI from "./collectReferralDetailsDateFromAPI.mjs";
import sleep from "./sleep.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  estimatedTimeForProcessingAction,
} from "./constants.mjs";

const WHATS_APP_LOADING_TIME = 40_000;
const PAGE_LOAD_TIME = 1500;

const getSubmissionButtonsIfFound = async (page) => {
  try {
    const section = await page.waitForSelector(
      "section.referral-button-container",
      {
        timeout: 1000,
      }
    );
    if (!section) return false;

    const buttons = await section.$$("button");

    if (!buttons.length) return false;

    let acceptButton = null;
    let rejectButton = null;

    for (const btn of buttons) {
      const text = (await page.evaluate((el) => el.textContent, btn))
        .trim()
        .toLowerCase();

      if (text.includes("accept referral")) {
        acceptButton = btn;
      } else if (text.includes("reject referral")) {
        rejectButton = btn;
      }
    }

    if (acceptButton && rejectButton) {
      return [acceptButton, rejectButton];
    }

    return false;
  } catch {
    return false;
  }
};

const buildDurationText = (startTime, endTime) => {
  const executionDurationMs = endTime - startTime;

  const durationText = `🕒 *Took*: \`${(executionDurationMs / 1000).toFixed(
    1
  )} seconds\``;

  return durationText;
};

const MAX_RETRIES_FOR_SUBMISSION_BUTTONS = 4;

const processClientActionOnPatient = async (options) => {
  const startTime = Date.now();
  const {
    browser,
    actionType,
    patient,
    patientsStore,
    sendWhatsappMessage,
    page: pageFromOptions,
    cursor: cursorFromOptions,
  } = options;

  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const { referralId, patientName } = patient;

  const isAcceptance = USER_ACTION_TYPES.ACCEPT === actionType;

  const actionName = isAcceptance ? "Acceptance" : "Rejection";

  const logString = `details page referralId=(${referralId})`;

  const endpoint = isAcceptance
    ? "referrals/accept-referral"
    : "referrals/reject-referral";

  const baseMessage = `🚨 *\`${actionName.toUpperCase()}\`* Case Alert! 🚨
🆔 Referral: *${referralId}*
👤 Name: _${patientName}_\n`;

  const [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    currentPage: pageFromOptions,
    cursor: cursorFromOptions,
    sendWhatsappMessage,
  });

  if (!isLoggedIn) {
    await sendErrorMessage(
      "Login failed after 3 attempts.",
      "user-action-no-loggedin",
      buildDurationText(startTime, Date.now())
    );
    return;
  }

  const sendSuccessMessage = async (durationText) => {
    try {
      const timeStamp = Date.now();
      const status = isAcceptance ? "Accepted" : "Rejected";

      await sendWhatsappMessage(phoneNumber, {
        message: `${baseMessage}✅ Status: *SUCCESS*\nPatient has been *${status}*\n${durationText}\n🕓 *timeStamp*: ${timeStamp}`,
      });

      console.log(`✅ ${status} ${durationText} in ${logString}`);
    } catch (error) {
      console.log("Error when sending whatsapp success data");
    }
  };

  const sendErrorMessage = async (reason, fileName, durationText = "") => {
    try {
      const timeStamp = Date.now();

      const fullMessage = `${baseMessage}❌ Status: *ERROR*\n*Reason*: ${reason}\n${durationText}\n🕓 *timeStamp*: ${timeStamp}`;

      await Promise.allSettled([
        sendWhatsappMessage(phoneNumber, { message: fullMessage }),
        fileName
          ? page.screenshot({
              path: `screenshots/${fileName}-for-${referralId}-${timeStamp}.png`,
            })
          : Promise.resolve(),
      ]);

      console.log(`❌ ${reason} ${durationText} in ${logString}`);
    } catch (error) {
      console.log("Error when sending whatsapp error data");
    }
  };

  const acceptanceFilePath = join(
    generatedPdfsPathForAcceptance,
    `${USER_ACTION_TYPES.ACCEPT}-${referralId}.pdf`
  );

  const rejectionFilePath = join(
    generatedPdfsPathForRejection,
    `${USER_ACTION_TYPES.REJECT}-${referralId}.pdf`
  );

  const filePath = isAcceptance ? acceptanceFilePath : rejectionFilePath;
  const ifLettersGenerated = await checkPathExists(filePath);

  if (!ifLettersGenerated) {
    return await sendErrorMessage(
      `The *${actionName}* file doesn't exist: \`${filePath}\``,
      undefined,
      buildDurationText(startTime, Date.now())
    );
  }

  let submissionButtonsRetry = 0;

  while (true) {
    try {
      const referralIdRecordResult = await collectHomePageTableRows(
        page,
        referralId
      );

      if (!referralIdRecordResult) {
        await sendErrorMessage(
          "The Pending referrals list is empty.",
          "no-patients-in-home-table",
          buildDurationText(startTime, Date.now())
        );

        break;
      }

      const { iconButton } = referralIdRecordResult;

      if (!iconButton) {
        await sendErrorMessage(
          "The patient wasn't found in Pending referrals.",
          "navigation-button-not-found",
          buildDurationText(startTime, Date.now())
        );
        break;
      }

      // Ensure the icon is in view (scrolling horizontally)
      await page.evaluate(
        (el) =>
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "end",
          }),
        iconButton
      );

      const detailsApiDataPromise = collectReferralDetailsDateFromAPI({
        page,
        referralId,
        useOnlyDetailsApi: true,
        useDefaultMessageIfNotFound: false,
      });

      console.log(`✅ clicking patient button for referralId=(${referralId})`);
      await humanClick(page, cursor, iconButton);

      console.log(
        `✅ waiting 1.5s in ${logString} to make user action ${actionName}`
      );

      await sleep(PAGE_LOAD_TIME);

      await makeKeyboardNoise(page, logString);

      const detailsApiData = await detailsApiDataPromise;

      const { caseActualLeftMs } = detailsApiData;

      const isLeftMsNumber = typeof caseActualLeftMs === "number";

      console.log("detailsApiData", JSON.stringify(detailsApiData, null, 2));

      const hasTimeingDataButStillHasLeftTime =
        isLeftMsNumber && caseActualLeftMs > 0;

      if (hasTimeingDataButStillHasLeftTime) {
        await goToHomePage(page, cursor);

        const sleepTime =
          caseActualLeftMs >= 4000 ? caseActualLeftMs - 2000 : 0;

        await sleep(sleepTime);

        continue;
      }

      const referralButtons = await getSubmissionButtonsIfFound(page);

      const hasReachedMaxRetriesForSubmission =
        submissionButtonsRetry >= MAX_RETRIES_FOR_SUBMISSION_BUTTONS;

      if (!referralButtons && hasReachedMaxRetriesForSubmission) {
        await sendErrorMessage(
          `We tried times(${submissionButtonsRetry}) to find The submission buttons, but they wern't found.`,
          "submission-buttons-not-found-reachedMax",
          buildDurationText(startTime, Date.now())
        );

        break;
      }

      if (!referralButtons) {
        await goToHomePage(page, cursor);
        submissionButtonsRetry += 1;

        continue;
      }

      const [viewportHeight, sectionEl] = await scrollDetailsPageSections({
        page,
        cursor,
        logString,
        sectionsIndices: [1, 2],
        noCursorMovemntIfFailed: true,
      });

      if (!sectionEl) {
        await sendErrorMessage(
          "The upload section was not found.",
          "upload-section-not-found",
          buildDurationText(startTime, Date.now())
        );
        break;
      }

      await selectAttachmentDropdownOption({
        page,
        cursor,
        option: actionName,
        viewportHeight,
        sectionEl,
        logString,
      });

      const inputContainer = await sectionEl.$('div[id="upload-single-file"]');

      if (!inputContainer) {
        await sendErrorMessage(
          "The File upload container was not found.",
          "inputContainer-not-found",
          buildDurationText(startTime, Date.now())
        );
        break;
      }

      const fileInput = await inputContainer.$('input[type="file"]');

      if (!fileInput) {
        await sendErrorMessage(
          "The File upload input was not found.",
          "fileInput-not-found",
          buildDurationText(startTime, Date.now())
        );
        break;
      }

      console.log(`📎 Uploading file ${filePath} in ${logString}`);

      await makeKeyboardNoise(page, logString);

      await fileInput.uploadFile(resolve(filePath));
      await sleep(20);

      console.log(`✅ File uploaded successfully in ${logString}`);

      const [acceptButton, rejectButton] = referralButtons;

      const selectedButton = isAcceptance ? acceptButton : rejectButton;

      await page.evaluate(
        (el) => el.scrollIntoView({ behavior: "smooth", block: "center" }),
        selectedButton
      );

      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().toLowerCase().includes(endpoint) &&
          res.request().method() === "POST" &&
          res.status() >= 200 &&
          res.status() < 300,
        { timeout: 45_000 }
      );

      await humanClick(page, cursor, selectedButton);
      const durationText = buildDurationText(startTime, Date.now());

      let errorMessage = "No response";
      let apiCatchError = "";
      let statusCode = "Unknown";

      try {
        const response = await responsePromise;
        const headersRaw = response.headers();

        const headers = Object.fromEntries(
          Object.entries(headersRaw).map(([k, v]) => [k.toLowerCase(), v])
        );

        const contentType = headers["content-type"] || "";

        if (contentType.includes("json")) {
          const json = await response.json();
          statusCode = json?.statusCode ?? "Unknown";
          errorMessage = json?.errorMessage ?? "No errorMessage";
        } else {
          const text = await response.text();
          try {
            const parsedText = JSON.parse(text);
            statusCode = parsedText?.statusCode ?? "Unknown";
            errorMessage = parsedText?.errorMessage ?? "No errorMessage";
          } catch (error) {
            errorMessage = `Non-JSON response: ${text}`;
            apiCatchError = `Tried to parse non-JSON response: ${error.message}`;
          }
        }
      } catch (err) {
        apiCatchError = err.message;
        console.log(
          `🛑 Error during submission API call ${actionName} of ${referralId}:`,
          apiCatchError
        );
      }

      const success = statusCode === "Success";

      if (!success) {
        await sendErrorMessage(
          `\n*globMedServerError:* ${errorMessage}\n*submissionApiCatchError:* ${apiCatchError}\n*statusCode:* ${statusCode}`,
          `globMedServerError-api-error-${actionName}`,
          durationText
        );

        await sleep(WHATS_APP_LOADING_TIME);
        break;
      }

      await sendSuccessMessage(durationText);

      const deletionResponse = await patientsStore.removePatientByReferralId(
        referralId
      );

      await Promise.allSettled([
        checkPathExists(acceptanceFilePath).then(
          (exists) => exists && unlink(acceptanceFilePath)
        ),
        checkPathExists(rejectionFilePath).then(
          (exists) => exists && unlink(rejectionFilePath)
        ),
      ]);

      console.log(deletionResponse?.message);
      await sleep(WHATS_APP_LOADING_TIME);
      await page.close();
    } catch (error) {
      const err = error.message;

      console.log(`🛑 Error during ${actionName} of ${referralId}:`, err);
      await sendErrorMessage(
        `Error: ${err}`,
        `catch-error-${actionName}-error`,
        buildDurationText(startTime, Date.now())
      );
      break;
    }
  }
};

export default processClientActionOnPatient;

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

// console.log(`🖱️ Moving to "browse" button visually...`);

// await cursor.move(browseButton, {
//   moveDelay: 10 + Math.random() * 12,
//   randomizeMoveDelay: true,
//   maxTries: 6,
//   moveSpeed: 1.4 + Math.random() * 0.3,
// });
