/**
 *
 * Helper: `checkReferralSelectedStatus`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import { updateCaseInLog } from "./summarizeLogsAfterAcceptance.mjs";

const tabsToCheck = [
  {
    // Confirmed only
    includeConfirmed: true,
    noDischarged: true,
    noAdmitted: true,
    status: "CF",
  },
  {
    // Admitted only
    noDischarged: true,
    status: "AD",
  },
  // {
  //   // Discharged only
  //   noDischarged: false,
  //   noAdmitted: true,
  //   status: "DS",
  // },
  {
    // Still accepted
    includeAccepted: true,
    noDischarged: true,
    noAdmitted: true,
    status: "AC",
  },
];

const fetchCase = async (page, referralId, referralEndTimestamp) => {
  for (const { status, ...tabParams } of tabsToCheck) {
    const { patients, errors } = await getSummaryFromTabs({
      page,
      noDates: true,
      extraParams: { genericSearch: referralId },
      ...tabParams,
    });

    if (patients?.length) {
      const isClaimed = ["AD", "CF", "DS"].includes(status);
      return {
        referralEndTimestamp,
        referralId,
        status: isClaimed ? "Yes" : "No",
        errors,
        shouldUpdateAndNotify: isClaimed,
      };
    }
  }

  // Not found in any tab
  return {
    referralEndTimestamp,
    referralId,
    status: "No",
    shouldUpdateAndNotify: true,
    errors: null,
  };
};

const updateAndNotifyUser = async ({
  sendTelegramMessage,
  referralId,
  referralEndTimestamp,
  status,
}) => {
  const statusEmoji = status === "Yes" ? "✅" : "❌";
  const statusText =
    status === "Yes" ? "has been selected" : "has NOT been selected";

  const telegramMessage =
    `${statusEmoji} *Referral Status Update*\n` +
    `────────────────────────\n` +
    `🔢 *Referral ID:* \`${referralId}\`\n` +
    `📋 *Status:* ${statusText}`;

  await Promise.all([
    updateCaseInLog(referralId, referralEndTimestamp, {
      claimed: status,
    }),
    sendTelegramMessage(telegramMessage),
  ]);
};

const checkReferralSelectedStatus = async (
  page,
  patientsStore,
  sendTelegramMessage,
) => {
  try {
    const cases = patientsStore.getAllNonClaimableCases();

    if (!cases?.length) return false;

    const settledResults = [];
    for (const { referralId, referralEndTimestamp } of cases) {
      const result = await fetchCase(
        page,
        referralId,
        referralEndTimestamp,
      ).catch((err) => {
        createConsoleMessage(
          "Error when fetching case status",
          "error",
          `❌ fetchCase failed for ${referralId}:`,
        );
        return null;
      });
      if (result) settledResults.push(result);
    }

    const results = settledResults.filter((item) => item.shouldUpdateAndNotify);

    for (const item of results) {
      await updateAndNotifyUser({ sendTelegramMessage, ...item });
      patientsStore.removeNonClaimableCase(item.referralId);
    }

    return results.length > 0;
  } catch (error) {
    return false;
  }
};

export default checkReferralSelectedStatus;
