/*
 *
 * Helper: `sendSummaryExcelToWhatsapp`.
 *
 */
import ExcelJS from "exceljs";
import { writeFile } from "fs/promises";
import createConsoleMessage from "./createConsoleMessage.mjs";
import {
  generatedSummaryFolderPath,
  excelColumns,
  weeklySummaryexcelColumns,
  monthlySummaryexcelColumns,
  monthlySummaryBookexcelColumns,
  SUMMARY_TYPES,
} from "./constants.mjs";

const columns = {
  [SUMMARY_TYPES.NORMAL]: excelColumns,
  [SUMMARY_TYPES.WEEKLY]: weeklySummaryexcelColumns,
  [SUMMARY_TYPES.MONTHLY]: monthlySummaryexcelColumns,
};

const styleSheet = (sheet) => {
  sheet.getRow(1).eachCell((cell) => {
    cell.font = {
      name: "Arial",
      size: 14,
      bold: true,
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle", // optional, to center vertically too
    };
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 11,
        bold: false,
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle", // optional, to center vertically too
      };
    });
  });
};

const sendSummaryExcelToWhatsapp = async (
  sendWhatsappMessage,
  allPatients,
  summaryType = SUMMARY_TYPES.NORMAL,
) => {
  const isNormalSummary = summaryType === SUMMARY_TYPES.NORMAL;
  const isMonthlySummary = summaryType === SUMMARY_TYPES.MONTHLY;

  if (!allPatients?.length) {
    createConsoleMessage("There is no new patients for past week", "info");
    return false;
  }

  const { CLIENT_ID, CLIENT_WHATSAPP_NUMBER, BRANCH_NAME } = process.env;

  const preparedPatients = allPatients
    .sort((a, b) => {
      const dateA = new Date(a["referralDate"]);
      const dateB = new Date(b["referralDate"]);
      return dateB - dateA;
    })
    .map((item, index) => ({
      order: index + 1,
      ...item,
    }));

  const dates = preparedPatients.map(
    ({ referralDate }) => new Date(referralDate),
  );

  const [minDate, maxDate] = [
    new Date(Math.min(...dates)),
    new Date(Math.max(...dates)),
  ].map((date) => {
    const [splitedDate] = date.toISOString().split("T");
    return splitedDate.split("-").reverse().join("_");
  });

  const fileTitle = `from-${minDate}-to-${maxDate}`;

  const fullFileTitle =
    [CLIENT_ID, BRANCH_NAME].filter(Boolean).join("-") +
    `-${
      isNormalSummary
        ? "admitted"
        : isMonthlySummary
          ? "monthly-report"
          : "weekly-report"
    }-${fileTitle}`;

  const jsonData = JSON.stringify(preparedPatients, null, 2);

  await writeFile(
    `${generatedSummaryFolderPath}/${fullFileTitle}.json`,
    jsonData,
    "utf8",
  );

  const workbook = new ExcelJS.Workbook();
  let sheet = null;
  let monthlySummarySheet = null;

  try {
    sheet = workbook.addWorksheet(fileTitle);

    if (isMonthlySummary) {
      monthlySummarySheet = workbook.addWorksheet("monthly-summary");
    }
  } catch (error) {
    createConsoleMessage(
      error,
      "error",
      `ERROR workbook.addWorksheet fullFileTitle=${fullFileTitle}`,
    );
  }

  if (!sheet) {
    createConsoleMessage("NO SHEEET", "error");
    return false;
  }

  sheet.columns = columns[summaryType];
  preparedPatients.forEach((row) => sheet.addRow(row));
  styleSheet(sheet);

  if (isMonthlySummary && monthlySummarySheet) {
    const data = allPatients.reduce(
      (acc, patient) => {
        if (patient.isConfirmed === "yes") {
          acc.confirmed += 1;
        }

        if (patient.isAdmitted === "yes") {
          acc.admitted += 1;
        }
        return acc;
      },
      {
        admitted: 0,
        confirmed: 0,
      },
    );
    monthlySummarySheet.columns = monthlySummaryBookexcelColumns;
    monthlySummarySheet.addRow(data);
    styleSheet(monthlySummarySheet);
  }

  const buffer = await workbook.xlsx.writeBuffer();

  await sendWhatsappMessage(CLIENT_WHATSAPP_NUMBER, {
    files: [
      {
        fileName: fullFileTitle,
        fileBase64: buffer.toString("base64"),
        extension: "xlsx",
      },
    ],
  });

  return true;
};

export default sendSummaryExcelToWhatsapp;
