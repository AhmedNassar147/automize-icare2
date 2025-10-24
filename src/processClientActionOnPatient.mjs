/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import { writeFile /*  readFile */ } from "fs/promises";
import { join, resolve /* basename*/ } from "path";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import goToHomePage from "./goToHomePage.mjs";
// import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import sleep from "./sleep.mjs";
import closePageSafely from "./closePageSafely.mjs";
import buildDurationText from "./buildDurationText.mjs";
import getSubmissionButtonsIfFound from "./getSubmissionButtonsIfFound.mjs";
import handleAfterSubmitDone from "./handleAfterSubmitDone.mjs";
import createDetailsPageWhatsappHandlers from "./createDetailsPageWhatsappHandlers.mjs";
import rewriteReferralDetails from "./rewriteReferralDetails.mjs";
// import generateRandomMs from "./generateRandomMs.mjs";
import speakText from "./speakText.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  htmlFilesPath,
  dashboardLinkSelector,
} from "./constants.mjs";

function scheduleThresholdNudge(
  referralEndTimestamp,
  {
    thresholdMs = 400,
    jitterMs = 80, // ±80ms jitter to avoid exact timing patterns
    onNudge = () => {},
    signal,
  } = {}
) {
  const now = Date.now();
  const remaining = referralEndTimestamp - now;

  const run = () => {
    if (signal?.aborted) return;
    onNudge(Math.max(0, referralEndTimestamp - Date.now()));
  };

  if (remaining <= thresholdMs) {
    run();
    return () => {};
  }

  const delay = Math.max(0, remaining - thresholdMs);
  const jitter = (Math.random() * 2 - 1) * jitterMs;
  const whenMS = Math.max(0, delay + jitter);
  console.log({
    delay,
    jitter,
    whenMS,
  });
  const timer = setTimeout(run, whenMS);

  const abortHandler = () => {
    clearTimeout(timer);
  };

  if (signal) signal.addEventListener("abort", abortHandler, { once: true });

  return () => {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", abortHandler);
  };
}

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

  const { referralId, patientName, referralEndTimestamp, cutoffTimeMs } =
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
    5000
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

  const remainingTime = referralEndTimestamp - Date.now() - 125;

  if (remainingTime < 0) {
    await sleep(remainingTime);
  }

  speakText({
    text: "Go Go Go Go",
    useMaleVoice: true,
    delayMs: 0,
    rate: 3,
    volume: 100,
    times: 1,
  });

  await closeCurrentPage(false);
  return;

  await rewriteReferralDetails(page);

  const startTime = Date.now();

  const abort = new AbortController();
  const cancelNudge = scheduleThresholdNudge(referralEndTimestamp, {
    thresholdMs: 350,
    jitterMs: 80,
    signal: abort.signal,
    onNudge: (timeLeftMs) => {
      speakText({
        text: "Go Go Go Go",
        useMaleVoice: true,
        delayMs: 0,
        rate: 3,
        volume: 100,
        times: 1,
      });

      console.log(
        "nudge @",
        new Date(),
        "for",
        new Date(referralEndTimestamp - 200),
        "left",
        timeLeftMs
      );
    },
  });

  try {
    await iconButton.click();

    let referralButtons;

    while (!referralButtons) {
      referralButtons = await getSubmissionButtonsIfFound(page);

      if (referralButtons) {
        break;
      }

      await page.click(dashboardLinkSelector);
      const newReferralIdRecordResult = await collectHomePageTableRows(
        page,
        referralId,
        3000
      );

      if (newReferralIdRecordResult.iconButton) {
        await newReferralIdRecordResult.iconButton.click();
        continue;
      } else {
        const newReferralIdRecordResultX = await collectHomePageTableRows(
          page,
          referralId,
          4000
        );

        await newReferralIdRecordResultX.iconButton.click();
        continue;
      }
    }

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
    cancelNudge?.();
    continueFetchingPatientsIfPaused();
  }
};

export default processClientActionOnPatient;

// console.log("took time before remaining", Date.now() - preparingStartTime);

// const allowedToSubmit = generateRandomMs(3800, 4400);

// const remaining = referralEndTimestamp - Date.now() - allowedToSubmit;

// console.log({
//   remaining,
//   allowedToSubmit,
//   cutoffTimeMs,
// });

// if (remaining > 0) {
//   await sleep(remaining);
// }

//  251.195ms
// await selectAttachmentDropdownOption(page, actionName);
// const fileInput = await page.$('#upload-single-file input[type="file"]');
// await fileInput.uploadFile(filePath);

// const selectedButton = referralButtons[isAcceptance ? 0 : 1];

// await selectedButton.evaluate((el) => {
//   el.scrollIntoView({
//     behavior: "auto",
//     block: "center",
//   });
// });
// console.timeEnd("super_acceptance_time");

// const leftTime = referralEndTimestamp - Date.now();
// console.log("took time to Left", leftTime);

// const remaining = referralEndTimestamp - Date.now();

// https://referralprogram.globemedsaudi.com/referrals/listing
// {"pageSize":100,"pageNumber":1,"categoryReference":"pending","providerZone":[],"providerName":[],"specialtyCode":[],"referralTypeCode":[],"referralReasonCode":[],"genericSearch":"","sortOrder":"asc"}

// {
//     "data": {
//         "pageNumber": 1,
//         "pageSize": 100,
//         "totalNumberOfPages": 0,
//         "totalNumberOfRecords": 0,
//         "hasNext": false,
//         "tableHeaders": [
//             {
//                 "id": "referralDate",
//                 "label": "Referral Date",
//                 "sortingId": "Referraldate"
//             },
//             {
//                 "id": "idReferral",
//                 "label": "GMS Referral Id",
//                 "sortingId": "Id"
//             },
//             {
//                 "id": "ihalatyReference",
//                 "label": "MOH Referral Nb",
//                 "sortingId": "Idihalaty"
//             },
//             {
//                 "id": "adherentName",
//                 "label": "Patient Name",
//                 "sortingId": "IdpatientNavigation.Firstname"
//             },
//             {
//                 "id": "adherentNationalId",
//                 "label": "National ID",
//                 "sortingId": "IdpatientNavigation.Nationalid"
//             },
//             {
//                 "id": "referralType",
//                 "label": "Referral Type",
//                 "sortingId": "IdreferraltypeNavigation.Description"
//             },
//             {
//                 "id": "referralReason",
//                 "label": "Referral Reason",
//                 "sortingId": "IdreferralreasonNavigation.Description"
//             },
//             {
//                 "id": "sourceZone",
//                 "label": "Source Zone",
//                 "sortingId": "SourceproviderNavigation.Providerzone"
//             }
//         ],
//         "result": []
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
