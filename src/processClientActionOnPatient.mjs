/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import { unlink, writeFile } from "fs/promises";
import { join, resolve } from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import checkPathExists from "./checkPathExists.mjs";
// import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import goToHomePage from "./goToHomePage.mjs";
import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import sleep from "./sleep.mjs";
import closePageSafely from "./closePageSafely.mjs";
// import humanMouseMove from "./humanMouseMove.mjs";
// import humanClick from "./humanClick.mjs";
// import humanScrollToElement from "./humanScrollToElement.mjs";
import clickButtonThatObservedByRecapctahaInvisbleV2 from "./clickButtonThatObservedByRecapctahaInvisbleV2.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  htmlFilesPath,
} from "./constants.mjs";

const MAX_RETRIES = 8;
const buttonsSelector = "section.referral-button-container button";

const getSubmissionButtonsIfFound = async (page) => {
  try {
    await page.waitForSelector(buttonsSelector, {
      timeout: 1500,
      // visible: true,
    });

    const buttons = await page.$$(buttonsSelector);

    if (buttons.length < 2) return false;

    return buttons;
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

const isPageUsingStrictRecaptchaMode = true;

const processClientActionOnPatient = async ({
  browser,
  actionType,
  patient,
  patientsStore,
  sendWhatsappMessage,
}) => {
  let preparingStartTime = Date.now();

  // console.time("🕒 prepare_user_action_start_time");
  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const { referralId, patientName, referralEndTimestamp, isSuperAcceptance } =
    patient;

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

  const baseMessage = `🚨 *\`${actionName.toUpperCase()}\`* Case Alert! 🚨
🆔 Referral: *${referralId}*
👤 Name: _${patientName}_\n`;

  const [page, _, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    sendWhatsappMessage,
    startingPageUrl: HOME_PAGE_URL,
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

  let submissionButtonsRetry = 0;
  let checkDetailsPageRetry = 0;

  if (isSuperAcceptance) {
    console.log(`supper acceptance is running on patient ${referralId}`);
  }

  const createTimeLabel = (label) =>
    `${label}_${referralId}_${submissionButtonsRetry}`;

  // console.timeEnd("🕒 prepare_user_action_start_time");

  const remainingTimeMS = referralEndTimestamp - Date.now() - 84.5;

  if (remainingTimeMS > 0) {
    console.log("remainingTimeMS to execute action: ", remainingTimeMS);
    await sleep(remainingTimeMS);
  }

  while (true) {
    const startTime = Date.now();

    try {
      if (submissionButtonsRetry || checkDetailsPageRetry) {
        console.log(
          `referralId=${referralId}_RETURNED_TO_HOME_times_${
            submissionButtonsRetry + checkDetailsPageRetry
          }`
        );
        const referralIdRecordResultData = await collectHomePageTableRows(
          page,
          referralId
        );

        if (referralIdRecordResultData?.iconButton) {
          iconButton = referralIdRecordResultData?.iconButton;
        }
      }

      // const iconButtonClickLabel = createTimeLabel("click_eye");
      // console.time(iconButtonClickLabel);
      await iconButton.click();
      // console.timeEnd(iconButtonClickLabel);

      // const timmingLabel = createTimeLabel("buttons_check");
      // console.time(timmingLabel);
      const referralButtons = await getSubmissionButtonsIfFound(page);
      // console.timeEnd(timmingLabel);

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

        submissionButtonsRetry += 1;
        await goToHomePage(page);
        continue;
      }

      // const first = createTimeLabel("first");
      // console.time(first);
      // await page.keyboard.press("ArrowDown");
      // console.timeEnd(first);

      // const check_dropdown = createTimeLabel("check_dropdown");
      // console.time(check_dropdown);
      // const [hasOptionSelected, selectionError] =
      await selectAttachmentDropdownOption(
        page,
        actionName,
        isPageUsingStrictRecaptchaMode
      );
      // console.timeEnd(check_dropdown);

      // const upload = createTimeLabel("upload");
      // console.time(upload);
      try {
        const fileInput = await page.$(
          '#upload-single-file input[type="file"]'
        );

        // const browse_button = createTimeLabel("browse");
        // console.time(browse_button);
        // const browseButton = await page.$("#upload-single-file button");
        // if (browseButton) {
        //   await browseButton.hover();
        // }
        // console.timeEnd(browse_button);
        await fileInput.uploadFile(filePath);
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
      // console.timeEnd(upload);

      const selectedButton = isAcceptance
        ? referralButtons[0]
        : referralButtons[1];

      // const last_scroll = createTimeLabel("last_scroll");
      // console.time(last_scroll);
      await selectedButton.scrollIntoViewIfNeeded({ timeout: 2500 });
      // await page.keyboard.press("ArrowDown");
      // console.timeEnd(last_scroll);

      const submit_time = createTimeLabel("submit");
      console.time(submit_time);
      await clickButtonThatObservedByRecapctahaInvisbleV2(page, selectedButton);

      // if (isSuperAcceptance) {
      //   await humanClick(page, selectedButton, {
      //     debug: true,

      //     // mode: isSuperAcceptance ? "fast" : "default",
      //   });
      // }
      console.timeEnd(submit_time);
      const durationText = buildDurationText(startTime, Date.now());
      console.log("durationText", durationText);

      await sleep(29_000);

      patientsStore.forceReloadHomePage();

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
      break;
    }
  }
};

export default processClientActionOnPatient;

// if (!hasOptionSelected) {
//   await sendErrorMessage(
//     `We tried times to select ${actionName}, but couldn't find it.\n*selectionError:* ${selectionError}`,
//     "list-item-not-found",
//     buildDurationText(startTime, Date.now())
//   );
//   await closeCurrentPage(true);
//   break;
// }
// console.timeEnd("check_dropdown")

// try {
//   const html = await page.content();
//   await writeFile(`${htmlFilesPath}/details_page.html`, html);
// } catch (error) {
//   console.log("couldn't get details page html", error.message)
// }

// const endpoint = isAcceptance
//   ? "referrals/accept-referral"
//   : "referrals/reject-referral";

// const sectionEl = await scrollDetailsPageSections({
//   page,
//   cursor,
//   logString,
//   // sectionsIndices: [1, 2],
//   sectionsIndices: [2],
// });

// if (!sectionEl) {
//   await sendErrorMessage(
//     "The upload section was not found.",
//     "upload-section-not-found",
//     buildDurationText(startTime, Date.now())
//   );

//   await closeCurrentPage(true);
//   break;
// }

// if (!areWeInDetailsPage) {
//   const hasReachedMaxRetriesForDetailsPage =
//     checkDetailsPageRetry >= MAX_RETRIES;

//   if (hasReachedMaxRetriesForDetailsPage) {
//     await sendErrorMessage(
//       `Tried ${checkDetailsPageRetry} times to enter the details page, but there is something wrong.`,
//       "enter-details-page-failed-reachedMax",
//       buildDurationText(startTime, Date.now())
//     );

//     await closeCurrentPage(false);
//     break;
//   }

//   await goToHomePage(page, cursor);
//   checkDetailsPageRetry += 1;
//   continue;
// }

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
