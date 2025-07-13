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
import closePageSafely from "./closePageSafely.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
} from "./constants.mjs";

// const endpoint = isAcceptance
//   ? "referrals/accept-referral"
//   : "referrals/reject-referral";

const WHATS_APP_LOADING_TIME = 45_000;
const MAX_RETRIES = 6;

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
  } catch (err) {
    console.log("❌ Failed to get submission buttons:", err.message);
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

const processClientActionOnPatient = async ({
  browser,
  actionType,
  patient,
  patientsStore,
  sendWhatsappMessage,
}) => {
  let preparingStartTime = Date.now();

  console.time("🕒 prepare_user_action_start_time");
  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const { referralId, patientName, caseActualWillBeSubmittedAtMS } = patient;

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

  const filePath = isAcceptance ? acceptanceFilePath : rejectionFilePath;

  const baseMessage = `🚨 *\`${actionName.toUpperCase()}\`* Case Alert! 🚨
🆔 Referral: *${referralId}*
👤 Name: _${patientName}_\n`;

  const [page, cursor, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
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

  const closeCurrentPage = async (navigateToHomePage) => {
    if (navigateToHomePage) {
      await goToHomePage(page, cursor);
    }
    await sleep(WHATS_APP_LOADING_TIME);
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

  await sleep(20);
  const referralIdRecordResult = await collectHomePageTableRows(
    page,
    referralId
  );

  let { iconButton } = referralIdRecordResult || {};

  if (!iconButton) {
    console.log("referralIdRecordResult: ", referralIdRecordResult);
    await sendErrorMessage(
      "The Pending referrals list is empty or eye button not found.",
      "no-patients-in-home-table",
      buildDurationText(preparingStartTime, Date.now())
    );

    await closeCurrentPage(false);
    return;
  }

  console.timeEnd("🕒 prepare_user_action_start_time");

  const diff = caseActualWillBeSubmittedAtMS - Date.now();

  console.log("diff to execute action: ", diff);

  if (diff > 0) {
    await sleep(diff);
  }

  let submissionButtonsRetry = 0;
  let checkDetailsPageRetry = 0;

  const startTime = Date.now();

  while (true) {
    try {
      if (submissionButtonsRetry || checkDetailsPageRetry) {
        const referralIdRecordResultData = await collectHomePageTableRows(
          page,
          referralId
        );

        if (referralIdRecordResultData?.iconButton) {
          iconButton = referralIdRecordResultData?.iconButton;
        }
      }

      await iconButton.click();

      const areWeInDetailsPage = await checkIfWeInDetailsPage(page);

      if (!areWeInDetailsPage) {
        const hasReachedMaxRetriesForDetailsPage =
          checkDetailsPageRetry >= MAX_RETRIES;

        if (hasReachedMaxRetriesForDetailsPage) {
          await sendErrorMessage(
            `Tried ${checkDetailsPageRetry} times to enter the details page, but there is something wrong.`,
            "enter-details-page-failed-reachedMax",
            buildDurationText(startTime, Date.now())
          );

          await closeCurrentPage(false);
          break;
        }

        await goToHomePage(page, cursor);
        checkDetailsPageRetry += 1;
        continue;
      }

      const referralButtons = await getSubmissionButtonsIfFound(page);

      if (!referralButtons) {
        const hasReachedMaxRetriesForSubmission =
          submissionButtonsRetry >= MAX_RETRIES;

        if (hasReachedMaxRetriesForSubmission) {
          await sendErrorMessage(
            `Tried ${submissionButtonsRetry} times to find the submission buttons, but none were found.`,
            "submission-buttons-not-found-reachedMax",
            buildDurationText(startTime, Date.now())
          );

          await closeCurrentPage(true);
          break;
        }

        await goToHomePage(page, cursor);
        submissionButtonsRetry += 1;
        continue;
      }

      // console.time("🕒 scoll_sections_time");
      // console.timeEnd("🕒 scoll_sections_time");
      const sectionEl = await scrollDetailsPageSections({
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

        await closeCurrentPage(true);
        break;
      }

      // console.time("🕒 select_action_option_time");
      // console.timeEnd("🕒 select_action_option_time");
      const hasOptionSelected = await selectAttachmentDropdownOption({
        page,
        cursor,
        option: actionName,
        // viewportHeight,
        sectionEl,
        logString,
      });

      if (!hasOptionSelected) {
        await sendErrorMessage(
          `We tried times to select ${actionName}, but couldn't.`,
          "list-item-not-found",
          buildDurationText(startTime, Date.now())
        );
        await closeCurrentPage(true);
        break;
      }

      await makeKeyboardNoise(page, logString);

      try {
        const fileInput = await page.$(
          '#upload-single-file input[type="file"]'
        );

        await fileInput.uploadFile(resolve(filePath));
      } catch (error) {
        const err = error?.message || String(error);
        await sendErrorMessage(
          `Error happens when uploading file \`${filePath}\`\n*catchError:*: ${err}`,
          "file-upload-error",
          buildDurationText(startTime, Date.now())
        );

        await closeCurrentPage(true);
        break;
      }

      const [acceptButton, rejectButton] = referralButtons;

      const selectedButton = isAcceptance ? acceptButton : rejectButton;

      await selectedButton.scrollIntoViewIfNeeded({ timeout: 4000 });

      await humanClick(page, cursor, selectedButton);

      const durationText = buildDurationText(startTime, Date.now());
      await sleep(8000);

      const currentPageUrl = page.url();

      const isRequestDone = currentPageUrl
        .toLowerCase()
        .includes("dashboard/referral");

      if (!isRequestDone) {
        await sendErrorMessage(
          "app didn't redirect to home after submission",
          `no-home-redirect-action-${actionName}`,
          durationText
        );

        await closeCurrentPage(false);
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
      await closeCurrentPage(false);
      break;
    } catch (error) {
      const _err = error?.message || String(error);

      console.log(`🛑 Error during ${actionName} of ${referralId}:`, _err);
      await sendErrorMessage(
        `Error: ${_err}`,
        `catch-error-${actionName}-error`,
        buildDurationText(startTime, Date.now())
      );
      await closeCurrentPage(false);
      break;
    }
  }
};

export default processClientActionOnPatient;

// console.time("🕒 click-upper-item");
// await searchForItemCountAndClickItIfFound(
//   page,
//   "Confirmed Referrals",
//   true
// );
// console.timeEnd("🕒 click-upper-item");

// const responsePromise = page.waitForResponse(
//         (res) =>
//           res.url().toLowerCase().includes(endpoint) &&
//           res.request().method() === "POST" &&
//           res.status() >= 200 &&
//           res.status() < 300,
//         { timeout: 40_000 }
//       );

// let errorMessage = "No response";
// let apiCatchError = "";
// let statusCode = "Unknown";

// try {
//   const response = await responsePromise;
//   const headersRaw = response.headers();

//   const headers = Object.fromEntries(
//     Object.entries(headersRaw).map(([k, v]) => [k.toLowerCase(), v])
//   );

//   const contentType = headers["content-type"] || "";

//   if (contentType.includes("json")) {
//     const json = await response.json();
//     statusCode = json?.statusCode ?? "Unknown";
//     errorMessage = json?.errorMessage ?? "No errorMessage";
//   } else {
//     const text = await response.text();
//     try {
//       const parsedText = JSON.parse(text);
//       statusCode = parsedText?.statusCode ?? "Unknown";
//       errorMessage = parsedText?.errorMessage ?? "No errorMessage";
//     } catch (error) {
//       const err = error?.message || String(error);

//       errorMessage = `Non-JSON response: ${text}`;
//       apiCatchError = `Tried to parse non-JSON response: ${err}`;
//     }
//   }
// } catch (err) {
//   const _err = err?.message || String(err);

//   apiCatchError = _err;
//   console.log(
//     `🛑 Error during submission API call ${actionName} of ${referralId}:`,
//     _err
//   );
// }

// console.time("🕒 keyboard_noise_action");
// await makeKeyboardNoise(page, logString);
// console.timeEnd("🕒 keyboard_noise_action");

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
