/*
 *
 * Helper: `processCollectingPatients`.
 *
 */
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import getPatientReferralDataFromAPI from "./getPatientReferralDataFromAPI.mjs";
import { cutoffTimeMs } from "./constants.mjs";
import sleep from "./sleep.mjs";
import insureFetchedPatientData from "./insureFetchedPatientData.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";

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

    const _leftMs = (minsLeft * 60 + secsLeft) * 1000;

    const backExtraTime = Min_15 - _leftMs;

    saStartDate = new Date(
      detailsAPiFiresAtMS - detailsAPiServerResponseTimeMS - backExtraTime
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

const processCollectingPatients = async ({
  browser,
  patientsStore,
  page,
  patients,
}) => {
  let newPatientAdded = false;

  try {
    const patientsLength = patients?.length ?? 0;

    let index = 0;

    for (const patient of patients) {
      index++;

      const { idReferral, referralDate } = patient || {};
      const referralId = String(idReferral);

      if (!referralId) {
        createConsoleMessage(`⏩ skipping patient without referralId`, "warn");
        continue;
      }

      createConsoleMessage(
        `🔹 Progress: ${index}/${patientsLength} (referralId=${referralId})`,
        "info"
      );

      if (patientsStore.has(referralId)) {
        createConsoleMessage(
          `✅ Skipping referralId=${referralId} already collected...`,
          "info"
        );
        continue;
      }

      // mark as we found at least one new patient (before processing)
      if (!newPatientAdded) newPatientAdded = true;

      createConsoleMessage(
        `📡 Fetching data for referralId=(${referralId})...`
      );

      // Call existing API function to get detailed patient info
      const patientData = await insureFetchedPatientData(
        () => getPatientReferralDataFromAPI(page, referralId),
        3, // attempts
        1200 // base backoff ms
      );

      const {
        patientDetailsError,
        patientInfoError,
        attchmentsError,
        caseAlertMessage,
        detailsAPiFiresAtMS,
        detailsAPiServerResponseTimeMS,
      } = patientData || {};

      const hasInternalError =
        !patientData ||
        patientDetailsError ||
        patientInfoError ||
        attchmentsError;

      if (hasInternalError) {
        createConsoleMessage(
          `❌ Error collecting referralId=${referralId} => patientData=${!!patientData}, patientDetailsError=${patientDetailsError}, patientInfoError=${patientInfoError}, attchmentsError=${attchmentsError}`,
          "error"
        );
        continue;
      }

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

      // Generate acceptance PDFs concurrently
      await Promise.allSettled([
        generateAcceptancePdfLetters(browser, [finalData], true),
        generateAcceptancePdfLetters(browser, [finalData], false),
      ]);

      await sleep(2500 + Math.random() * 3000);
    }

    createConsoleMessage(
      `✅ Finished processing all patients from API.`,
      "info"
    );
  } catch (err) {
    createConsoleMessage(
      err,
      "error",
      `🛑 Fatal error during processing patients:`
    );
  }

  await sleep(2000 + Math.random() * 3000);

  return newPatientAdded;
};

export default processCollectingPatients;
