/*
 *
 * Helper: `sendRefferalsToWhatsAppAsExcel`.
 *
 */
import { SUMMARY_TYPES } from "./constants.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import readJsonFile from "./readJsonFile.mjs";
import sendSummaryExcelToWhatsapp from "./sendSummaryExcelToWhatsapp.mjs";

const sendRefferalsToWhatsAppAsExcel = async (
  sendWhatsappMessage,
  filePath,
) => {
  const fileData = readJsonFile(filePath, true);

  const isSent = await sendSummaryExcelToWhatsapp(
    sendWhatsappMessage,
    fileData,
    SUMMARY_TYPES.NORMAL,
  );

  if (isSent) {
    createConsoleMessage(`patients length is ${fileData.length}`);
  }
};

export default sendRefferalsToWhatsAppAsExcel;
