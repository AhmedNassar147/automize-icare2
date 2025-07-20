/*
 *
 * Helper: `processCollectReferralSummary`.
 *
 */
import ExcelJS from "exceljs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import collectHomePageTableRows from "./collectHomeTableRows.mjs";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import { HOME_PAGE_URL, PATIENT_SECTIONS_STATUS } from "./constants.mjs";
import closePageSafely from "./closePageSafely.mjs";
import sleep from "./sleep.mjs";

const excelColumns = [
  { header: "Referral Date", key: "Referral Date" },
  { header: "GMS Referral Id", key: "GMS Referral Id" },
  { header: "MOH Referral Nb", key: "MOH Referral Nb" },
  { header: "Patient Name", key: "Patient Name" },
  { header: "National ID", key: "National ID" },
  { header: "Referral Type", key: "Referral Type" },
  { header: "Source Zone", key: "Source Zone" },
  { header: "Assigned provider", key: "Assigned provider" },
];

const extractTableData = (rows) => {
  const headers = Array.from(document.querySelectorAll("thead th")).map((th) =>
    th.innerText.trim()
  );

  return rows.map((row) => {
    const cells = Array.from(row.querySelectorAll("td"));
    const rowData = {};
    for (let i = 0; i < headers.length && i < cells.length; i++) {
      if (headers[i]) {
        rowData[headers[i]] = cells[i].innerText.trim();
      }
    }
    return rowData;
  });
};

const getViewData = async (page, targetText) => {
  await searchForItemCountAndClickItIfFound(page, targetText, true);
  const rows = await collectHomePageTableRows(page);
  const data = await extractTableData(rows);

  return data;
};

const processCollectReferralSummary = async (browser, sendWhatsappMessage) => {
  const [page, _, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    sendWhatsappMessage,
    startingPageUrl: HOME_PAGE_URL,
  });

  if (!isLoggedIn) {
    return;
  }

  const { DISCHARGED, ADMITTED } = PATIENT_SECTIONS_STATUS;

  const admittedData = await getViewData(page, ADMITTED.targetText);
  const dischargedData = await getViewData(page, DISCHARGED.targetText);

  // Merge & deduplicate by "GMS Referral Id"
  const combined = [...admittedData, ...dischargedData];

  const unique = Array.from(
    new Map(combined.map((item) => [item["GMS Referral Id"], item])).values()
  ).sort((a, b) => {
    const dateA = new Date(a["Referral Date"]);
    const dateB = new Date(b["Referral Date"]);
    return dateA - dateB;
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("referral summary");
  sheet.columns = excelColumns;

  unique.forEach((row) => sheet.addRow(row));
  const buffer = await workbook.xlsx.writeBuffer();

  await sendWhatsappMessage(process.env.CLIENT_WHATSAPP_NUMBER, {
    files: [
      {
        filename: "referral-summary",
        fileBase64: buffer.toString("base64"),
        extension: "xlsx",
      },
    ],
  });

  await sleep(12_000);

  await closePageSafely(page);
};

export default processCollectReferralSummary;
