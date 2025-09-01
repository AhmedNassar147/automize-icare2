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

const getSaudiStartAndEndDate = (referralDate, caseAlertMessage) => {
  const currentDate = new Date();
  const utcDate = new Date(referralDate);

  // Convert to Saudi time
  let saStartDate = new Date(
    utcDate.toLocaleString("en-US", { timeZone: "Asia/Riyadh" })
  );

  let leftMs = 15 * 60 * 1000;

  const Min_15 = 15 * 60 * 1000;

  if (saStartDate < new Date(currentDate - Min_15) && caseAlertMessage) {
    const match = caseAlertMessage.match(
      /(\d+)\s*(?:minute(?:\(s\))?|mins?|min)\s+and\s+(\d+)\s*(?:second(?:\(s\))?|secs?|sec)/
    );

    const minsLeft = parseInt(match?.[1], 10) ?? 0;
    const secsLeft = parseInt(match?.[2], 10) ?? 0;

    saStartDate = currentDate;
    leftMs = (minsLeft * 60 + secsLeft) * 1000;
  }

  // Clone for end date
  const saEndDate = new Date(saStartDate);
  saEndDate.setMilliseconds(saEndDate.getMilliseconds() + leftMs);

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

      if (isThereNotNewPatients || !rowsLength) {
        console.log("⏳ No more new patients found, exiting...");
        await sleep(1500 + Math.random() * 150);
        break;
      }

      const row = rows[processedCount];

      const { referralId, referralDate } = await getReferralIdBasedTableRow(
        row
      );

      console.log(`Progress: ${processedCount + 1}/${rowsLength}`);

      if (!referralId) {
        console.log(`⏩ didn't find referralId: ${referralId}`);
        break;
      }

      if (patientsStore.has(referralId)) {
        console.log(`⚠️ Patient referralId=${referralId} already collected...`);
        await sleep(3_000);
      } else {
        console.log(
          `📡 fetch patient referralId=(${referralId}) API responses...`
        );
        const patientData = await getPatientReferralDataFromAPI(
          page,
          referralId
        );

        const {
          patientDetailsError,
          patientInfoError,
          attchmentsError,
          caseAlertMessage,
        } = patientData;

        if (patientDetailsError || patientInfoError || attchmentsError) {
          console.log(
            `❌ Error when colleting referralId=${referralId}, reason:`,
            [patientDetailsError, patientInfoError, attchmentsError].join("__")
          );
          break;
        }

        const finalData = {
          referralId,
          ...getSaudiStartAndEndDate(referralDate, caseAlertMessage),
          ...patientData,
        };

        await patientsStore.addPatients(finalData);

        await Promise.allSettled([
          generateAcceptancePdfLetters(browser, [finalData], true),
          generateAcceptancePdfLetters(browser, [finalData], false),
        ]);

        await sleep(3_000);
      }

      processedCount++;

      if (processedCount >= rowsLength) {
        console.log("✅ All rows processed.");
        break;
      }
    }
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
