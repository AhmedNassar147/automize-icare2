/*
 *
 * Helper: `createAndSendInvoiceReport`.
 *
 */
import ExcelJS from "exceljs";
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import {
  allPatientsStatement,
  createPatientRowKey,
  insertPatients,
} from "./db.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import collectPatientsSummaryBasedHistory from "./collectPatientsSummaryBasedHistory.mjs";
import getMonthDateRange from "./getMonthDateRange.mjs";
import formatPatientsAndCreateExcelSheet, {
  buildSuccessfullReportMessage,
  formatSheetError,
  SHEET_TYPES,
} from "./formatPatientsAndCreateExcelSheet.mjs";
import getFormattedDateForSummary from "./getFormattedDateForSummary.mjs";
import { HOME_PAGE_URL } from "./constants.mjs";

const createAndSendInvoiceReport = async (
  browser,
  sendTelegramMessage,
  onlyForPresentation,
) => {
  let _page = null;
  try {
    const { newPage: page, isLoggedIn } = await makeUserLoggedInOrOpenHomePage({
      browser,
      startingPageUrl: HOME_PAGE_URL,
      noBundleCheck: true,
      noCursor: true,
    });
    _page = page;

    if (!isLoggedIn) {
      const message = formatSheetError({
        step: "createAndSendInvoiceReport (login user)",
        sheetType: SHEET_TYPES.INVOICE,
        title: "",
        error: "Unable to login user",
      });
      createConsoleMessage(message, "error");
      await sendTelegramMessage(message);
      return;
    }

    const firstSummaryReportStartsAt =
      process.env.FIRST_SUMMARY_REPORT_STARTS_AT;

    const currentDate = new Date();
    const currentDay = currentDate.getDate();
    const isInEntryNewMonth = currentDay <= 2;
    const useCurrentMonthForHistory = isInEntryNewMonth ? false : true;

    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1,
    );

    const todayPlusOne = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      currentDay + 1,
    );

    const summaryReportEndsAt = getFormattedDateForSummary(
      isInEntryNewMonth ? firstDayOfMonth : todayPlusOne,
    );

    const { patients: apisPatients, errors } = await getSummaryFromTabs({
      page,
      reportStartsAt: firstSummaryReportStartsAt,
      reportEndsAt: summaryReportEndsAt,
    });

    if (errors?.length) {
      const message = formatSheetError({
        step: "fetch tabs summary",
        sheetType: SHEET_TYPES.INVOICE,
        title: "",
        error: errors.join("\n"),
      });

      createConsoleMessage(message, "error");
      await sendTelegramMessage(message);
      return;
    }

    const allPatients = allPatientsStatement.all();

    const allPatientKeySet = new Set(allPatients.map((p) => p.rowKey));

    const invoiceNewPatients = apisPatients.filter((patient) => {
      const rowKey = createPatientRowKey(patient);
      return rowKey && !allPatientKeySet.has(rowKey);
    });

    const { start, end, summaryEnd, summaryStart } = getMonthDateRange(
      useCurrentMonthForHistory,
    );

    const { fullPatients: historyFullPatients, errors: historyErrors } =
      await collectPatientsSummaryBasedHistory({
        page,
        summaryEnd,
        summaryStart,
        dbEnd: end,
        dbStart: start,
        calledFrom: "createAndSendInvoiceReport",
      });

    if (historyErrors?.length) {
      const message = formatSheetError({
        step: "Collecting history referral summary",
        sheetType: SHEET_TYPES.INVOICE,
        title: "",
        error: historyErrors.join("\n"),
      });

      createConsoleMessage(message, "error");
      await sendTelegramMessage(message);
      return;
    }

    const workbook = new ExcelJS.Workbook();

    const { success, message, title, minDate, maxDate } =
      await formatPatientsAndCreateExcelSheet(
        invoiceNewPatients,
        workbook,
        SHEET_TYPES.INVOICE,
      );

    if (!success) {
      await sendTelegramMessage(message);
      return;
    }

    const { success: hasDetailsCreated, message: detailsMessage } =
      await formatPatientsAndCreateExcelSheet(
        historyFullPatients,
        workbook,
        SHEET_TYPES.FULL_DETAILS,
      );

    if (!hasDetailsCreated) {
      await sendTelegramMessage(detailsMessage);
      return;
    }

    const buffer = await workbook.xlsx.writeBuffer();

    if (!onlyForPresentation) {
      insertPatients(invoiceNewPatients);
    }

    const tlgMessage = buildSuccessfullReportMessage(
      SHEET_TYPES.INVOICE,
      minDate,
      maxDate,
      invoiceNewPatients.length,
      title,
    );

    const files = [
      {
        fileName: title,
        fileBase64: buffer.toString("base64"),
        extension: "xlsx",
      },
    ];

    await sendTelegramMessage(tlgMessage, files);
    createConsoleMessage(tlgMessage, "info");
    return;
  } catch (error) {
    const message = formatSheetError({
      step: "catch createAndSendInvoiceReport",
      sheetType: SHEET_TYPES.INVOICE,
      title: "",
      error: error.message || error,
    });
    createConsoleMessage(message, "error");
    await sendTelegramMessage(message);
  } finally {
    if (_page) {
      await closePageSafely(_page);
    }
  }
};

export default createAndSendInvoiceReport;
