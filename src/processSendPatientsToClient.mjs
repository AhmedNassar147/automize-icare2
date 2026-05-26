/*
 *
 * Helper: `processSendPatientsToClient`.
 *
 */
import formatPatientToTelegramOrWA from "./formatPatientToTelegramOrWA.mjs";
import notifyUserWithNewCase from "./notifyUserWithNewCase.mjs";

const processSendPatientsToClient =
  (sendTelegramMessage, skipNotify = false) =>
  async (addedPatients = []) => {
    const validPatients = addedPatients.filter(Boolean);

    const telegramApis = validPatients.map((patient) => {
      const { message, files, referralId } = formatPatientToTelegramOrWA(
        patient,
        true,
      );

      return sendTelegramMessage(message, files, referralId);
    });

    await Promise.all(telegramApis);

    if (!skipNotify && validPatients.length) {
      const [{ referralId }] = validPatients;
      await notifyUserWithNewCase(referralId);
    }
  };

export default processSendPatientsToClient;
