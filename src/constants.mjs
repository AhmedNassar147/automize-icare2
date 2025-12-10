/*
 *
 * Constants for the application.
 *
 */
export const cwd = process.cwd();

export const siteCodeConfigFile = `${cwd}/sitecode_config.json`;
export const screenshotsFolderDirectory = `${cwd}/screenshots`;
export const waitingPatientsFolderDirectory = `${cwd}/results/waiting-patients`;
export const generatedPdfsPathForAcceptance = `${cwd}/results/generated-acceptance-pdf`;
export const generatedPdfsPathForRejection = `${cwd}/results/generated-rejection-pdf`;
export const generatedSummaryFolderPath = `${cwd}/results/summary`;
export const htmlFilesPath = `${cwd}/results/html`;
export const COLLECTD_PATIENTS_FILE_NAME = "collectedPatients";
export const COLLECTD_PATIENTS_FULL_FILE_PATH = `${waitingPatientsFolderDirectory}/${COLLECTD_PATIENTS_FILE_NAME}.json`;
export const SUPPER_ACCEPTACNE_RESULTS_FILE_PATH = `${cwd}/results/supper_acceptance_results.json`;

export const TABS_COLLECTION_TYPES = {
  WAITING: "WAITING",
  ACCEPTED: "ACCEPTED",
  CONFIRMED: "CONFIRMED",
  ADMITTED: "ADMITTED",
  DISCHARGED: "DISCHARGED",
};

export const PATIENT_SECTIONS_STATUS = {
  [TABS_COLLECTION_TYPES.WAITING]: {
    targetText: "Pending Referrals",
    foundCountText: "waiting confirmation referrals",
    noCountText: "No waiting referrals found",
    categoryReference: "pending",
  },
  [TABS_COLLECTION_TYPES.ACCEPTED]: {
    targetText: "Accepted Referrals",
    foundCountText: "Accepted referrals requests",
    noCountText: "No Accepted referrals requests found",
    categoryReference: "accepted",
  },
  [TABS_COLLECTION_TYPES.CONFIRMED]: {
    targetText: "Confirmed Referrals",
    foundCountText: "confirmed referrals requests",
    noCountText: "No confirmed referrals requests found",
    categoryReference: "confirmed",
  },
  [TABS_COLLECTION_TYPES.ADMITTED]: {
    targetText: "Admitted Requests",
    foundCountText: "Admitted referrals requests",
    noCountText: "No Admitted referrals found",
    categoryReference: "admitted",
  },
  [TABS_COLLECTION_TYPES.DISCHARGED]: {
    targetText: "Discharged Requests",
    foundCountText: "Discharged Requests requests",
    noCountText: "No Discharged Requests found",
    categoryReference: "discharged",
  },
};

// the user will review patient till the 13 minute of the counter
// export const STOP_USER_ACTION_MINUTES = ALLOWED_MINUTES_TO_REVIEW_PATIENTS - 13;

export const ALLOWED_MINUTES_TO_REVIEW_PATIENTS = 15;

export const cutoffTimeMs = 10500;
export const searchIfAcceptacneButtonShownMS = 10500;

export const EFFECTIVE_REVIEW_DURATION_MS =
  ALLOWED_MINUTES_TO_REVIEW_PATIENTS * 60 * 1000;

export const USER_MESSAGES = {
  alreadyScheduledAccept: "Already scheduled for acceptance.",
  alreadyScheduledReject: "Already scheduled for rejection.",
  scheduleAcceptSuccess: "scheduled for acceptance.",
  scheduleRejectSuccess: "scheduled for rejection.",
  notFound: "Patient does not exist.",
  expired: "Time expired.",
  canProcess: "Patient can still be processed.",
  cancelSuccess: "scheduled for cancellation.",
  noAction: "No-need, No scheduled action for this patient.",
};

export const USER_ACTION_TYPES = {
  SUPPER_ACCEPT: "super_accept",
  ACCEPT: "accept",
  REJECT: "reject",
  COLLECT: "collect",
};

export const CONFIRMATION_TYPES = {
  SUPPER_ACCEPT: ["super_accept", "11"],
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

export const dashboardLinkSelector = 'a[href="/dashboard/referral"] button';

export const APP_URL = "https://referralprogram.globemedsaudi.com";
export const HOME_PAGE_URL = `${APP_URL}/Dashboard/Referral`;

export const baseGlobMedAPiUrl = `${APP_URL}/referrals`;

export const acceptanceApiUrl = `${baseGlobMedAPiUrl}/accept-referral`;
export const rejectionApiUrl = `${baseGlobMedAPiUrl}/reject-referral`;

export const globMedHeaders = {
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "X-CSRF": "1",
};

export const BLOCK_PATHS = new Set([
  // https://referralprogram.globemedsaudi.com/referrals/icds
  "/referrals/icds",
  // https://referralprogram.globemedsaudi.com/providers/zones?languageCode=1
  "/providers/zones",
  // https://referralprogram.globemedsaudi.com/cases/specialty?codeLanguage=2
  "/cases/specialty",
  // https://referralprogram.globemedsaudi.com/referrals/cpts
  "/referrals/cpts",
  // https://referralprogram.globemedsaudi.com/referrals/attachments
  // "/referrals/attachments",
  // https://referralprogram.globemedsaudi.com/referrals/patient-info
  "/referrals/patient-info",
]);

// https://referralprogram.globemedsaudi.com/referrals/358375/notes
export const NOTES_PATH_RE = /^\/referrals\/[^/]+\/notes$/; // /referrals/358358/notes
