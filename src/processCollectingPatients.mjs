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

const processCollectingPatients = async ({
  browser,
  patientsStore,
  page,
  cursor,
}) => {
  try {
    let processedCount = 0;

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
      processedCount++;

      console.log(`\n👉 Processing row ${processedCount} of ${rowsLength}`);

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

      console.log(`📡 Monitoring referralId=(${referralId}) API responses...`);
      const detailsApiDataPromise = collectReferralDetailsDateFromAPI({
        page,
        referralId,
        useDefaultMessageIfNotFound: true,
      });

      console.log(`✅ clicking patient button for referralId=(${referralId})`);
      await sleep(30 + Math.random() * 50);
      await iconButton.click();

      const logString = `details page for referralId=(${referralId})`;

      const areWeInDetailsPage = await checkIfWeInDetailsPage(page, true);

      if (!areWeInDetailsPage) {
        await sleep(2000);
        console.log("we are not in details page");
        continue;
      }

      await makeKeyboardNoise(page, logString);

      console.time("🕒 scrollDetailsPageSections");
      await scrollDetailsPageSections({
        cursor,
        logString,
        page,
        sectionsIndices: [1, 2, 3],
        scrollDelay: 300,
      });
      console.timeEnd("🕒 scrollDetailsPageSections");

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
