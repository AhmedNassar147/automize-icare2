/*
 *
 * Helper: `processCollectingPatients`.
 *
 */
// import extractReferralTableData from "./extractReferralTableData.mjs";
import generateAcceptancePdfLetters from "./generatePdfs.mjs";
import openDetailsPageAndDoUserAction from "./openDetailsPageAndDoUserAction.mjs";
import processHomeTableAndCollectPatients from "./new/processHomeTableAndCollectPatients.mjs";
import { USER_ACTION_TYPES } from "./constants.mjs";

const processCollectingPatients = async ({
  browser,
  patientsStore,
  page,
  cursor,
}) => {
  console.log("✅ start Collecting Patients...");
  try {
    const foundPatients = await processHomeTableAndCollectPatients({
      page,
      cursor,
      alreadyCollectedIds: patientsStore.getIds(),
    });

    const filteredPatientLength = foundPatients.length;

    if (!filteredPatientLength) {
      console.log("✅ No new patients found.");
      return;
    }

    await patientsStore.addPatients(foundPatients.filter(Boolean));

    return;

    const results = [];
    console.time("collecting patient data from details page");

    for (let i = 0; i < filteredPatientLength; i++) {
      const patient = filteredPatientsData[i];
      const { patientDetails, message } = await openDetailsPageAndDoUserAction({
        actionType: USER_ACTION_TYPES.COLLECT,
        browser,
        page,
        patient,
        goBackFinally: true,
      });

      if (patientDetails) {
        results.push(patientDetails);
      }

      console.log(message);
    }

    await patientsStore.addPatients(results.filter(Boolean));
    console.timeEnd("collecting patient data from details page");

    (async () => {
      try {
        await Promise.all([
          generateAcceptancePdfLetters(browser, filteredPatientsData, true),
          generateAcceptancePdfLetters(browser, filteredPatientsData),
        ]);
      } catch (error) {
        console.error(`🛑 Error generating PDFs`, error.message);
      }
    })();
  } catch (err) {
    console.error("🛑 Fatal error during collecting patients:", err.message);
  }
};

export default processCollectingPatients;
