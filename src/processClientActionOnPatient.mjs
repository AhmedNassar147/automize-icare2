/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import { unlink } from "fs/promises";
import { join, resolve } from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import checkPathExists from "./checkPathExists.mjs";
import humanClick from "./humanClick.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import goToHomePage from "./goToHomePage.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";
import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import checkIfWeInDetailsPage from "./checkIfWeInDetailsPage.mjs";
import sleep from "./sleep.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
} from "./constants.mjs";

// console.time("🕒 click-upper-item");
// await searchForItemCountAndClickItIfFound(
//   page,
//   "Confirmed Referrals",
//   true
// );
// console.timeEnd("🕒 click-upper-item");

const WHATS_APP_LOADING_TIME = 45_000;

const startingPageUrl =
  "https://referralprogram.globemedsaudi.com/Dashboard/Referral";

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

const MAX_RETRIES_FOR_SUBMISSION_BUTTONS = 6;

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

  console.time("🕒 initiate-action-home");
  const [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    currentPage: pageFromOptions,
    cursor: cursorFromOptions,
    sendWhatsappMessage,
    startingPageUrl,
  });

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

  if (!isLoggedIn) {
    await sendErrorMessage(
      "Login failed after 3 attempts.",
      "user-action-no-loggedin",
      buildDurationText(startTime, Date.now())
    );

    return;
  }

  console.timeEnd("🕒 initiate-action-home");

  const acceptanceFilePath = join(
    generatedPdfsPathForAcceptance,
    `${USER_ACTION_TYPES.ACCEPT}-${referralId}.pdf`
  );

  const rejectionFilePath = join(
    generatedPdfsPathForRejection,
    `${USER_ACTION_TYPES.REJECT}-${referralId}.pdf`
  );

  const filePath = isAcceptance ? acceptanceFilePath : rejectionFilePath;

  let submissionButtonsRetry = 0;

  while (true) {
    try {
      console.time("🕒 action_page_referral_button_collection");
      const referralIdRecordResult = await collectHomePageTableRows(
        page,
        referralId
      );

      const { iconButton } = referralIdRecordResult || {};

      if (!iconButton) {
        await sendErrorMessage(
          "The Pending referrals list is empty or eye button not found.",
          "no-patients-in-home-table",
          buildDurationText(startTime, Date.now())
        );
        break;
      }
      console.timeEnd("🕒 action_page_referral_button_collection");

      await sleep(20 + Math.random() * 50);
      await iconButton.click();
      const areWeInDetailsPage = await checkIfWeInDetailsPage(page);

      if (!areWeInDetailsPage) {
        await sleep(3000);
        console.log("we are not in details page");
        continue;
      }

      console.time("🕒 keyboard_noise_action");
      await makeKeyboardNoise(page, logString);
      console.timeEnd("🕒 keyboard_noise_action");

      console.time("🕒 buttons_collect_action");
      const referralButtons = await getSubmissionButtonsIfFound(page);
      console.timeEnd("🕒 buttons_collect_action");

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
        await sleep(80 + Math.random() * 20);
        submissionButtonsRetry += 1;
        continue;
      }

      console.time("🕒 scrollDetailsPageSections");
      const [viewportHeight, sectionEl] = await scrollDetailsPageSections({
        page,
        cursor,
        logString,
        sectionsIndices: [1, 2],
        noCursorMovemntIfFailed: true,
      });
      console.timeEnd("🕒 scrollDetailsPageSections");

      if (!sectionEl) {
        await sendErrorMessage(
          "The upload section was not found.",
          "upload-section-not-found",
          buildDurationText(startTime, Date.now())
        );
        break;
      }

      console.time("🕒 select_action_option");
      await selectAttachmentDropdownOption({
        page,
        cursor,
        option: actionName,
        viewportHeight,
        sectionEl,
        logString,
      });
      console.timeEnd("🕒 select_action_option");

      const fileInput = await page.$('#upload-single-file input[type="file"]');

      await makeKeyboardNoise(page, logString);

      console.time("🕒 file-upload-time");
      try {
        await fileInput.uploadFile(resolve(filePath));
      } catch (error) {
        const err = error?.message || String(error);
        await sendErrorMessage(
          `Error happens when uploading file \`${filePath}\`\n*catchError:*: ${err}`,
          "file-upload-error",
          buildDurationText(startTime, Date.now())
        );

        break;
      }
      console.timeEnd("🕒 file-upload-time");

      const [acceptButton, rejectButton] = referralButtons;

      const selectedButton = isAcceptance ? acceptButton : rejectButton;

      console.time("🕒 submission-button-scroll-to-click");
      await selectedButton.scrollIntoViewIfNeeded({ timeout: 3000 });

      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().toLowerCase().includes(endpoint) &&
          res.request().method() === "POST" &&
          res.status() >= 200 &&
          res.status() < 300,
        { timeout: 40_000 }
      );

      await humanClick(page, cursor, selectedButton);
      const durationText = buildDurationText(startTime, Date.now());
      console.timeEnd("🕒 submission-button-scroll-to-click");

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
            const err = error?.message || String(error);

            errorMessage = `Non-JSON response: ${text}`;
            apiCatchError = `Tried to parse non-JSON response: ${err}`;
          }
        }
      } catch (err) {
        const _err = err?.message || String(err);

        apiCatchError = _err;
        console.log(
          `🛑 Error during submission API call ${actionName} of ${referralId}:`,
          _err
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
      break;
    } catch (error) {
      const _err = error?.message || String(error);

      console.log(`🛑 Error during ${actionName} of ${referralId}:`, _err);
      await sendErrorMessage(
        `Error: ${_err}`,
        `catch-error-${actionName}-error`,
        buildDurationText(startTime, Date.now())
      );
      break;
    }
  }
};

export default processClientActionOnPatient;

// console.time("🕒 scroll_eye_button");
// await iconButton.scrollIntoViewIfNeeded({ timeout: 3000 });
// console.time("actionPageVisitTime");
// await humanClick(page, cursor, iconButton);
// console.timeEnd("actionPageVisitTime");
// console.time("🕒 scroll_eye_button");

// const { totalRemainingTimeMs, ...otherSnakBardData } =
//   await getCurrentAlertRemainingTime(page);

// console.log(
//   "detailsApiData",
//   JSON.stringify({ totalRemainingTimeMs, ...otherSnakBardData }, null, 2)
// );

// const hasTimeingDataButStillHasLeftTime = totalRemainingTimeMs > 0;

// if (hasTimeingDataButStillHasLeftTime) {
//   await goToHomePage(page, cursor);

//   const sleepTime =
//     totalRemainingTimeMs >= 4000 ? totalRemainingTimeMs - 2000 : 0;

//   await sleep(sleepTime);

//   continue;
// }

// const inputContainer = await sectionEl.$('div[id="upload-single-file"]');

// if (!inputContainer) {
//   await sendErrorMessage(
//     "The File upload container was not found.",
//     "inputContainer-not-found",
//     buildDurationText(startTime, Date.now())
//   );
//   break;
// }

// if (!fileInput) {
//   await sendErrorMessage(
//     "The File upload input was not found.",
//     "fileInput-not-found",
//     buildDurationText(startTime, Date.now())
//   );
//   break;
// }

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
