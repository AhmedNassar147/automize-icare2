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
import buildDurationText from "./buildDurationText.mjs";
import getSubmissionButtonsIfFound from "./getSubmissionButtonsIfFound.mjs";
import handleAfterSubmitDone from "./handleAfterSubmitDone.mjs";
import createDetailsPageWhatsappHandlers from "./createDetailsPageWhatsappHandlers.mjs";
import rewriteReferralDetails from "./rewriteReferralDetails.mjs";
// import speakText from "./speakText.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  htmlFilesPath,
  dashboardLinkSelector,
} from "./constants.mjs";

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

  await rewriteReferralDetails(page);

  const remaining = referralEndTimestamp - Date.now() - 2500;

  if (remaining > 0) {
    await sleep(remaining);
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

    //  251.195ms
    await selectAttachmentDropdownOption(page, actionName);
    const fileInput = await page.$('#upload-single-file input[type="file"]');
    await fileInput.uploadFile(filePath);

    const selectedButton = referralButtons[isAcceptance ? 0 : 1];

    await selectedButton.evaluate((el) => {
      el.scrollIntoView({
        behavior: "auto",
        block: "center",
      });
    });
    // 🕒 *Took*: `0.64 seconds`
    // console.log(
    //   "took time to scroll from startTime",
    //   buildDurationText(startTime, Date.now())
    // );

    // console.log("took time to Left", referralEndTimestamp - Date.now()); // 47

    // console.log(
    //   "took time to full scroll preparingStartTime",
    //   buildDurationText(preparingStartTime, Date.now())
    // ); 🕒 *Took*: `8.94 seconds`

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
