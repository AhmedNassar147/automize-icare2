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
  targetPath = "dashboard/referral",
  timeout = 3 * 60 * 1000
) => {
  const prevHref = await page.evaluate(() => location.href);
  const normalize = (s) => s.replace(/\/+$/, "").toLowerCase();
  const wanted = normalize(targetPath);

  // First signal that *something* happened
  const first = await Promise.race([
    page
      .waitForNavigation({ waitUntil: "domcontentloaded", timeout })
      .then(() => true)
      .catch(() => false),
    page
      .waitForFunction(
        (prev, wantedPath) => {
          const href = location.href;
          if (href === prev) return false; // ensure it changed
          const path = new URL(href).pathname.replace(/\/+$/, "").toLowerCase();
          return path.endsWith(wantedPath);
        },
        { timeout },
        prevHref,
        wanted
      )
      .then(() => true)
      .catch(() => false),
  ]);

  if (!first) return false; // both timed out or first to settle was a timeout

  // Final verification of the actual URL/path (important!)
  const ok = await page.evaluate((wantedPath) => {
    const path = new URL(location.href).pathname
      .replace(/\/+$/, "")
      .toLowerCase();
    return path.endsWith(wantedPath);
  }, wanted);

  return !!ok;
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
