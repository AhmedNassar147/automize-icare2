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

const getSaudiStartAndEndDate = (referralDate) => {
  const utcDate = new Date(referralDate);

  // Convert to Saudi time
  const saStartDate = new Date(
    utcDate.toLocaleString("en-US", { timeZone: "Asia/Riyadh" })
  );

  // Clone for end date
  const saEndDate = new Date(saStartDate);
  saEndDate.setMinutes(saEndDate.getMinutes() + 15);

  return {
    referralDate,
    referralStartDate: saStartDate.toLocaleString("en-SA", {
      timeZone: "Asia/Riyadh",
      hour12: false,
    }),
    referralEndDate: saEndDate.toLocaleString("en-SA", {
      timeZone: "Asia/Riyadh",
      hour12: false,
    }),
    referralStartTimestamp: saStartDate.getTime(),
    referralEndTimestamp: saEndDate.getTime(),
  };
};

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
        await sleep(1500 + Math.random() * 100);
        break;
      }

      const row = rows[processedCount];

      const { referralId, referralDate } = await getReferralIdBasedTableRow(
        row
      );

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

      await sleep(40 + Math.random() * 50);
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
          await goToHomePage(page);
          // await sleep(2000 + Math.random() * 70);

          break;
        }

        checkDetailsPageRetry += 1;
        await goToHomePage(page);
        await sleep(1000 + Math.random() * 70);
        continue;
      }

      checkDetailsPageRetry = 0;

      await makeKeyboardNoise(page);

      await scrollDetailsPageSections({
        cursor,
        logString,
        page,
        sectionsIndices: [1, 2, 3],
        scrollDelay: 180,
      });

      let detailsApiData;

      try {
        detailsApiData = await detailsApiDataPromise;
      } catch (err) {
        await goToHomePage(page);
        console.error(
          `❌ Failed collecting API data for referralId=${referralId}:`,
          err.message
        );
        break;
      }

      const { patientName, specialty, apisError } = detailsApiData;

      if (apisError) {
        await goToHomePage(page);
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
        ...getSaudiStartAndEndDate(referralDate),
        ...detailsApiData,
        files: attachmentData,
      };

      await patientsStore.addPatients(finalData);
      processedCount++;
      console.log(`\n👉 Processed row ${processedCount} of ${rowsLength}`);

      await goToHomePage(page);

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
