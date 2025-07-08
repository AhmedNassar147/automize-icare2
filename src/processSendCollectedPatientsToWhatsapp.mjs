/*
 *
 * Helper: `processSendCollectedPatientsToWhatsapp`.
 *
 */
import createConfirmationMessage from "./createConfirmationMessage.mjs";

const processSendCollectedPatientsToWhatsapp =
  (sendWhatsappMessage) => async (addedPatients) => {
    console.log("addedPatients started, posting patients to WhatsApp...");

    // Format the message
    const formatPatient = (
      {
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
        caseStartedAt,
        caseStartedAtMessage,
        icds,
        cpts,
      },
      i
    ) => {
      const message =
        `🚨 *New Case Alert!* 🚨\n` +
        `⏰ *Started At:* \`${caseStartedAt}\`\n` +
        `─────────────────────────────\n` +
        `👤 *Name:* ${patientName}\n` +
        `📱 *Mobile:* ${mobileNumber}\n` +
        `🌐 *Nationality:* ${nationality || ""}\n` +
        `🆔 *National ID:* ${nationalId}\n` +
        `🔢 *Referral ID:* ${referralId}\n` +
        `🏷️ *Referral Type:* ${referralType}\n` +
        `🩺 *Specialty:* ${specialty || ""}\n` +
        `🔬 *Sub-Specialty:* ${subSpecialty || ""}\n` +
        `🏥 *Provider:* ${sourceProvider || ""}\n` +
        `📍 *Zone:* ${providerZone}\n` +
        `🗓️ *Requested At:* ${requestDate}\n` +
        `📝 *Reason:* ${referralCause}\n` +
        `🧾 *ICDs:*\n${icds.join("\n") || ""}\n` +
        `💉 *CPTs:*\n${cpts.join("\n") || ""}\n` +
        `─────────────────────────────\n` +
        `⚠️ *‼️ ATTENTION ‼️*\n` +
        `*${caseStartedAtMessage}*\n` +
        `📩 *Please review and reply to this message with:*\n` +
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
