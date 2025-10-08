/*
 *
 * Helper: `handleAfterSubmitDone`.
 *
 */
import { unlink } from "fs/promises";
import buildDurationText from "./buildDurationText.mjs";
import checkPathExists from "./checkPathExists.mjs";
import sleep from "./sleep.mjs";

const handleAfterSubmitDone = async ({
  startTime,
  isAutoAccept,
  errorMessage,
  isDoneSuccessfully,
  continueFetchingPatientsIfPaused,
  patientsStore,
  sendErrorMessage,
  closeCurrentPage,
  page,
  actionName,
  sendSuccessMessage,
  acceptanceFilePath,
  rejectionFilePath,
  referralId,
}) => {
  const durationText = buildDurationText(startTime, Date.now());
  console.log("durationText", durationText);

  continueFetchingPatientsIfPaused();
  await sleep(isAutoAccept ? 1000 : 15_000);

  patientsStore.forceReloadHomePage();

  if (!isAutoAccept) {
    await sleep(15_000);
  }

  const isDashboardPage = page
    .url()
    .toLowerCase()
    .includes("dashboard/referral");

  const _isDoneSuccessfully = isAutoAccept
    ? isDoneSuccessfully
    : isDashboardPage;

  if (!_isDoneSuccessfully) {
    await sendErrorMessage(
      isAutoAccept
        ? errorMessage
        : "app didn't redirect to home after submission",
      `no-home-redirect-action-${actionName}`,
      durationText
    );

    await closeCurrentPage(!isDashboardPage);
    return;
  }

  await sendSuccessMessage(durationText);

  await patientsStore.removePatientByReferralId(referralId);

  await Promise.allSettled([
    checkPathExists(acceptanceFilePath).then(
      (exists) => exists && unlink(acceptanceFilePath)
    ),
    checkPathExists(rejectionFilePath).then(
      (exists) => exists && unlink(rejectionFilePath)
    ),
  ]);

  await closeCurrentPage(!isDashboardPage);
};

export default handleAfterSubmitDone;
