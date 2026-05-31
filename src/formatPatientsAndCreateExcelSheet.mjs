/*
 *
 * Helper: `formatPatientsAndCreateExcelSheet`.
 *
 */
import { writeFile } from "fs/promises";
import createConsoleMessage from "./createConsoleMessage.mjs";
import {
  generatedSummaryFolderPath,
  excelColumns,
  detailedMonthlySummaryBookexcelColumns,
  weeklySummaryexcelColumns,
} from "./constants.mjs";

export const SHEET_TYPES = {
  INVOICE: "Invoice",
  FULL_DETAILS: "Details",
  WEEKLY_FULL_DETAILS: "Weekly",
  ONE_ROW_SUMMARY: "Summary",
};

const sheetTypeToColumns = {
  [SHEET_TYPES.INVOICE]: excelColumns,
  [SHEET_TYPES.FULL_DETAILS]: weeklySummaryexcelColumns,
  [SHEET_TYPES.WEEKLY_FULL_DETAILS]: weeklySummaryexcelColumns,
  [SHEET_TYPES.ONE_ROW_SUMMARY]: detailedMonthlySummaryBookexcelColumns,
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

export const formatSheetError = ({ step, sheetType, title, error }) => {
  const reason = error?.message || error || "Unknown error";

  return [
    `🚨 *Excel Sheet Creation Failed*`,
    ``,
    `📍 *Step:* \`${step}\``,
    `📄 *Sheet Type:* \`${sheetType || "unknown"}\``,
    title ? `🏷️ *Title:* \`${title}\`` : null,
    ``,
    `❌ *Reason:*`,
    `\`${reason}\``,
  ]
    .filter(Boolean)
    .join("\n");
};

const addSheet = (workbook, fullFileTitle, type) => {
  let sheet = null;
  try {
    sheet = workbook.addWorksheet(fullFileTitle);
  } catch (error) {
    createConsoleMessage(
      error,
      "error",
      `ERROR workbook.addWorksheet type=${type} fileTitle=${fullFileTitle}`,
    );
  }

  if (!sheet) {
    const message = formatSheetError({
      step: "add worksheet",
      sheetType: type,
      title: fullFileTitle,
      error: "Unable to add worksheet",
    });
    createConsoleMessage(message, "error");
    return {
      success: false,
      message,
    };
  }

  return {
    success: true,
    sheet,
  };
};

const createSheetTitle = (minDate, maxDate, headerTitle) => {
  const { CLIENT_ID, BRANCH_NAME } = process.env;

  const customer = BRANCH_NAME || CLIENT_ID;
  const fileTitle = `from-${minDate}-to-${maxDate}`;
  const fullFileTitle = [customer, headerTitle, fileTitle].join("-");

  return fullFileTitle;
};

export const buildSuccessfullReportMessage = ({
  reportType,
  start,
  end,
  newPatientsLength,
  title,
  notes,
}) => {
  const tlgMessage = [
    `📊 *${reportType} Report Generated Successfully*`,
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `📄 *Report Type:* \`${reportType}\``,
    `📅 *Period:* \`${start} → ${end}\``,
    `👥 *New Patients:* \`${newPatientsLength}\``,
    notes ? [``, `🔍 *Notes:*`, notes].join("\n") : "",
    ``,
    `━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `✅ Excel workbook created successfully`,
    `📎 *File:* \`${title}.xlsx\``,
  ].join("\n");

  return tlgMessage;
};

const formatPatientsAndCreateExcelSheet = async (
  allPatients,
  workbook,
  sheetType,
) => {
  if (!allPatients?.length) {
    const message = formatSheetError({
      step: "checking patients length",
      sheetType: sheetType,
      title: "",
      error: "ℹ️ No new invoice patients found for this period",
    });
    createConsoleMessage(message, "info");
    return {
      success: false,
      message,
    };
  }

  const preparedPatients = [...allPatients]
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

  const title = createSheetTitle(minDate, maxDate, sheetType);

  const jsonData = JSON.stringify(preparedPatients, null, 2);

  await writeFile(
    `${generatedSummaryFolderPath}/${title}.json`,
    jsonData,
    "utf8",
  );

  const {
    success: isSheetAdded,
    message,
    sheet,
  } = addSheet(workbook, title, sheetType);

  if (!isSheetAdded) {
    return {
      success: false,
      message,
      title,
      minDate,
      maxDate,
    };
  }

  sheet.columns = sheetTypeToColumns[sheetType];
  preparedPatients.forEach((row) => sheet.addRow(row));
  styleSheet(sheet);

  const isFullDetailsSheet = [
    SHEET_TYPES.FULL_DETAILS,
    SHEET_TYPES.WEEKLY_FULL_DETAILS,
  ].includes(sheetType);

  if (!isFullDetailsSheet) {
    return {
      success: true,
      sheets: [sheet],
      title,
      minDate,
      maxDate,
    };
  }

  const oneRowType = SHEET_TYPES.ONE_ROW_SUMMARY;

  const oneRowDetailedSummaryTitle = createSheetTitle(
    minDate,
    maxDate,
    oneRowType,
  );

  const {
    success: isAdded,
    message: errorMessage,
    sheet: oneRowSummarySheet,
  } = addSheet(workbook, oneRowDetailedSummaryTitle, oneRowType);

  if (!isAdded) {
    return {
      success: false,
      message: errorMessage,
      title: oneRowDetailedSummaryTitle,
      minDate,
      maxDate,
    };
  }

  const rowData = allPatients.reduce(
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

  oneRowSummarySheet.columns = sheetTypeToColumns[oneRowType];
  oneRowSummarySheet.addRow(rowData);
  styleSheet(oneRowSummarySheet);

  return {
    success: true,
    sheets: [sheet, oneRowSummarySheet],
    title: oneRowDetailedSummaryTitle,
    minDate,
    maxDate,
  };
};

export default formatPatientsAndCreateExcelSheet;
