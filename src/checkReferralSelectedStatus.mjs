/**
 *
 * Helper: `checkReferralSelectedStatus`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import { updateCaseInLog } from "./summarizeLogsAfterAcceptance.mjs";
import sleep from "./sleep.mjs";
import getFormattedDateForSummary from "./getFormattedDateForSummary.mjs";

const tabsToCheck = [
  {
    // Still accepted
    includeAccepted: true,
    noDischarged: true,
    noAdmitted: true,
    status: "AC",
  },
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
];

const fetchCase = async (
  page,
  referralId,
  todayPlusOneDate,
  twoDaysAgoDate,
) => {
  for (const { status, ...tabParams } of tabsToCheck) {
    const { patients, errors } = await getSummaryFromTabs({
      page,
      noDates: true,
      extraParams: {
        pageSize: 50,
        startDate: twoDaysAgoDate,
        endDate: todayPlusOneDate,
      },
      ...tabParams,
    });

    if (
      patients?.length &&
      patients.some((patient) => `${patient.idReferral}` === String(referralId))
    ) {
      const isClaimed = ["CF", "AD", "DS"].includes(status);
      return {
        referralId,
        status: isClaimed ? "Yes" : "No",
        hints: errors,
        statusID: status,
        shouldUpdateAndNotify: isClaimed,
      };
    }
  }

  // Not found in any tab
  return {
    referralId,
    status: "No",
    shouldUpdateAndNotify: true,
    hints: ["Referral not found in any status tab."],
  };
};

const updateAndNotifyUser = async ({
  sendTelegramMessage,
  referralId,
  status,
  hints,
  statusID,
}) => {
  const statusEmoji = status === "Yes" ? "✅" : "❌";
  const statusText =
    status === "Yes"
      ? `We have been selected (${statusID})`
      : "We have NOT been selected";

  const telegramMessage =
    `${statusEmoji} *Referral Status Update*\n` +
    `────────────────────────\n` +
    `🔢 *Referral ID:* \`${referralId}\`\n` +
    `📋 *Status:* ${statusText}` +
    `${!!hints?.length ? `\n⚠️ *Hints:* ${hints.join("\n\n")}` : ""}`;

  await Promise.all([
    updateCaseInLog(referralId, { claimed: status }).catch((err) =>
      createConsoleMessage(err, "error"),
    ),
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

    const now = new Date();

    const currentDay = now.getDate();

    const todayPlusOne = new Date(
      now.getFullYear(),
      now.getMonth(),
      currentDay + 1,
    );

    const twoDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 2,
      0,
      0,
      0,
      0,
    );

    const todayPlusOneDate = getFormattedDateForSummary(todayPlusOne);
    const twoDaysAgoDate = getFormattedDateForSummary(twoDaysAgo);

    const settledResults = [];
    for (const { referralId } of cases) {
      await sleep(1500 + Math.random() * 1500);

      const result = await fetchCase(
        page,
        referralId,
        todayPlusOneDate,
        twoDaysAgoDate,
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
