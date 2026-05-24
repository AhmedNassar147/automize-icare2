/*
 *
 * Helper: `processSendCollectedPatientsToWhatsapp`.
 *
 */
import createConfirmationMessage from "./createConfirmationMessage.mjs";
import notifyUserWithNewCase from "./notifyUserWithNewCase.mjs";

const processSendCollectedPatientsToWhatsapp =
  (sendTelegramMessage, sendWhatsappMessage, skipNotify = false) =>
  async (addedPatients) => {
    const {
      BRANCH_NAME,
      CLIENT_WHATSAPP_NUMBER,
      CLIENT_ID,
      EXECLUDE_WHATSAPP_MSG_FOOTER,
    } = process.env;

    const execludeWhatsAppMsgFooter = EXECLUDE_WHATSAPP_MSG_FOOTER === "Y";

    const formatPatient =
      (forTelegram) =>
      ({
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

        let message = undefined;

        if (forTelegram) {
          message =
            `🚨 <b>New Case Alert!</b> 🚨\n\n` +
            `🕐 <b>Actionable At:</b> ${referralEndDateActionablAt}\n` +
            `🕐 <b>cutoffTime:</b> ${label}\n` +
            `🕐 <b>Ends At:</b> ${referralEndDate}\n` +
            `────────────────────────\n\n` +
            `🔢 <b>Referral ID:</b> <code>${referralId}</code>\n` +
            `👤 <b>Name:</b> <code>${patientName}</code>\n` +
            `📱 <b>Mobile:</b> <code>${mobileNumber || ""}</code>\n` +
            `🌐 <b>Nationality:</b> <code>${nationality || ""}</code>\n` +
            `🆔 <b>National ID:</b> <code>${nationalId}</code>\n` +
            `🧑‍⚕️ <b>Gender:</b> <code>${gender || ""}</code>\n` +
            `❤️ <b>Marital Status:</b> <code>${maritalStatus || ""}</code>\n` +
            `📅 <b>Hijri DOB:</b> <code>${hijriDOB || ""}</code>\n` +
            `🏷️ <b>Referral Type:</b> <code>${referralType}</code>\n` +
            `🩺 <b>Specialty:</b> <code>${specialty || ""}</code>\n` +
            `🔬 <b>Sub-Specialty:</b> <code>${subSpecialty || ""}</code>\n` +
            `🏥 <b>Provider:</b> <code>${sourceProvider || ""}</code>\n` +
            `📍 <b>Zone:</b> <code>${providerZone}</code>\n` +
            `📝 <b>Reason:</b> <code>${referralCause}</code>\n` +
            `🧾 <b>CauseNote:</b> <code>${note || ""}</code>\n`;
        } else {
          message =
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
        }

        return {
          message,
          files,
          referralId,
        };
      };

    const formatted_WA_Messages = sendWhatsappMessage
      ? addedPatients.filter(Boolean).map(formatPatient(false))
      : [];

    const telegramApis = addedPatients
      .filter(Boolean)
      .map(formatPatient(true))

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

export default processSendCollectedPatientsToWhatsapp;
