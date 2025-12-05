/*
 *
 * Helper: `handleAfterSubmitDone`.
 *
 */
import buildDurationText from "./buildDurationText.mjs";
import sleep from "./sleep.mjs";
import waitForPath from "./waitForPath.mjs";

const handleAfterSubmitDone = async ({
  startTime,
  isAutoAccept,
  errorMessage,
  leftTime,
  // isDoneSuccessfully,
  continueFetchingPatientsIfPaused,
  patientsStore,
  sendErrorMessage,
  closeCurrentPage,
  page,
  actionName,
  sendSuccessMessage,
  referralId,
}) => {
  continueFetchingPatientsIfPaused();

  const _isDoneSuccessfully = await waitForPath(page);

  const durationText = buildDurationText(
    startTime,
    Date.now() - (leftTime || 0)
  );
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

  await closeCurrentPage(true);
};

export default handleAfterSubmitDone;
