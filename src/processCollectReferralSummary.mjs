/*
 *
 * Helper: `processCollectReferralSummary`.
 *
 */
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import {
  allPatientsStatement,
  createPatientRowKey,
  insertPatients,
} from "./db.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import sendSummaryExcelToWhatsapp from "./sendSummaryExcelToWhatsapp.mjs";
import { HOME_PAGE_URL, SUMMARY_TYPES } from "./constants.mjs";

const processCollectReferralSummary = async (
  browser,
  sendWhatsappMessage,
  firstSummaryReportStartsAt,
  firstSummaryReportEndsAt,
) => {
  const { newPage: page, isLoggedIn } = await makeUserLoggedInOrOpenHomePage({
    browser,
    startingPageUrl: HOME_PAGE_URL,
  });

  if (!isLoggedIn) {
    createConsoleMessage(
      "User is not logged in, cannot collect referral summary.",
      "error",
    );
    return;
  }

  const { patients: apisPatients, errors } = await getSummaryFromTabs({
    page,
    reportStartsAt: firstSummaryReportStartsAt,
    reportEndsAt: firstSummaryReportEndsAt,
  });

  if (errors.length) {
    errors.forEach((error) =>
      createConsoleMessage(error, "error", "processCollectReferralSummary"),
    );
    await closePageSafely(page);
    return;
  }

  const allPatients = allPatientsStatement.all();

  const allPatientKeySet = new Set(allPatients.map((p) => p.rowKey));

  const allNewPatients = apisPatients.filter((patient) => {
    const rowKey = createPatientRowKey(patient);
    return rowKey && !allPatientKeySet.has(rowKey);
  });

  // console.log({
  //   firstSummaryReportStartsAt,
  //   endDate,
  //   apisPatients: apisPatients.length,
  //   allNewPatients: allNewPatients.length,
  //   allPatientKeys: allPatientKeys.length,
  // });

  const isSent = await sendSummaryExcelToWhatsapp(
    sendWhatsappMessage,
    allNewPatients,
    SUMMARY_TYPES.NORMAL,
  );

  if (isSent) {
    insertPatients(allNewPatients);
    createConsoleMessage(`all new patients length is ${allNewPatients.length}`);
  }

  await closePageSafely(page);
};

export default processCollectReferralSummary;

// Request URL
// https://referralprogram.globemedsaudi.com/referrals/listing
// Request Method
// POST
// Status Code
// {
//     "data": {
//         "pageNumber": 1,
//         "pageSize": 100,
//         "totalNumberOfPages": 1,
//         "totalNumberOfRecords": 1,
//         "hasNext": false,
//         "result": [
//             {
//                 "idReferral": 350844,
//                 "ihalatyReference": "31950880",
//                 "adherentId": "40562736",
//                 "adherentName": " THANIYAH  ALQAHTANI",
//                 "adherentNationalId": "1060650619",
//                 "referralDate": "2025-06-23T22:28:06",
//                 "referralType": "Emergency",
//                 "referralReason": "Bed Unavailable",
//                 "sourceZone": "Asir",
//                 "sourceProvider": "",
//                 "assignedProvider": "",
//                 "disease": "",
//                 "status": null
//             }
//         ]
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
