/*
 *
 * Helper: `collectPatientsSummaryBasedHistory`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import getConfirmedAndAdmittedStatusForReport from "./getConfirmedAndAdmittedStatusForReport.mjs";
import {
  weeklyHistoryDb,
  createPatientRowKey,
  insertWeeklyHistoryPatients,
} from "./db.mjs";

const getSourceProvider = (patient = {}) => {
  return (
    patient.sourceProvider ??
    patient.assignedProvider ??
    patient.provider ??
    null
  );
};

const collectPatientsSummaryBasedHistory = async ({
  summaryStart,
  summaryEnd,
  dbStart,
  dbEnd,
  page,
  calledFrom,
}) => {
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
      createConsoleMessage(error, "error", `history_${calledFrom}`),
    );
    return {
      errors,
    };
  }

  // IMPORTANT: access the database from the statement.
  // better-sqlite3 prepared statements have `.reader`, `.all()`, etc.
  // But to create a new query, you need the database instance.
  const selectedPatients = weeklyHistoryDb
    .prepare(
      `
      SELECT *
      FROM patients
      WHERE referralDate >= ? AND referralDate <= ?
      ORDER BY referralDate ASC
    `,
    )
    .all(dbStart, dbEnd)
    .filter(Boolean);

  createConsoleMessage(
    `Collected ${selectedPatients.length} referred patients from ${dbStart} to ${dbEnd}.`,
    "info",
  );

  const patientstKeys = selectedPatients
    .map((item) => item?.rowKey)
    .filter(Boolean);

  const apisPatientsKeys = apisPatients.map((patient) =>
    createPatientRowKey(patient),
  );

  const { fullPatients, newPatients } = apisPatients.reduce(
    (acc, patient) => {
      const { tabName } = patient;
      const rowKey = createPatientRowKey(patient);

      const {
        providerAction,
        payerAction,
        isAdmitted,
        isRejected,
        isConfirmed,
      } = getConfirmedAndAdmittedStatusForReport(tabName);

      const itemBaseData = {
        isSent: "yes",
        isReceived: "yes",
        providerAction,
        payerAction,
        isAdmitted,
        isRejected,
        isConfirmed,
      };

      if (!patientstKeys.length || !patientstKeys.includes(rowKey)) {
        const newPatient = {
          ...patient,
          assignedProvider: getSourceProvider(patient),
          ...itemBaseData,
          typeX: "!patientstKeys",
        };

        acc.newPatients.push(newPatient);
        acc.fullPatients.push(newPatient);
      } else {
        acc.fullPatients = acc.fullPatients.map((existingPatient) => {
          const {
            rowKey: existingRowKey,
            referralId,
            referenceId,
            patientName,
            nationalId,
            tabName,
            ...otherData
          } = existingPatient;

          const {
            providerAction,
            payerAction,
            isAdmitted,
            isRejected,
            isConfirmed,
          } = getConfirmedAndAdmittedStatusForReport(tabName);

          const patient = {
            rowKey: existingRowKey,
            idReferral: referralId,
            ihalatyReference: referenceId,
            adherentName: patientName,
            adherentNationalId: nationalId,
            assignedProvider: getSourceProvider(existingPatient),
            tabName,
            providerAction: otherData.providerAction || providerAction,
            payerAction: otherData.payerAction || payerAction,
            isAdmitted: otherData.isAdmitted || isAdmitted,
            isConfirmed: otherData.isConfirmed || isConfirmed,
            isRejected: otherData.isRejected || isRejected,
            ...otherData,
          };

          if (!apisPatientsKeys.includes(existingRowKey)) {
            return {
              ...patient,
              payerAction: "dropped",
              isAdmitted: "no",
              isConfirmed: "no",
              isRejected: "no",
              typeX: "!apisPatientsKeys.includes(existingRowKey)",
            };
          }

          return {
            ...patient,
            ...(existingRowKey !== rowKey
              ? null
              : {
                  ...itemBaseData,
                  typeX: "null",
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
      fullPatients: selectedPatients,
      newPatients: [],
    },
  );

  if (newPatients.length) {
    await insertWeeklyHistoryPatients(newPatients);
  }

  return {
    fullPatients,
    newPatients,
  };
};

export default collectPatientsSummaryBasedHistory;
