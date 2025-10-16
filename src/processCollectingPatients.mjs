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

// const generateRandomInt = (min = 9000, max = 13000, step = 1000) => {
//   const start = Math.ceil(min / step);
//   const end = Math.floor(max / step);
//   if (end < start) throw new Error("No multiples in range");
//   const k = Math.floor(Math.random() * (end - start + 1)) + start;
//   return k * step;
// };

function generateRandomMs(min = 9500, max = 14400) {
  if (min > max) [min, max] = [max, min]; // swap if reversed
  min = Math.floor(min);
  max = Math.floor(max); // ms as integers
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

const getSaudiStartAndEndDate = ({
  referralDate,
  caseAlertMessage,
  cutoffTimeMs,
  detailsAPiFiresAtMS,
  detailsAPiServerResponseTimeMS,
}) => {
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

    leftMs = (minsLeft * 60 + secsLeft) * 1000;

    saStartDate = new Date(
      detailsAPiFiresAtMS - detailsAPiServerResponseTimeMS - leftMs
    );
  }

  // Clone for end date
  const saEndDate = new Date(saStartDate);
  saEndDate.setMilliseconds(saEndDate.getMilliseconds() + leftMs);

  const referralEndTimestamp = saEndDate.getTime();
  const timeWithUserReaction = cutoffTimeMs + 2000;

  const shouldCutoffTime = referralEndTimestamp > timeWithUserReaction;

  const referralEndDateActionableAtMS = shouldCutoffTime
    ? referralEndTimestamp - cutoffTimeMs
    : referralEndTimestamp;

  return {
    cutoffTimeMs: shouldCutoffTime ? cutoffTimeMs : 0,
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
    // Collect rows once (instead of inside while loop)
    const rows = await collectHomePageTableRows(page);

    const rowsLength = rows?.length ?? 0;

    if (!rowsLength) {
      await sleep(4_000);
      console.log("⏳ No patients found, exiting...");
      return;
    }

    console.log(`📋 Found ${rowsLength} rows to process.`);

    let index = 0;

    for (const row of rows) {
      index++;
      const { referralId, referralDate } = await getReferralIdBasedTableRow(
        row
      );

      console.log(`Progress: ${index}/${rowsLength}`);

      if (!referralId) {
        console.log(`⏩ didn't find referralId: ${referralId}`);
        break;
      }

      if (patientsStore.has(referralId)) {
        console.log(`⚠️ Patient referralId=${referralId} already collected...`);
        await sleep(3_000);
        continue;
      }

      console.log(
        `📡 fetch patient referralId=(${referralId}) API responses...`
      );

      const patientData = await getPatientReferralDataFromAPI(page, referralId);
      const {
        patientDetailsError,
        patientInfoError,
        attchmentsError,
        caseAlertMessage,
        detailsAPiFiresAtMS,
        detailsAPiServerResponseTimeMS,
      } = patientData;

      if (patientDetailsError || patientInfoError || attchmentsError) {
        console.log(
          `❌ Error when collecting referralId=${referralId}, reason:`,
          [patientDetailsError, patientInfoError, attchmentsError].join("__")
        );
        break;
      }

      const cutoffTimeMs = generateRandomMs();

      const finalData = {
        referralId,
        ...getSaudiStartAndEndDate({
          referralDate,
          detailsAPiServerResponseTimeMS,
          detailsAPiFiresAtMS,
          caseAlertMessage,
          cutoffTimeMs,
        }),
        ...patientData,
      };

      await patientsStore.addPatients(finalData);

      await Promise.allSettled([
        generateAcceptancePdfLetters(browser, [finalData], true),
        generateAcceptancePdfLetters(browser, [finalData], false),
      ]);

      await sleep(3_000 + Math.random() * 2_000);
    }

    console.log("✅ Finished processing all rows.");
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
