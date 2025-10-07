/*
 *
 * Helper: `createDetailsPageWhatsappHandlers`.
 *
 */
const createDetailsPageWhatsappHandlers = ({
  actionName,
  referralId,
  patientName,
  continueFetchingPatientsIfPaused,
  isAcceptance,
  sendWhatsappMessage,
  logString,
  page,
}) => {
  const phoneNumber = process.env.CLIENT_WHATSAPP_NUMBER;

  const baseMessage = `🚨 *\`${actionName.toUpperCase()}\`* Case Alert! 🚨
🆔 Referral: *${referralId}*
👤 Name: _${patientName}_\n`;

  const sendSuccessMessage = async (durationText) => {
    try {
      continueFetchingPatientsIfPaused();
      const timeStamp = Date.now();
      const status = isAcceptance ? "Accepted" : "Rejected";

      await sendWhatsappMessage(phoneNumber, {
        message: `${baseMessage}✅ Status: *SUCCESS*\nPatient has been *${status}*\n${durationText}\n🕓 *timeStamp*: ${timeStamp}`,
      });

      console.log(`✅ ${status} ${durationText} in ${logString}`);
    } catch (error) {
      console.log("Error when sending whatsapp success data");
    }
  };

  const sendErrorMessage = async (reason, fileName, durationText = "") => {
    try {
      continueFetchingPatientsIfPaused();

      const timeStamp = Date.now();

      const fullMessage = `${baseMessage}❌ Status: *ERROR*\n*Reason*: ${reason}\n${durationText}\n🕓 *timeStamp*: ${timeStamp}`;

      await Promise.allSettled([
        sendWhatsappMessage(phoneNumber, { message: fullMessage }),
        fileName
          ? page.screenshot({
              path: `screenshots/${fileName}-for-${referralId}-${timeStamp}.png`,
            })
          : Promise.resolve(),
      ]);

      console.log(`❌ ${reason} ${durationText} in ${logString}`);
    } catch (error) {
      console.log("Error when sending whatsapp error data");
    }
  };

  return {
    sendSuccessMessage,
    sendErrorMessage,
  };
};

export default createDetailsPageWhatsappHandlers;
