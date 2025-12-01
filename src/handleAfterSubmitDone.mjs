/*
 *
 * Helper: `handleAfterSubmitDone`.
 *
 */
import { unlink } from "fs/promises";
import buildDurationText from "./buildDurationText.mjs";
import checkPathExists from "./checkPathExists.mjs";
import sleep from "./sleep.mjs";
import waitForPath from "./waitForPath.mjs";

const handleAfterSubmitDone = async ({
  startTime,
  isAutoAccept,
  errorMessage,
  // isDoneSuccessfully,
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
  continueFetchingPatientsIfPaused();

  const _isDoneSuccessfully = await waitForPath(page);

  const durationText = buildDurationText(startTime, Date.now());
  console.log("durationText", durationText);
  patientsStore.forceReloadHomePage();

  await sleep(5000 + Math.random() * 2000);

  if (!_isDoneSuccessfully) {
    await sendErrorMessage(
      isAutoAccept
        ? errorMessage
        : "app didn't redirect to home after submission",
      `no-home-redirect-action-${actionName}`,
      durationText
    );

    await closeCurrentPage(true);
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

  await closeCurrentPage(true);
};

export default handleAfterSubmitDone;
