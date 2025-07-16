/*
 *
 * Helper: `processSendCollectedPatientsToWhatsapp`.
 *
 */
import createConfirmationMessage from "./createConfirmationMessage.mjs";
import { estimatedTimeForProcessingAction } from "./constants.mjs";

const cutoffTime = estimatedTimeForProcessingAction / 1000;

const processSendCollectedPatientsToWhatsapp =
  (sendWhatsappMessage) => async (addedPatients) => {
    console.log("addedPatients started, posting patients to WhatsApp...");

    const formatPatient = ({
      patientName,
      requestDate,
      mobileNumber,
      referralId,
      nationality,
      nationalId,
      refType: referralType,
      specialty,
      subSpecialty,
      sourceProvider,
      providerZone,
      files,
      referralCause,
      caseReceivedAt,
      caseActualWillBeSubmittedAt,
      caseAlertMessage,
      caseUserAlertMessage,
      caseUserWillBeSubmittedAt,
      icds,
      referralCauseDetails,
    }) => {
      const { note } = referralCauseDetails || {};

      const message =
        `🚨 *New Case Alert!* 🚨\n\n` +
        `📥 *Received At:* 🟦 \`${caseReceivedAt}\`\n` +
        `📤 *Manual action:* 🟥 \`${caseActualWillBeSubmittedAt}\`\n` +
        `⏳ *Cutoff Time:* 🟧 \`${cutoffTime} seconds\`\n` +
        `🕐 *actionable At:* 🟨 \`${caseUserWillBeSubmittedAt}\`\n\n` +
        `────────────────────────\n\n` +
        `🔢 *Referral ID:* \`${referralId}\`\n` +
        `👤 *Name:* \`${patientName}\`\n` +
        `📱 *Mobile:* \`${mobileNumber || ""}\`\n` +
        `🌐 *Nationality:* \`${nationality || ""}\`\n` +
        `🆔 *National ID:* \`${nationalId}\`\n` +
        `🏷️ *Referral Type:* \`${referralType}\`\n` +
        `🩺 *Specialty:* \`${specialty || ""}\`\n` +
        `🔬 *Sub-Specialty:* \`${subSpecialty || ""}\`\n` +
        `🏥 *Provider:* \`${sourceProvider || ""}\`\n` +
        `📍 *Zone:* \`${providerZone}\`\n` +
        `🗓️ *Requested At:* \`${requestDate}\`\n` +
        `📝 *Reason:* \`${referralCause}\`\n` +
        `🧾 *CauseNote:*\`${note || ""}\`\n` +
        `🧾 *ICDs:*\`${(icds || []).join("\n") || ""}\`\n\n` +
        `⚠️ *‼️ ATTENTION ‼️*\n\n` +
        `────────────────────────\n` +
        `🧾 *Original Alert:* _${caseAlertMessage || ""}_\n\n` +
        `💬 *User Alert:* _${caseUserAlertMessage}_\n\n` +
        `📩 *Please review and reply to this message with:*\n\n` +
        `${createConfirmationMessage()}`;

      return {
        message,
        files,
      };
    };

    await sendWhatsappMessage(
      process.env.CLIENT_WHATSAPP_NUMBER,
      addedPatients.map(formatPatient)
    );
  };

export default processSendCollectedPatientsToWhatsapp;
