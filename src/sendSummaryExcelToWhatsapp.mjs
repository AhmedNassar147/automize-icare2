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
  detailedMonthlySummaryBookexcelColumns,
  SUMMARY_TYPES,
} from "./constants.mjs";

const columns = {
  [SUMMARY_TYPES.NORMAL]: excelColumns,
  [SUMMARY_TYPES.WEEKLY]: weeklySummaryexcelColumns,
  [SUMMARY_TYPES.MONTHLY]: monthlySummaryexcelColumns,
};

const secondarySheetColumns = {
  [SUMMARY_TYPES.MONTHLY]: monthlySummaryBookexcelColumns,
  [SUMMARY_TYPES.WEEKLY]: detailedMonthlySummaryBookexcelColumns,
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
  const isWeeklySummary = summaryType === SUMMARY_TYPES.WEEKLY;

  const shouldIncludeSecondarySheet = isMonthlySummary || isWeeklySummary;

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
          : "detailed-report"
    }-${fileTitle}`;

  const jsonData = JSON.stringify(preparedPatients, null, 2);

  await writeFile(
    `${generatedSummaryFolderPath}/${fullFileTitle}.json`,
    jsonData,
    "utf8",
  );

  const workbook = new ExcelJS.Workbook();
  let sheet = null;
  let secondarySummarySheet = null;

  try {
    sheet = workbook.addWorksheet(fileTitle);

    if (shouldIncludeSecondarySheet) {
      secondarySummarySheet = workbook.addWorksheet(
        isMonthlySummary ? "monthly-summary" : "detailed-summary",
      );
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

  if (shouldIncludeSecondarySheet && secondarySummarySheet) {
    const data = allPatients.reduce(
      (acc, patient) => {
        if (patient.isConfirmed === "yes") {
          acc.confirmed += 1;
        }

        if (patient.isAdmitted === "yes") {
          acc.admitted += 1;
        }

        if (patient.isRejected === "yes") {
          acc.rejected += 1;
        }

        if (patient.providerAction?.endsWith("no reply")) {
          acc.noReply += 1;
        }

        if (patient.providerAction?.endsWith("late reply")) {
          acc.lateReply += 1;
        }

        if (patient.payerAction?.endsWith("dropped")) {
          acc.dropped += 1;
        }

        return acc;
      },
      {
        admitted: 0,
        confirmed: 0,
        rejected: 0,
        noReply: 0,
        lateReply: 0,
        dropped: 0,
        total: allPatients.length,
      },
    );
    secondarySummarySheet.columns = secondarySheetColumns[summaryType];
    secondarySummarySheet.addRow(data);
    styleSheet(secondarySummarySheet);
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
