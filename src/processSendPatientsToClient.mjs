/*
 *
 * Helper: `processSendPatientsToClient`.
 *
 */
import formatPatientToTelegramOrWA from "./formatPatientToTelegramOrWA.mjs";
import notifyUserWithNewCase from "./notifyUserWithNewCase.mjs";

const processSendPatientsToClient =
  (sendTelegramMessage, sendWhatsappMessage, skipNotify = false) =>
  async (addedPatients) => {
    const { CLIENT_WHATSAPP_NUMBER } = process.env;

    const formatted_WA_Messages = sendWhatsappMessage
      ? addedPatients
          .filter(Boolean)
          .map((patient) => formatPatientToTelegramOrWA(patient, false))
      : [];

    const telegramApis = addedPatients
      .filter(Boolean)
      .map((patient) => formatPatientToTelegramOrWA(patient, true))
      .map(({ message, files, referralId }) =>
        sendTelegramMessage(message, files, referralId),
      );

    await Promise.all([
      ...telegramApis,
      ...(sendWhatsappMessage
        ? [sendWhatsappMessage(CLIENT_WHATSAPP_NUMBER, formatted_WA_Messages)]
        : []),
    ]);

    if (!skipNotify && addedPatients.length) {
      const [{ referralId }] = addedPatients;
      await notifyUserWithNewCase(referralId);
    }
  };

export default processSendPatientsToClient;
