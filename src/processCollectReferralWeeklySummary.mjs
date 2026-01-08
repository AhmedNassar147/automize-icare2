/*
 *
 * Helper: `processCollectReferralWeeklySummary`.
 *
 *
 */
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import {
  weeklyHistoryDb,
  toDbRow,
  createPatientRowKey,
  insertWeeklyHistoryPatients,
} from "./db.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import getFormattedDateForSummary from "./getFormattedDateForSummary.mjs";
import sendSummaryExcelToWhatsapp from "./sendSummaryExcelToWhatsapp.mjs";
import {
  HOME_PAGE_URL,
  TABS_COLLECTION_TYPES,
  PATIENT_SECTIONS_STATUS,
} from "./constants.mjs";

const { DISCHARGED, ACCEPTED, ADMITTED } = TABS_COLLECTION_TYPES;

const getLastThursdayToWednesdayRange = (baseDate = new Date()) => {
  // baseDate should be the Thursday run time
  const end = new Date(baseDate);
  end.setDate(end.getDate() - 1); // Wednesday
  end.setHours(23, 59, 59, 999);

  const start = new Date(baseDate);
  start.setDate(start.getDate() - 7); // last Thursday
  start.setHours(0, 0, 0, 0);

  // Match your stored format: "YYYY-MM-DDTHH:mm:ss" (no milliseconds, no Z)
  const toDbIso = (d) => d.toISOString().slice(0, 19);

  return {
    start: toDbIso(start),
    end: toDbIso(end),
    summaryStart: getFormattedDateForSummary(start),
    summaryEnd: getFormattedDateForSummary(new Date()),
  };
};

const processCollectReferralWeeklySummary = async (
  browser,
  sendWhatsappMessage
) => {
  const { newPage: page, isLoggedIn } = await makeUserLoggedInOrOpenHomePage({
    browser,
    startingPageUrl: HOME_PAGE_URL,
  });

  if (!isLoggedIn) {
    createConsoleMessage(
      "User is not logged in, cannot collect referral weekly summary.",
      "error"
    );
    return;
  }

  const { start, end, summaryEnd, summaryStart } =
    getLastThursdayToWednesdayRange(new Date());

  const { patients: apisPatients, errors } = await getSummaryFromTabs({
    page,
    reportStartsAt: summaryStart,
    reportEndsAt: summaryEnd,
    includeConfirmed: true,
    includeDeclined: true,
    includeAccepted: true,
  });

  if (errors.length) {
    errors.forEach((error) =>
      createConsoleMessage(
        error,
        "error",
        "processCollectReferralWeeklySummary"
      )
    );
    await closePageSafely(page);
    return;
  }

  // IMPORTANT: access the database from the statement.
  // better-sqlite3 prepared statements have `.reader`, `.all()`, etc.
  // But to create a new query, you need the database instance.
  // If you don't have it here, export `weeklyHistoryDb` (or `db`) from db.mjs.
  const weeklyPatients = weeklyHistoryDb
    .prepare(
      `
      SELECT *
      FROM patients
      WHERE referralDate >= ? AND referralDate <= ?
      ORDER BY referralDate ASC
    `
    )
    .all(start, end)
    .filter(Boolean);

  createConsoleMessage(
    `Collected ${weeklyPatients.length} referred patients from ${start} to ${end}.`,
    "info"
  );

  const weeklyPatientstKeys = weeklyPatients.map(({ rowKey }) => rowKey);
  const apisPatientsKeys = apisPatients.map((patient) =>
    createPatientRowKey(patient)
  );

  const checkTabType = (tabName, type) =>
    tabName === PATIENT_SECTIONS_STATUS[type].categoryReference;

  const { fullPatients, newPatients } = apisPatients.reduce(
    (acc, patient) => {
      const { tabName } = patient;
      const rowKey = createPatientRowKey(patient);

      const isAccepted = checkTabType(tabName, ACCEPTED);
      const isAdmitted = checkTabType(tabName, ADMITTED);
      const isDischarged = checkTabType(tabName, DISCHARGED);
      const isDeclined = tabName === "declined";

      // const isConfirmed =
      //   checkTabType(tabName, CONFIRMED) || isAdmitted || isDischarged;

      const isAdmittedString = isAdmitted || isDischarged ? "yes" : "no";

      const itemBaseData = {
        isSent: "yes",
        isReceived: "yes",
        providerAction: isDeclined ? "rejected" : "accepted",
        payerAction: isAccepted ? "in acceptance" : "confirmed",
        isAdmitted: isAdmittedString,
      };

      if (!weeklyPatientstKeys.includes(rowKey)) {
        const newPatient = {
          ...patient,
          ...itemBaseData,
        };

        acc.newPatients.push(newPatient);
        acc.fullPatients.push(toDbRow({}, newPatient));
      } else {
        acc.fullPatients = acc.fullPatients.map((existingPatient) => {
          const { rowKey: existingRowKey } = existingPatient;
          if (!apisPatientsKeys.includes(existingRowKey)) {
            return {
              ...existingPatient,
              payerAction: "dropped",
              isAdmitted: "no",
            };
          }

          return {
            ...existingPatient,
            ...(existingRowKey !== rowKey
              ? null
              : {
                  ...itemBaseData,
                  providerAction:
                    existingPatient.providerAction ||
                    itemBaseData.providerAction,
                }),
          };
        });
      }

      return acc;
    },
    {
      fullPatients: weeklyPatients,
      newPatients: [],
    }
  );

  const isSent = await sendSummaryExcelToWhatsapp(
    sendWhatsappMessage,
    fullPatients,
    true
  );

  if (isSent) {
    insertWeeklyHistoryPatients(newPatients);
    createConsoleMessage(
      `weekly report: all newPatients=${newPatients.length} where fullPatients=${fullPatients.length}`
    );
  }

  await closePageSafely(page);
};

export default processCollectReferralWeeklySummary;
