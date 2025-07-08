/*
 *
 * Helper: `processCollectingPatients`.
 *
 */
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import humanClick from "./humanClick.mjs";
import collectReferralDetailsFromApis from "./collectReferralDetailsFromApis.mjs";
import sleep from "./sleep.mjs";
import collectPatientAttachments from "./collectPatientAttachments.mjs";
import goToHomePage from "./goToHomePage.mjs";
import getWhenCaseStarted from "./getWhenCaseStarted.mjs";
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
    const currentCollectdListId = [...(patientsStore.getIds() || [])];

    let processedCount = 0;

    while (true) {
      // 🔁 Always re-fetch rows after page changes
      const rows = await collectHomePageTableRows(page);

      const isThereNotNewPatients = processedCount >= rows.length;

      if (isThereNotNewPatients) {
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

      if (currentCollectdListId.includes(referralId)) {
        continue;
      }

      const button = await row.$("td:last-child button");
      if (!button) {
        console.log("⚠️ No button found in this row, skipping...");
        continue;
      }

      // const isButtonInvisible = await isElementInvisible(button, viewportHeight);

      // if (isButtonInvisible) {
      //   await scrollIntoView(page, cursor, button);
      // }

      console.log("✅ start monitoring apis");
      const apiWaiter = collectReferralDetailsFromApis(page, referralId);

      console.log(`✅ clicking patient button for referralId=(${referralId})`);

      await Promise.all([
        page.waitForNavigation({
          waitUntil: "domcontentloaded",
        }),
        humanClick(page, cursor, button),
      ]);

      const logString = `details page for referralId=(${referralId})`;

      console.log(`✅ waiting for ${logString}`);

      const delayMs = 50 + Math.random() * 50;
      await sleep(delayMs);

      const caseStartedData = await getWhenCaseStarted(page, delayMs);

      // console.log(`✅ moving radnom cursor in ${logString}`);
      // await moveFromCurrentToRandomPosition(cursor);

      await makeKeyboardNoise(page, logString);

      const targetIndexes = [1, 2, 3];

      const [viewportHeight] = await scrollDetailsPageSections({
        cursor,
        logString,
        page,
        sectionsIndices: targetIndexes,
      });

      const data = await apiWaiter;
      const { patientName, specialty } = data || {};

      if (!patientName && !specialty) {
        console.log(`⚠️ Incomplete data in ${logString}. Skipping.`);
        continue;
      }

      const attachmentData = await collectPatientAttachments({
        page,
        cursor,
        viewportHeight,
        patientName,
        specialty,
        referralId,
      });

      const finalData = {
        ...caseStartedData,
        ...data,
        files: attachmentData,
      };

      await patientsStore.addPatients(finalData);
      currentCollectdListId.push(referralId);

      try {
        await goToHomePage(page, cursor);
      } catch (error) {
        console.log(
          `Error when get back to home in when collecting patient data`,
          error.message
        );
      }

      await sleep(10);

      await Promise.all([
        generateAcceptancePdfLetters(browser, [finalData], true),
        generateAcceptancePdfLetters(browser, [finalData], false),
      ]);

      await sleep(50_000);
    }

    console.log(`✅ Collected ${processedCount} patients successfully.`);
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
