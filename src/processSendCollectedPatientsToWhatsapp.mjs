/*
 *
 * Helper: `processSendCollectedPatientsToWhatsapp`.
 *
 */
import createConfirmationMessage from "./createConfirmationMessage.mjs";

const getReadableDate = (isoDate) => {
  if (!isoDate) {
    return "";
  }

  const date = new Date(isoDate);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone, // explicitly use detected timezone
    timeZoneName: "short",
  };

  return date.toLocaleString("en-US", options);
};

const processSendCollectedPatientsToWhatsapp =
  (sendWhatsappMessage) => async (addedPatients) => {
    console.log("addedPatients started, posting patients to WhatsApp...");

    // Format the message
    const formatPatient = (
      {
        patientName,
        referralDate,
        referralId,
        nationality,
        nationalId,
        referralType,
        requiredSpecialty,
        providerSourceName,
        sourceZone,
        referralReason,
        files,
        startedAt,
        // startedAtMessage,
      },
      i
    ) => {
      const message =
        `🚨 *New Case Alert!* 🚨\n` +
        `⏰ *Arrived at:* \`${getReadableDate(startedAt)}\`\n` +
        `─────────────────────────────\n` +
        `👤 *Name:* ${patientName}\n` +
        `🌍 *Nationality:* ${nationality || ""}\n` +
        `🆔 *National ID:* ${nationalId}\n` +
        `🔢 *Referral ID:* ${referralId}\n` +
        `🏷️ *Referral Type:* ${referralType}\n` +
        `🩺 *Specialty:* ${requiredSpecialty || ""}\n` +
        `🏥 *Provider:* ${providerSourceName || ""}\n` +
        `📍 *Zone:* ${sourceZone}\n` +
        `📅 *Requested At:* ${referralDate}\n` +
        `📅 *Reason:* ${referralReason}\n` +
        `─────────────────────────────\n` +
        `🚨 *‼️ ATTENTION ‼️*\n` +
        // `*${startedAtMessage}*\n` +
        `*Please review And Reply on this message with:*\n` +
        `${createConfirmationMessage()}`;

      return {
        message,
        files: files,
      };
    };

    await sendWhatsappMessage(
      process.env.CLIENT_WHATSAPP_NUMBER,
      addedPatients.map(formatPatient)
    );
  };

export default processSendCollectedPatientsToWhatsapp;
