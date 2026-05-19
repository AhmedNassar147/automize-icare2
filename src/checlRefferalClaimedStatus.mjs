/**
 *
 * Helper: `checlRefferalClaimedStatus`.
 *
 */
import pLimit from "p-limit";
import os from "os";
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import { HOME_PAGE_URL } from "./constants.mjs";
import { updateCaseInLog } from "./summarizeLogsAfterAcceptance.mjs";

const tabsToCheck = [
  {
    // Confirmed only
    includeConfirmed: true,
    noDischarged: true,
    noAdmitted: true,
    claimStatus: "CF",
  },
  {
    // Admitted only
    noDischarged: true,
    claimStatus: "AD",
  },
  {
    // Discharged only
    noDischarged: false,
    noAdmitted: true,
    claimStatus: "DS",
  },
  {
    // Still accepted
    includeAccepted: true,
    noDischarged: true,
    noAdmitted: true,
    claimStatus: "AC",
  },
];

const fetchCase = async (page, refferalId, referralEndTimestamp) => {
  for (const { claimStatus, ...tabParams } of tabsToCheck) {
    const { patients, errors } = await getSummaryFromTabs({
      page,
      noDates: true,
      extraParams: { genericSearch: refferalId },
      ...tabParams,
    });

    if (patients?.length) {
      const isClaimed = ["AD", "CF", "DS"].includes(claimStatus);
      return {
        referralEndTimestamp,
        refferalId,
        claimStatus: isClaimed ? "Yes" : "No",
        errors,
        shouldUpdateAndNotify: isClaimed,
      };
    }
  }

  // Not found in any tab
  return {
    referralEndTimestamp,
    refferalId,
    claimStatus: "No",
    shouldUpdateAndNotify: true,
    errors: null,
  };
};

const updateAndNotifyUser = async ({
  sendTelegramMessage,
  referralId,
  referralEndTimestamp,
  claimStatus,
}) => {
  const statusEmoji = claimStatus === "Yes" ? "✅" : "❌";
  const statusText =
    claimStatus === "Yes" ? "has been selected" : "has NOT been selected";

  const telegramMessage =
    `${statusEmoji} *Eeferral Status Update*\n` +
    `────────────────────────\n` +
    `🔢 *Referral ID:* \`${referralId}\`\n` +
    `📋 *Status:* ${statusText}`;

  await Promise.all([
    updateCaseInLog(referralId, referralEndTimestamp, {
      claimed: claimStatus,
    }),
    sendTelegramMessage(telegramMessage),
  ]);
};

const checlRefferalClaimedStatus = async (
  browser,
  patientsStore,
  sendTelegramMessage,
) => {
  const {
    newPage: page,
    isLoggedIn,
    isErrorAboutLockedOut,
    shouldCloseApp,
  } = await makeUserLoggedInOrOpenHomePage({
    browser,
    startingPageUrl: HOME_PAGE_URL,
    noBundleCheck: true,
    noCursor: true,
  });

  if (!isLoggedIn || isErrorAboutLockedOut || shouldCloseApp) {
    createConsoleMessage(
      "User is not logged in, when calling checlRefferalClaimedStatus.",
      "error",
    );
    return;
  }

  const cases = patientsStore.getAllNonClaimableCases();

  if (!cases?.length) {
    await closePageSafely(page);
    return;
  }

  const cpuCount = os.cpus().length; // Get the number of CPU cores
  const limit = pLimit(Math.min(4, cpuCount));

  const settledResults = await Promise.allSettled(
    cases.map(({ referralId, referralEndTimestamp }) =>
      limit(
        async () => await fetchCase(page, referralId, referralEndTimestamp),
      ),
    ),
  );

  const results = settledResults
    .filter(({ status }) => status === "fulfilled")
    .map(({ value }) => value)
    .filter((item) => item.shouldUpdateAndNotify);

  if (results.length) {
    for (const item of results) {
      await updateAndNotifyUser({
        sendTelegramMessage,
        ...item,
      });
      patientsStore.removeNonClaimableCase(item.refferalId);
    }
  }

  await closePageSafely(page);
};

export default checlRefferalClaimedStatus;
