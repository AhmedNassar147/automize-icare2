/*
 *
 * Helper: `processCollectingPatients`.
 *
 */
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import collectReferralDetailsDateFromAPI from "./collectReferralDetailsDateFromAPI.mjs";
import sleep from "./sleep.mjs";
import collectPatientAttachments from "./collectPatientAttachments.mjs";
import goToHomePage from "./goToHomePage.mjs";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";
import checkIfWeInDetailsPage from "./checkIfWeInDetailsPage.mjs";

const COOLDOWN_AFTER_BATCH = 55_000;
const MAX_RETRIES = 6;

const processCollectingPatients = async ({
  browser,
  patientsStore,
  page,
  cursor,
  sendWhatsappMessage,
}) => {
  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  try {
    let processedCount = 0;
    let checkDetailsPageRetry = 0;

    while (true) {
      // 🔁 Always re-fetch rows after page changes
      const rows = await collectHomePageTableRows(page);

      const rowsLength = rows.length;

      const isThereNotNewPatients = processedCount >= rowsLength;

      if (isThereNotNewPatients) {
        console.log("⏳ No more new patients found, exiting...");
        await sleep(2_000);
        break;
      }

      const row = rows[processedCount];

      console.time("🕒 collect-row-referral");
      const referralId = await getReferralIdBasedTableRow(row);
      console.timeEnd("🕒 collect-row-referral");

      if (!referralId) {
        console.log(`⏩ Skipping not found referralId: ${referralId}`);
        continue;
      }

      if (patientsStore.has(referralId)) {
        console.log("⚠️ Patient already collected...");
        continue;
      }

      const iconButton = await row.$("td:last-child button");
      if (!iconButton) {
        console.log("⚠️ No button found in this row, skipping...");
        continue;
      }

      processedCount++;
      console.log(`\n👉 Processing row ${processedCount} of ${rowsLength}`);

      console.log(`📡 Monitoring referralId=(${referralId}) API responses...`);
      const detailsApiDataPromise = collectReferralDetailsDateFromAPI({
        page,
        referralId,
        useDefaultMessageIfNotFound: true,
      });

      console.log(`✅ clicking patient button for referralId=(${referralId})`);
      await sleep(50 + Math.random() * 50);
      await iconButton.click();

      const logString = `details page for referralId=(${referralId})`;

      const areWeInDetailsPage = await checkIfWeInDetailsPage(page, true);

      if (!areWeInDetailsPage) {
        const hasReachedMaxRetriesForDetailsPage =
          checkDetailsPageRetry >= MAX_RETRIES;

        if (hasReachedMaxRetriesForDetailsPage) {
          await sendWhatsappMessage(phoneNumber, {
            message: `❌ Tried ${checkDetailsPageRetry} times to enter the details page for referralId=(${referralId}) collection, but there is something wrong.`,
          });
          await goToHomePage(page, cursor);
          await sleep(COOLDOWN_AFTER_BATCH);

          checkDetailsPageRetry = 0;
          break;
        }

        await goToHomePage(page, cursor);
        checkDetailsPageRetry += 1;
        await sleep(400 + Math.random() * 20);
        continue;
      } else {
        checkDetailsPageRetry = 0;
      }

      await makeKeyboardNoise(page, logString);

      await scrollDetailsPageSections({
        cursor,
        logString,
        page,
        sectionsIndices: [1, 2, 3],
        scrollDelay: 250,
      });

      console.log("_areWeInDetailsPage_when fetch details");
      let detailsApiData;

      try {
        detailsApiData = await detailsApiDataPromise;
      } catch (err) {
        console.error(
          `❌ Failed collecting API data for referralId=${referralId}:`,
          err.message
        );
        await goToHomePage(page, cursor);
        await sleep(1000);
        continue;
      }

      const { patientName, specialty, apisError } = detailsApiData;

      if (apisError) {
        await goToHomePage(page, cursor);
        await sleep(2000);

        console.log(`❌ Skipping referralId=${referralId}, reason:`, apisError);
        continue;
      }

      const attachmentData = await collectPatientAttachments({
        page,
        cursor,
        patientName,
        specialty,
        referralId,
      });

      const finalData = {
        referralId,
        ...detailsApiData,
        files: attachmentData,
      };

      await patientsStore.addPatients(finalData);

      await goToHomePage(page, cursor);

      await sleep(1000);

      await Promise.allSettled([
        generateAcceptancePdfLetters(browser, [finalData], true),
        generateAcceptancePdfLetters(browser, [finalData], false),
      ]);

      if (processedCount === rowsLength) {
        console.log(
          `😴 Sleeping ${COOLDOWN_AFTER_BATCH / 1000}s after final patient...`
        );
        await sleep(COOLDOWN_AFTER_BATCH);
      }
    }

    console.log(`✅ Collected ${processedCount} patients successfully.`);
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
