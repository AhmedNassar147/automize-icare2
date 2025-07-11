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

      const isThereNotNewPatients = processedCount >= rows.length;

      if (isThereNotNewPatients) {
        console.log("⏳ No more new patients found, exiting...");
        await sleep(2_000);
        break;
      }

      const row = rows[processedCount];
      processedCount++;

      console.log(`\n👉 Processing row ${processedCount} of ${rows.length}`);

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

      console.log(`✅ waiting 2.2s in ${logString} to collect patient data`);
      await sleep(2200);

      await makeKeyboardNoise(page, logString);

      const targetIndexes = [1, 2, 3];

      await scrollDetailsPageSections({
        cursor,
        logString,
        page,
        sectionsIndices: targetIndexes,
      });

      const detailsApiData = await detailsApiDataPromise;

      const { patientName, specialty, apisError } = detailsApiData;

      if (apisError) {
        await goToHomePage(page, cursor);
        await sleep(1000);

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

      await sleep(45_000);
    }

    console.log(`✅ Collected ${processedCount} patients successfully.`);
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
