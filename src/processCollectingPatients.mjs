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

// const COOLDOWN_AFTER_BATCH = 55_000;
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
        await sleep(3_000 + Math.random() * 100);
        break;
      }

      const row = rows[processedCount];

      const referralId = await getReferralIdBasedTableRow(row);

      if (!referralId) {
        console.log(`⏩ didn't find referralId: ${referralId}`);
        break;
      }

      if (patientsStore.has(referralId)) {
        console.log("⚠️ Patient already collected...");
        await sleep(1000);
        break;
      }

      const iconButton = await row.$("td:last-child button");
      if (!iconButton) {
        console.log("⚠️ No button found in this row, skipping...");
        break;
      }

      console.log(`📡 Monitoring referralId=(${referralId}) API responses...`);
      const detailsApiDataPromise = collectReferralDetailsDateFromAPI({
        page,
        referralId,
        useDefaultMessageIfNotFound: true,
      });

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
          checkDetailsPageRetry = 0;
          await goToHomePage(page, cursor);
          // await sleep(2000 + Math.random() * 70);

          break;
        }

        checkDetailsPageRetry += 1;
        await goToHomePage(page, cursor);
        await sleep(1000 + Math.random() * 70);
        continue;
      }

      checkDetailsPageRetry = 0;

      await makeKeyboardNoise(page, logString);

      await scrollDetailsPageSections({
        cursor,
        logString,
        page,
        sectionsIndices: [1, 2, 3],
        scrollDelay: 200,
      });

      let detailsApiData;

      try {
        detailsApiData = await detailsApiDataPromise;
      } catch (err) {
        await goToHomePage(page, cursor);
        console.error(
          `❌ Failed collecting API data for referralId=${referralId}:`,
          err.message
        );
        break;
      }

      const { patientName, specialty, apisError } = detailsApiData;

      if (apisError) {
        await goToHomePage(page, cursor);
        console.log(
          `❌ Error when colleting referralId=${referralId}, reason:`,
          apisError
        );
        break;
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
      processedCount++;
      console.log(`\n👉 Processed row ${processedCount} of ${rowsLength}`);

      await goToHomePage(page, cursor);

      await sleep(1000);

      await Promise.allSettled([
        generateAcceptancePdfLetters(browser, [finalData], true),
        generateAcceptancePdfLetters(browser, [finalData], false),
      ]);

      if (processedCount >= rowsLength) {
        // console.log(
        //   `😴 Sleeping ${COOLDOWN_AFTER_BATCH / 1000}s after final patient...`
        // );
        // await sleep(COOLDOWN_AFTER_BATCH);
        break;
      }
    }
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
