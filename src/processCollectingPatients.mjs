/*
 *
 * Helper: `processCollectingPatients`.
 *
 */
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import collectReferralDetailsDateFromAPI from "./collectReferralDetailsDateFromAPI.mjs";
import humanClick from "./humanClick.mjs";
import sleep from "./sleep.mjs";
import collectPatientAttachments from "./collectPatientAttachments.mjs";
import goToHomePage from "./goToHomePage.mjs";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";

const COOLDOWN_AFTER_BATCH = 50_000;

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

      const referralId = await getReferralIdBasedTableRow(page, row);

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

      // Ensure the icon is in view (scrolling horizontally)
      await page.evaluate(
        (el) =>
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
            inline: "end",
          }),
        iconButton
      );

      console.log(`📡 Monitoring referralId=(${referralId}) API responses...`);
      const detailsApiDataPromise = collectReferralDetailsDateFromAPI({
        page,
        referralId,
        useDefaultMessageIfNotFound: true,
      });

      console.log(`✅ clicking patient button for referralId=(${referralId})`);
      await humanClick(page, cursor, iconButton);

      const logString = `details page for referralId=(${referralId})`;

      console.log(`✅ waiting 1.7s in ${logString} to collect patient data`);
      await sleep(1600 + Math.random() * 1000);

      await makeKeyboardNoise(page, logString);

      const targetIndexes = [1, 2, 3];

      await scrollDetailsPageSections({
        cursor,
        logString,
        page,
        sectionsIndices: targetIndexes,
        scrollDelay: 450,
      });

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
