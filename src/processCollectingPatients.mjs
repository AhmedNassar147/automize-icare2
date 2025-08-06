/*
 *
 * Helper: `processCollectingPatients`.
 *
 */
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import sleep from "./sleep.mjs";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";
import getPatientReferralDataFromAPI from "./getPatientReferralDataFromAPI.mjs";
import { estimatedTimeForProcessingAction } from "./constants.mjs";

const formateDateToString = (date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Riyadh",
    hour12: true,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .format(date)
    .replace(",", "");

const getSaudiStartAndEndDate = (referralDate) => {
  const utcDate = new Date(referralDate);

  // Convert to Saudi time
  const saStartDate = new Date(
    utcDate.toLocaleString("en-US", { timeZone: "Asia/Riyadh" })
  );

  // Clone for end date
  const saEndDate = new Date(saStartDate);
  saEndDate.setMinutes(saEndDate.getMinutes() + 15);

  const referralEndTimestamp = saEndDate.getTime();
  const timeWithUserReaction = estimatedTimeForProcessingAction + 3000;

  const referralEndDateActionableAtMS =
    referralEndTimestamp > timeWithUserReaction
      ? referralEndTimestamp - estimatedTimeForProcessingAction
      : referralEndTimestamp;

  return {
    referralDate,
    referralStartDate: formateDateToString(saStartDate),
    referralEndDate: formateDateToString(saEndDate),
    referralEndTimestamp: referralEndTimestamp,
    referralEndDateActionableAtMS,
    referralEndDateActionablAt: formateDateToString(
      referralEndDateActionableAtMS
    ),
  };
};

const processCollectingPatients = async ({ browser, patientsStore, page }) => {
  try {
    let processedCount = 0;

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

      console.log(
        `📡 fetch patient referralId=(${referralId}) API responses...`
      );
      const patientData = await getPatientReferralDataFromAPI(page, referralId);

      const { patientDetailsError, patientInfoError, attchmentsError } =
        patientData;

      if (patientDetailsError || patientInfoError || attchmentsError) {
        console.log(
          `❌ Error when colleting referralId=${referralId}, reason:`,
          [patientDetailsError, patientInfoError, attchmentsError].join("__")
        );
        break;
      }

      const finalData = {
        referralId,
        ...getSaudiStartAndEndDate(referralDate),
        ...patientData,
      };

      await patientsStore.addPatients(finalData);
      processedCount++;
      console.log(`\n👉 Processed row ${processedCount} of ${rowsLength}`);

      await Promise.allSettled([
        generateAcceptancePdfLetters(browser, [finalData], true),
        generateAcceptancePdfLetters(browser, [finalData], false),
      ]);

      await sleep(4_000);

      if (processedCount >= rowsLength) {
        await sleep(3000 + Math.random() * 1000);
        break;
      }
    }
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
