/*
 *
 * Helper: `processClientActionOnPatient`.
 *
 */
import { writeFile /*  readFile */ } from "fs/promises";
import { join, resolve /* basename*/ } from "path";
import goToHomePage from "./goToHomePage.mjs";
import selectAttachmentDropdownOption from "./selectAttachmentDropdownOption.mjs";
import closePageSafely from "./closePageSafely.mjs";
import buildDurationText from "./buildDurationText.mjs";
import handleAfterSubmitDone from "./handleAfterSubmitDone.mjs";
import isAcceptanceButtonShown from "./isAcceptanceButtonShown.mjs";
import createDetailsPageWhatsappHandlers from "./createDetailsPageWhatsappHandlers.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  htmlFilesPath,
  tableRowsSelector,
  dashboardLinkSelector,
} from "./constants.mjs";
import sleep from "./sleep.mjs";

async function waitForReferralDetails(page, timeout = 6000) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    const ok = await page.evaluate(() => {
      const h4 = document.evaluate(
        "//div[contains(@class,'breadcrumb')]//h4[normalize-space()='Referral Details']",
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;

      return !!h4;
    });

    if (ok) return true;

    await sleep(20);
  }

  return false;
}

const processClientActionOnPatient = async ({
  browser,
  actionType,
  patient,
  patientsStore,
  sendWhatsappMessage,
  continueFetchingPatientsIfPaused,
}) => {
  const { referralId, patientName, referralEndTimestamp } = patient;

  const isAcceptance = USER_ACTION_TYPES.ACCEPT === actionType;

  const actionName = isAcceptance ? "Acceptance" : "Rejection";

  const logString = `details page referralId=(${referralId})`;

  const acceptanceFilePath = join(
    generatedPdfsPathForAcceptance,
    `${USER_ACTION_TYPES.ACCEPT}-${referralId}.pdf`
  );

  const rejectionFilePath = join(
    generatedPdfsPathForRejection,
    `${USER_ACTION_TYPES.REJECT}-${referralId}.pdf`
  );

  const filePath = resolve(
    isAcceptance ? acceptanceFilePath : rejectionFilePath
  );

  const page = await browser.newPage();

  try {
    await page.goto(HOME_PAGE_URL, {
      waitUntil: "networkidle2",
      timeout: 10_000,
    });

    await page.waitForSelector(tableRowsSelector, {
      timeout: 6000,
    });
  } catch (error) {}

  const { sendErrorMessage, sendSuccessMessage } =
    createDetailsPageWhatsappHandlers({
      page,
      actionName,
      referralId,
      patientName,
      continueFetchingPatientsIfPaused,
      isAcceptance,
      sendWhatsappMessage,
      logString,
    });

  const closeCurrentPage = async (navigateToHomePage) => {
    if (navigateToHomePage) {
      await goToHomePage(page);
    }
    await closePageSafely(page);
  };

  const timeToStartSearch = referralEndTimestamp - 11050;

  const sleepTime = timeToStartSearch - Date.now();

  if (sleepTime > 0) {
    await sleep(sleepTime);
  }

  try {
    const element = await page.$(dashboardLinkSelector);
    await element?.click();
  } catch (error) {}

  let startTime = Date.now();

  try {
    const remainingMs = referralEndTimestamp - Date.now();

    const { elapsedMs, reason, isReadyByTime } = await isAcceptanceButtonShown({
      page,
      idReferral: referralId,
      remainingMs,
    });

    console.log(
      `referralId=${referralId} remainingMs=${remainingMs} isReadyByTime=${isReadyByTime} reason=${reason} elapsedMs=${elapsedMs}`
    );

    startTime = Date.now();
    await page.evaluate((referralId) => {
      window.history.replaceState(
        {
          usr: { idReferral: referralId, type: "Referral" },
          key: `pt-${referralId}`,
          idx: window.history.state?.idx + 1 || 2,
        },
        "",
        "/referral/details"
      );
      window.dispatchEvent(
        new PopStateEvent("popstate", { state: window.history.state })
      );
    }, referralId);

    await waitForReferralDetails(page, 8000);

    await Promise.allSettled([
      page.evaluate(() => {
        const section = document.querySelector(
          "section.referral-button-container"
        );
        if (!section) return;
        section.style.position = "absolute";
        section.style.top = "845px";
        section.style.right = "8%";
        section.style.width = "100%";
      }),
      selectAttachmentDropdownOption(page, actionName),
    ]);
    const fileInput = await page.$('#upload-single-file input[type="file"]');
    await fileInput.uploadFile(filePath);

    await handleAfterSubmitDone({
      page,
      startTime,
      continueFetchingPatientsIfPaused,
      patientsStore,
      sendErrorMessage,
      sendSuccessMessage,
      closeCurrentPage,
      actionName,
      acceptanceFilePath,
      rejectionFilePath,
      referralId,
    });
  } catch (error) {
    try {
      const html = await page.content();
      await writeFile(`${htmlFilesPath}/details_page_catch_error.html`, html);
    } catch (error) {
      console.log("couldn't get details page html", error.message);
    }

    const _err = error?.message || String(error);

    console.log(`🛑 Error during ${actionName} of ${referralId}:`, _err);
    await sendErrorMessage(
      `Error: ${_err}`,
      `catch-error-${actionName}-error`,
      buildDurationText(startTime, Date.now())
    );
    await closeCurrentPage(false);
  } finally {
    continueFetchingPatientsIfPaused();
  }
};

export default processClientActionOnPatient;
