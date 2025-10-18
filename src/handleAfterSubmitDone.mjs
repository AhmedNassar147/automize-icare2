/*
 *
 * Helper: `handleAfterSubmitDone`.
 *
 */
import { unlink } from "fs/promises";
import buildDurationText from "./buildDurationText.mjs";
import checkPathExists from "./checkPathExists.mjs";
import sleep from "./sleep.mjs";

const waitForPath = async (
  page,
  targetPath = "/dashboard/referral",
  timeout = 4 * 60 * 1000
) => {
  const normalize = (s) => s.replace(/\/+$/, "").toLowerCase();
  const wanted = normalize(targetPath);

  const hardP = page
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout })
    .then(() => true)
    .catch(() => false);

  const spaP = page
    .waitForFunction(
      (wantedPath) => {
        const path = new URL(location.href).pathname
          .replace(/\/+$/, "")
          .toLowerCase();
        return path.endsWith(wantedPath);
      },
      { timeout },
      wanted
    )
    .then(() => true)
    .catch(() => false);

  const first = await Promise.race([hardP, spaP]);
  if (!first) return false;

  return page.evaluate((wantedPath) => {
    const p = new URL(location.href).pathname.replace(/\/+$/, "").toLowerCase();
    return p.endsWith(wantedPath);
  }, wanted);
};

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
  acceptanceFilePath,
  rejectionFilePath,
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
