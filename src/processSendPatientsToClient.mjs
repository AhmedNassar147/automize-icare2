/*
 *
 * Helper: `processSendPatientsToClient`.
 *
 */
import formatPatientToTelegramOrWA from "./formatPatientToTelegramOrWA.mjs";
import notifyUserWithNewCase from "./notifyUserWithNewCase.mjs";

const processSendPatientsToClient =
  (sendTelegramMessage, skipNotify = false) =>
  async (addedPatients) => {
    const telegramApis = addedPatients
      .filter(Boolean)
      .map((patient) => formatPatientToTelegramOrWA(patient, true))
      .map(({ message, files, referralId }) =>
        sendTelegramMessage(message, files, referralId),
      );

    await Promise.all(telegramApis);

    if (!skipNotify && addedPatients.length) {
      const [{ referralId }] = addedPatients;
      await notifyUserWithNewCase(referralId);
    }
  };

export default processSendPatientsToClient;
