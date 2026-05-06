/*
 *
 * Helper: `processSendCollectedPatientsToWhatsapp`.
 *
 */
import speakText from "./speakText.mjs";
import createConfirmationMessage from "./createConfirmationMessage.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import sendNtfyMessage from "./sendNtfyMessage.mjs";

const processSendCollectedPatientsToWhatsapp =
  (sendWhatsappMessage, execludeWhatsAppMsgFooter) => async (addedPatients) => {
    const formatPatient = ({
      referralId,
      patientName,
      mobileNumber,
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
      cutoffTimeMs,
      referralEndDate,
      // requestDate,
    }) => {
      let label = `0 s`;

      if (cutoffTimeMs) {
        const nf = new Intl.NumberFormat(undefined, {
          minimumFractionDigits: 3,
          maximumFractionDigits: 3,
        });

        label = `${nf.format(cutoffTimeMs / 1000)} s`; // e.g., "6.125 s"
      }

      let message =
        `🚨 *New Case Alert!* 🚨\n\n` +
        `🕐 *Actionable At*: ${referralEndDateActionablAt}\n` +
        `🕐 *cutoffTime*: ${label}\n` +
        `🕐 *Ends At*: ${referralEndDate}\n` +
        // `🔔 *billCount*: ${notificationCount}\n` +
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
        // `🗓️ *Requested At:* \`${requestDate}\`\n` +
        `📝 *Reason:* \`${referralCause}\`\n` +
        `🧾 *CauseNote:* \`${note || ""}\`\n`;

      if (!execludeWhatsAppMsgFooter) {
        message +=
          `\n` +
          `⚠️ *‼️ ATTENTION ‼️*\n\n` +
          `────────────────────────\n` +
          `🧾 _${caseAlertMessage || ""}_\n\n` +
          `📩 *Please review and reply to this message with:*\n\n` +
          `${createConfirmationMessage()}\n`;
      }

      return {
        message,
        files,
      };
    };

    const { BRANCH_NAME, CLIENT_WHATSAPP_NUMBER, CLIENT_ID } = process.env;

    await sendWhatsappMessage(
      CLIENT_WHATSAPP_NUMBER,
      addedPatients.map(formatPatient),
    );

    try {
      speakText({
        text: "Check your WhatsApp, there is a new patient",
      });

      const [{ referralId, referralEndDate }] = addedPatients;

      const message =
        "At " +
        (BRANCH_NAME || CLIENT_ID) +
        " NEW PAtient " +
        referralId +
        " Ends At " +
        referralEndDate;

      await sendNtfyMessage(message);
    } catch (error) {
      createConsoleMessage(error, "error", "SOUND error");
    }
  };

export default processSendCollectedPatientsToWhatsapp;
