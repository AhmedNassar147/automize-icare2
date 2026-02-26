/*
 *
 * Helper: `processCollectRefferalMonthlySummary`.
 *
 */
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import getFormattedDateForSummary from "./getFormattedDateForSummary.mjs";
import sendSummaryExcelToWhatsapp from "./sendSummaryExcelToWhatsapp.mjs";
import {
  HOME_PAGE_URL,
  TABS_COLLECTION_TYPES,
  PATIENT_SECTIONS_STATUS,
  SUMMARY_TYPES,
} from "./constants.mjs";

const { DISCHARGED, ADMITTED, CONFIRMED } = TABS_COLLECTION_TYPES;

const checkTabType = (tabName, type) =>
  tabName === PATIENT_SECTIONS_STATUS[type].categoryReference;

const getCurrentMonthRange = () => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: getFormattedDateForSummary(first),
    endDate: getFormattedDateForSummary(last),
  };
};

const processCollectRefferalMonthlySummary = async (
  browser,
  sendWhatsappMessage,
) => {
  const { newPage: page, isLoggedIn } = await makeUserLoggedInOrOpenHomePage({
    browser,
    startingPageUrl: HOME_PAGE_URL,
  });

  if (!isLoggedIn) {
    createConsoleMessage(
      "User is not logged in, cannot collect referral monthly summary.",
      "error",
    );
    return;
  }

  const { startDate, endDate } = getCurrentMonthRange(new Date());

  console.log({
    startDate,
    endDate,
  });

  const { patients: apisPatients, errors } = await getSummaryFromTabs({
    page,
    reportStartsAt: startDate,
    reportEndsAt: endDate,
    includeConfirmed: true,
  });

  if (errors.length) {
    errors.forEach((error) =>
      createConsoleMessage(
        error,
        "error",
        "processCollectRefferalMonthlySummary",
      ),
    );
    await closePageSafely(page);
    return;
  }

  // {
  //   "order": 1,
  //   "idReferral": 369972,
  //   "ihalatyReference": "32464483",
  //   "adherentName": " AFAF ALMUTAIRI",
  //   "adherentNationalId": "1007402827",
  //   "sourceProvider": "",
  //   "adherentId": "42752874",
  //   "referralDate": "2026-02-04T23:58:52",
  //   "referralType": "Emergency",
  //   "referralReason": "Bed Unavailable",
  //   "sourceZone": "Qassim",
  //   "assignedProvider": "Al Hayat National Hospital - Unizah",
  //   "disease": "",
  //   "status": null,
  //   "tabName": "confirmed",
  //   "paid": 0,
  //   "isSent": "yes",
  //   "isReceived": "yes",
  //   "providerAction": "accepted",
  //   "payerAction": "dropped",
  //   "isAdmitted": "no",
  //   "typeX": "!apisPatientsKeys.includes(existingRowKey)"
  // },

  const fullPatients = apisPatients.reduce((acc, patient) => {
    const { tabName } = patient;
    const isAdmitted = checkTabType(tabName, ADMITTED);
    const isDischarged = checkTabType(tabName, DISCHARGED);
    const isAdmittedOrDischarged = isAdmitted || isDischarged;
    const isConfirmed =
      checkTabType(tabName, CONFIRMED) || isAdmittedOrDischarged;

    acc.push({
      ...patient,
      isConfirmed: isConfirmed ? "yes" : "no",
      isAdmitted: isAdmittedOrDischarged ? "yes" : "no",
    });

    return acc;
  }, []);

  const isSent = await sendSummaryExcelToWhatsapp(
    sendWhatsappMessage,
    fullPatients,
    SUMMARY_TYPES.MONTHLY,
  );

  if (isSent) {
    createConsoleMessage(
      `monthly report: all apisPatients=${apisPatients.length}, fullPatients=${fullPatients.length}`,
    );
  }

  await closePageSafely(page);
};

export default processCollectRefferalMonthlySummary;
