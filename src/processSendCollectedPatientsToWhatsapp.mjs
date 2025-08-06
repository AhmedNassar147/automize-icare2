/*
 *
 * Helper: `processSendCollectedPatientsToWhatsapp`.
 *
 */
import speakText from "./speakText.mjs";
import createConfirmationMessage from "./createConfirmationMessage.mjs";
import { estimatedTimeForProcessingAction } from "./constants.mjs";

const cutoffTime = estimatedTimeForProcessingAction / 1000;

const processSendCollectedPatientsToWhatsapp =
  (sendWhatsappMessage) => async (addedPatients) => {
    console.log("addedPatients started, posting patients to WhatsApp...");

    const formatPatient = ({
      referralId,
      patientName,
      mobileNumber,
      requestDate,
      nationality,
      nationalId,
      referralType,
      gender,
      maritalStatus,
      hijriDOB,
      specialty,
      subSpecialty,
      sourceProvider,
      providerZone,
      referralCause,
      caseAlertMessage,
      note,
      referralEndDateActionablAt,
      files,
    }) => {
      const message =
        `🚨 *New Case Alert!* 🚨\n\n` +
        `🕐 *Actionable At*: ${referralEndDateActionablAt}\n\n` +
        `🕐 *cutoffTime*: ${cutoffTime}s\n` +
        `────────────────────────\n\n` +
        `🔢 *Referral ID:* \`${referralId}\`\n` +
        `👤 *Name:* \`${patientName}\`\n` +
        `📱 *Mobile:* \`${mobileNumber || ""}\`\n` +
        `🌐 *Nationality:* \`${nationality || ""}\`\n` +
        `🆔 *National ID:* \`${nationalId}\`\n` +
        `🧑‍⚕️ *Gender:* \`${gender || ""}\`\n` +
        `❤️ *Marital Status:* \`${maritalStatus || ""}\`\n` +
        `📅 *Hijri DOB:* \`${hijriDOB || ""}\`\n` +
        `🏷️ *Referral Type:* \`${referralType}\`\n` +
        `🩺 *Specialty:* \`${specialty || ""}\`\n` +
        `🔬 *Sub-Specialty:* \`${subSpecialty || ""}\`\n` +
        `🏥 *Provider:* \`${sourceProvider || ""}\`\n` +
        `📍 *Zone:* \`${providerZone}\`\n` +
        `🗓️ *Requested At:* \`${requestDate}\`\n` +
        `📝 *Reason:* \`${referralCause}\`\n` +
        `🧾 *CauseNote:* \`${note || ""}\`\n\n` +
        `⚠️ *‼️ ATTENTION ‼️*\n\n` +
        `────────────────────────\n` +
        `🧾 _${caseAlertMessage || ""}_\n\n` +
        `📩 *Please review and reply to this message with:*\n\n` +
        `${createConfirmationMessage()}\n`;

      return {
        message,
        files,
      };
    };

    await sendWhatsappMessage(
      process.env.CLIENT_WHATSAPP_NUMBER,
      addedPatients.map(formatPatient)
    );

    try {
      const now = new Date();

      const saTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Riyadh" })
      );
      const hour = saTime.getHours();

      if (hour >= 22 || hour <= 9) {
        speakText("Please check your WhatsApp, there is a new patient");
      }
    } catch (error) {}
  };

export default processSendCollectedPatientsToWhatsapp;
