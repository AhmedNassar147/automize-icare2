/*
 *
 * Helper: `processCollectReferralSummary`.
 *
 */
import ExcelJS from "exceljs";
import { writeFile } from "fs/promises";
import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
import closePageSafely from "./closePageSafely.mjs";
import sleep from "./sleep.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import {
  PATIENT_SECTIONS_STATUS,
  waitingPatientsFolderDirectory,
  HOME_PAGE_URL,
} from "./constants.mjs";

const excelColumns = [
  { header: "order", key: "order", width: 20 },
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
  await searchForItemCountAndClickItIfFound(page, targetText, true);
  await sleep(2000);

  const data = await page.evaluate(() => {
    const headers = Array.from(document.querySelectorAll("thead th")).map(
      (th) => th.innerText.trim()
    );

    const rowElements = Array.from(document.querySelectorAll("tbody tr"));

    return rowElements
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        const rowData = {};

        const hasData = cells.some(
          (td) => td.innerText && td.innerText.trim() !== ""
        );
        if (!hasData) return null;

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

const parseDate = (str) => {
  const date = new Date(str);
  return isNaN(date) ? null : date;
};

const getWeeklyRange = () => {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

  // Get last Tuesday
  const lastTuesday = new Date(today);
  const daysSinceTuesday = day >= 2 ? day - 2 : 7 - (2 - day); // 2 = Tuesday
  lastTuesday.setDate(today.getDate() - daysSinceTuesday);
  lastTuesday.setHours(0, 0, 0, 0);

  // This week's Monday (after that Tuesday)
  const thisMonday = new Date(lastTuesday);
  thisMonday.setDate(lastTuesday.getDate() + 6);
  thisMonday.setHours(23, 59, 59, 999);

  return { lastTuesday, thisMonday };
};

const filterReferralData = async ({
  page,
  targetText,
  startingReferralDate,
  weekly,
}) => {
  const data = await getViewData(page, targetText);

  const { lastTuesday, thisMonday } = getWeeklyRange();
  const startDate = startingReferralDate
    ? new Date(startingReferralDate)
    : null;

  return data.filter((item) => {
    const referralDate = parseDate(item["Referral Date"]);
    if (!referralDate) return false;

    const afterStart = startDate ? referralDate >= startDate : true;
    const inWeeklyRange = weekly
      ? referralDate >= lastTuesday && referralDate <= thisMonday
      : true;

    return afterStart && inWeeklyRange;
  });
};

// const startingReferralDate = "2025-07-18T21:47:30";
const startingReferralDate = "2025-07-20T00:24:31";
const weekly = false; // Set to true if you want to filter by the last week

const processCollectReferralSummary = async (browser, sendWhatsappMessage) => {
  const [page, _, isLoggedIn] = await makeUserLoggedInOrOpenHomePage({
    browser,
    sendWhatsappMessage,
    startingPageUrl: HOME_PAGE_URL,
  });

  if (!isLoggedIn) {
    console.log("User is not logged in, cannot collect referral summary.");
    return;
  }

  const { ADMITTED, DISCHARGED } = PATIENT_SECTIONS_STATUS;

  const admittedPatients = filterReferralData({
    page,
    targetText: ADMITTED.targetText,
    startingReferralDate,
    weekly,
  });

  const dischargedPatients = filterReferralData({
    page,
    targetText: DISCHARGED.targetText,
    startingReferralDate,
    weekly,
  });

  const unique = Array.from(
    new Map(
      [...admittedPatients, ...dischargedPatients].map((item) => [
        item["GMS Referral Id"],
        item,
      ])
    ).values()
  )
    .sort((a, b) => {
      const dateA = new Date(a["Referral Date"]);
      const dateB = new Date(b["Referral Date"]);
      return dateB - dateA;
    })
    .map((item, index) => ({
      order: index + 1,
      ...item,
    }));

  const jsonData = JSON.stringify(unique, null, 2);

  await writeFile(
    `${waitingPatientsFolderDirectory}/referrals.json`,
    jsonData,
    "utf8"
  );

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
        size: 13,
        bold: false,
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

  // await sleep(12_000);
  await closePageSafely(page);
};

export default processCollectReferralSummary;
