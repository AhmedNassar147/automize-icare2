/*
 *
 * Helper: `processSendPatientsToClient`.
 *
 */
import formatPatientToTelegramOrWA from "./formatPatientToTelegramOrWA.mjs";
import notifyUserWithNewCase from "./notifyUserWithNewCase.mjs";

const processSendPatientsToClient =
  (patientsStore, sendTelegramMessage, skipNotify = false) =>
  async (addedPatients = []) => {
    const fakeRejectionEnabled = process.env.FAKE_REJECTION_ENABLED === "Y";

    const validPatients = addedPatients.filter(Boolean);

    const tasks = validPatients.flatMap((patient) => {
      const { message, files, referralId } = formatPatientToTelegramOrWA(
        patient,
        true,
      );

      const patientTasks = [sendTelegramMessage(message, files, referralId)];

      if (referralId && fakeRejectionEnabled) {
        patientTasks.unshift(
          patientsStore.scheduleFakeRejectProbe(referralId, false),
        );
      }

      return patientTasks;
    });

    await Promise.allSettled(tasks);

    if (!skipNotify && validPatients.length) {
      const [{ referralId }] = validPatients;
      await notifyUserWithNewCase(referralId);
    }
  };

export default processSendPatientsToClient;
