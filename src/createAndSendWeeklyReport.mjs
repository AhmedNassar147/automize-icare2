/*
 *
 * Helper: `createAndSendWeeklyReport`.
 *
 *
 */
import ExcelJS from "exceljs";
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import getLastThursdayToWednesdayRange from "./getLastThursdayToWednesdayRange.mjs";
import collectPatientsSummaryBasedHistory from "./collectPatientsSummaryBasedHistory.mjs";
import formatPatientsAndCreateExcelSheet, {
  buildSuccessfullReportMessage,
  formatSheetError,
  SHEET_TYPES,
} from "./formatPatientsAndCreateExcelSheet.mjs";
import { HOME_PAGE_URL } from "./constants.mjs";

const createAndSendWeeklyReport = async (browser, sendTelegramMessage) => {
  let _page = null;

  try {
    const { newPage: page, isLoggedIn } = await makeUserLoggedInOrOpenHomePage({
      browser,
      startingPageUrl: HOME_PAGE_URL,
    });

    _page = page;

    if (!isLoggedIn) {
      const message = formatSheetError({
        step: "createAndSendWeeklyReport (login user)",
        sheetType: SHEET_TYPES.WEEKLY_FULL_DETAILS,
        title: "",
        error: "Unable to login user",
      });
      createConsoleMessage(message, "error");
      await sendTelegramMessage(message);
      return;
    }

    const { start, end, summaryEnd, summaryStart } =
      getLastThursdayToWednesdayRange(new Date());

    const { errors, fullPatients, newPatients } =
      await collectPatientsSummaryBasedHistory({
        page,
        summaryStart,
        summaryEnd,
        dbStart: start,
        dbEnd: end,
        calledFrom: "createAndSendWeeklyReport",
      });

    if (errors?.length) {
      const message = formatSheetError({
        step: "fetch tabs summary",
        sheetType: SHEET_TYPES.WEEKLY_FULL_DETAILS,
        title: "",
        error: errors.join("\n"),
      });

      createConsoleMessage(message, "error");
      await sendTelegramMessage(message);
      return;
    }

    const workbook = new ExcelJS.Workbook();

    const { success, message, minDate, maxDate, title } =
      await formatPatientsAndCreateExcelSheet(
        fullPatients,
        workbook,
        SHEET_TYPES.WEEKLY_FULL_DETAILS,
      );

    if (!success) {
      await sendTelegramMessage(message);
      return;
    }

    const buffer = await workbook.xlsx.writeBuffer();

    const files = [
      {
        fileName: title,
        fileBase64: buffer.toString("base64"),
        extension: "xlsx",
      },
    ];

    const tlgMessage = buildSuccessfullReportMessage(
      SHEET_TYPES.WEEKLY_FULL_DETAILS,
      minDate,
      maxDate,
      newPatients.length,
      title,
    );

    await sendTelegramMessage(tlgMessage, files);
    createConsoleMessage(tlgMessage, "info");
    return;
  } catch (error) {
    const message = formatSheetError({
      step: "catch createAndSendWeeklyReport",
      sheetType: SHEET_TYPES.WEEKLY_FULL_DETAILS,
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

export default createAndSendWeeklyReport;
