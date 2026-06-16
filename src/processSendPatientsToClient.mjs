/*
 *
 * Helper: `processSendPatientsToClient`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";
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

    const results = await Promise.allSettled(tasks);

    for (const result of results) {
      if (result.status === "rejected") {
        const reason = result.reason?.message || result.reason;

        createConsoleMessage(
          reason,
          "error",
          "processSendPatientsToClient task failed",
        );

        await sendTelegramMessage(
          `⚠️ Failed to send patient info to NTFY:\n${reason}\n\nat processSendPatientsToClient task`,
        ).catch((err) => {
          createConsoleMessage(
            err?.message || err,
            "error",
            "failed to send processSendPatientsToClient error report (telegram message)",
          );
        });
      }
    }

    if (!skipNotify && validPatients.length) {
      const [{ referralId }] = validPatients;
      await notifyUserWithNewCase(referralId, true);
    }
  };

export default processSendPatientsToClient;
