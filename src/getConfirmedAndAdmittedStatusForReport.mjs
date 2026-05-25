/*
 *
 * Helper: `getConfirmedAndAdmittedStatusForReport`.
 *
 */
import {
  PATIENT_SECTIONS_STATUS,
  TABS_COLLECTION_TYPES,
} from "./constants.mjs";

const { DISCHARGED, ACCEPTED, ADMITTED, CONFIRMED } = TABS_COLLECTION_TYPES;

const checkTabType = (tabName, type) =>
  tabName === PATIENT_SECTIONS_STATUS[type].categoryReference;

const getConfirmedAndAdmittedStatusForReport = (tabName) => {
  const isAccepted = checkTabType(tabName, ACCEPTED);
  const isAdmitted = checkTabType(tabName, ADMITTED);
  const isDischarged = checkTabType(tabName, DISCHARGED);
  const isAdmittedOrDischarged = isAdmitted || isDischarged;
  const isRejected = tabName === "declined";

  const isConfirmed =
    checkTabType(tabName, CONFIRMED) || isAdmittedOrDischarged;

  return {
    isAdmittedOrDischarged,
    isAccepted,
    providerAction: isRejected ? "rejected" : "accepted",
    isRejected: isRejected ? "yes" : "no",
    payerAction: isAccepted ? "in acceptance" : "confirmed",
    isAdmitted: isAdmittedOrDischarged ? "yes" : "no",
    isConfirmed: isConfirmed ? "yes" : "no",
  };
};

export default getConfirmedAndAdmittedStatusForReport;
