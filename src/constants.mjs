/*
 *
 * Constants for the application.
 *
 */
export const cwd = process.cwd();

export const screenshotsFolderDirectory = `${cwd}/screenshots`;
export const waitingPatientsFolderDirectory = `${cwd}/results/waiting-patients`;
export const generatedPdfsPathForAcceptance = `${cwd}/results/generated-acceptance-pdf`;
export const generatedPdfsPathForRejection = `${cwd}/results/generated-rejection-pdf`;
export const htmlFilesPath = `${cwd}/results/html`;
export const COLLECTD_PATIENTS_FILE_NAME = "collectedPatients";
export const COLLECTD_PATIENTS_FULL_FILE_PATH = `${waitingPatientsFolderDirectory}/${COLLECTD_PATIENTS_FILE_NAME}.json`;

export const PATIENT_SECTIONS_STATUS = {
  WAITING: {
    targetText: "Pending Referrals",
    foundCountText: "waiting confirmation referrals",
    noCountText: "No waiting referrals found",
  },
  CONFIRMED: {
    targetText: "Confirmed Referrals",
    foundCountText: "confirmed referrals requests",
    noCountText: "No confirmed referrals requests found",
  },
};

export const USER_ACTION_TYPES = {
  ACCEPT: "accept",
  REJECT: "reject",
  COLLECT: "collect",
};

// the user will review patient till the 13 minute of the counter
// export const STOP_USER_ACTION_MINUTES = ALLOWED_MINUTES_TO_REVIEW_PATIENTS - 13;

// 8 seconds for loading new pupteer page , js code execution, upload file and submit
export const estimatedTimeForProcessingAction = 8_000;

export const ALLOWED_MINUTES_TO_REVIEW_PATIENTS = 15;

export const EFFECTIVE_REVIEW_DURATION_MS =
  ALLOWED_MINUTES_TO_REVIEW_PATIENTS * 60 * 1000;

export const USER_MESSAGES = {
  alreadyScheduledAccept: "Patient is already scheduled for acceptance.",
  alreadyScheduledReject: "Patient is already scheduled for rejection.",
  scheduleAcceptSuccess: "Patient successfully scheduled for acceptance.",
  scheduleRejectSuccess: "Patient successfully scheduled for rejection.",
  notFound: "Patient does not exist.",
  expired: "Time expired, cannot process patient.",
  canProcess: "Patient can still be processed.",
  cancelSuccess: "Scheduled action canceled successfully.",
  noAction: "No-need, No scheduled action to cancel for this patient.",
};

export const CONFIRMATION_TYPES = {
  ACCEPT: ["accept", "1"],
  REJECT: ["reject", "00"],
  CANCEL: ["cancel", "0"],
};

export const homePageTableSelector = "table.MuiTable-root";

export const SECTIONS_IN_DETAILS_PAGE = [
  "Patient Information",
  "Case Details",
  "ICD",
  "Procedure",
];

export const dashboardLinkSelector = 'a[href="/dashboard/referral"]';

export const APP_URL = "https://referralprogram.globemedsaudi.com";
export const HOME_PAGE_URL =
  "https://referralprogram.globemedsaudi.com/Dashboard/Referral";
