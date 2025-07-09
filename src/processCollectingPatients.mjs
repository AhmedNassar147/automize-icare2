/*
 *
 * Helper: `processCollectingPatients`.
 *
 */
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import humanClick from "./humanClick.mjs";
import collectReferralDetailsFromApis from "./collectReferralInfoFromApis.mjs";
import sleep from "./sleep.mjs";
import collectPatientAttachments from "./collectPatientAttachments.mjs";
import goToHomePage from "./goToHomePage.mjs";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import makeKeyboardNoise from "./makeKeyboardNoise.mjs";
import scrollDetailsPageSections from "./scrollDetailsPageSections.mjs";
import collectReferralDetailsDateFromAPI from "./collectReferralDetailsDateFromAPI.mjs";

const processCollectingPatients = async ({
  browser,
  patientsStore,
  page,
  cursor,
}) => {
  try {
    await sleep(500);

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
      const detailsApiDataPromise = collectReferralDetailsDateFromAPI(
        page,
        referralId,
        true
      );

      const patientInfoApisPromise = collectReferralDetailsFromApis(
        page,
        referralId
      );

      console.log(`✅ clicking patient button for referralId=(${referralId})`);

      await Promise.all([
        page.waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 75_000,
        }),
        humanClick(page, cursor, button),
      ]);

      const logString = `details page for referralId=(${referralId})`;

      console.log(`✅ waiting for ${logString}`);

      await sleep(50 + Math.random() * 50);

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

      const { timingData, mobileNumberFromDetails, ...otherDetailsData } =
        await detailsApiDataPromise;
      const { patientName, mobileNumber, ...patientInfoData } =
        await patientInfoApisPromise;

      const attachmentData = await collectPatientAttachments({
        page,
        cursor,
        viewportHeight,
        patientName,
        specialty,
        referralId,
      });

      const finalData = {
        ...(timingData || null),
        referralId,
        patientName,
        mobileNumber: mobileNumber || mobileNumberFromDetails,
        ...patientInfoData,
        ...otherDetailsData,
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
