/*
 *
 * Helper: `processCollectReferralSummary`.
 *
 */
import ExcelJS from "exceljs";
import { readFile } from "fs/promises";
import { join } from "path";
// import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
// import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import {
  // HOME_PAGE_URL,
  PATIENT_SECTIONS_STATUS,
  htmlFilesPath,
} from "./constants.mjs";
import closePageSafely from "./closePageSafely.mjs";
import sleep from "./sleep.mjs";

const excelColumns = [
  { header: "Referral Date", key: "Referral Date", width: 33 },
  { header: "GMS Referral Id", key: "GMS Referral Id", width: 27 },
  { header: "MOH Referral Nb", key: "MOH Referral Nb", width: 27 },
  { header: "Patient Name", key: "Patient Name", width: 40 },
  { header: "National ID", key: "National ID", width: 28 },
  { header: "Referral Type", key: "Referral Type", width: 28 },
  { header: "Referral Reason", key: "Referral Reason", width: 30 },
  { header: "Source Zone", key: "Source Zone", width: 30 },
  { header: "Assigned Provider", key: "Assigned Provider", width: 40 },
];

const getViewData = async (page, targetText) => {
  // await searchForItemCountAndClickItIfFound(page, targetText, true);
  // await sleep(1000);

  const data = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll("thead th")).map(
      (th) => th.innerText.trim()
    );

    const rowElements = Array.from(document.querySelectorAll("tbody tr"));

    return rowElements
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        const rowData = {};

        // Check if the row has at least one non-empty cell
        const hasData = cells.some(
          (td) => td.innerText && td.innerText.trim() !== ""
        );

        if (!hasData) return null; // skip this row

        for (let i = 0; i < headers.length && i < cells.length; i++) {
          if (headers[i]) {
            rowData[headers[i]] = cells[i].innerText.trim();
          }
        }
        return rowData;
      })
      .filter(Boolean);
  });

  return data;
};

const processCollectReferralSummary = async (browser, sendWhatsappMessage) => {
  // const [page, _, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
  //   browser,
  //   sendWhatsappMessage,
  //   startingPageUrl: HOME_PAGE_URL,
  // });

  // if (!isLoggedIn) {
  //   return;
  // }

  const html = await readFile(join(htmlFilesPath, "summary.html"), "utf8");

  const page = await browser.newPage();

  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const { DISCHARGED, ADMITTED } = PATIENT_SECTIONS_STATUS;

  const admittedData = await getViewData(page, ADMITTED.targetText);
  // const dischargedData = await getViewData(page, DISCHARGED.targetText);

  // Merge & deduplicate by "GMS Referral Id"
  // const combined = [...admittedData, ...dischargedData];
  const combined = [...admittedData];

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

  sheet.getRow(1).eachCell((cell) => {
    cell.font = {
      name: "Arial",
      size: 14,
      bold: true,
    };
  });

  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 13, // 👈 fontSize
        bold: false, // 👈 fontWeight: bold = true
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  await sendWhatsappMessage(process.env.CLIENT_WHATSAPP_NUMBER, {
    files: [
      {
        fileName: "referral-summary",
        fileBase64: buffer.toString("base64"),
        extension: "xlsx",
      },
    ],
  });

  await sleep(12_000);

  await closePageSafely(page);
};

export default processCollectReferralSummary;
