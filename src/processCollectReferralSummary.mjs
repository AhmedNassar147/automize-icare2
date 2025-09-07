/*
 *
 * Helper: `processCollectReferralSummary`.
 *
 */
import ExcelJS from "exceljs";
import { writeFile } from "fs/promises";
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import {
  allPatientsStatement,
  createPatientRowKey,
  insertPatients,
} from "./db.mjs";
import {
  HOME_PAGE_URL,
  generatedSummaryFolderPath,
  globMedHeaders,
  baseGlobMedAPiUrl,
} from "./constants.mjs";

const excelColumns = [
  { header: "order", key: "order", width: 12 },
  { header: "Referral Date", key: "referralDate", width: 24 },
  { header: "GMS Referral Id", key: "idReferral", width: 20 },
  { header: "MOH Referral Nb", key: "ihalatyReference", width: 20 },
  { header: "Patient Name", key: "adherentName", width: 37 },
  { header: "National ID", key: "adherentNationalId", width: 20 },
  { header: "Referral Type", key: "referralType", width: 20 },
  { header: "Referral Reason", key: "referralReason", width: 28 },
  { header: "Source Zone", key: "sourceZone", width: 15 },
  { header: "Assigned Provider", key: "assignedProvider", width: 52 },
];

const globMedBodyData = {
  pageSize: 50_000,
  pageNumber: 1,
  providerZone: [],
  providerName: [],
  specialtyCode: [],
  referralTypeCode: [],
  referralReasonCode: [],
  genericSearch: "",
  // startDate: "2025-08-01",
  // endDate: "2025-08-30",
  sortOrder: "asc",
};

const categoryReferences = ["admitted", "discharged"];

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

  const tabsResults = await page.evaluate(
    async ({
      baseGlobMedAPiUrl,
      globMedHeaders,
      categoryReferences,
      globMedBodyData,
    }) => {
      const responses = await Promise.allSettled(
        categoryReferences.map(async (categoryReference) => {
          try {
            const res = await fetch(`${baseGlobMedAPiUrl}/listing`, {
              method: "POST",
              headers: globMedHeaders,
              body: JSON.stringify({
                ...globMedBodyData,
                categoryReference,
              }),
            });

            if (!res.ok) {
              return {
                success: false,
                error: `Status ${res.status}`,
                categoryReference,
              };
            }

            const data = await res.json();

            const { data: response, errorMessage } = data;
            const { result } = response || {};

            return {
              categoryReference,
              success: true,
              data: result || [],
              error: errorMessage,
            };
          } catch (err) {
            return {
              success: false,
              error: `Capture error: ${err.message}`,
              categoryReference,
            };
          }
        })
      );

      return responses.reduce(
        (acc, result) => {
          const { categoryReference, data, error } = result.value || {};
          if (error || !data?.length) {
            acc.errors.push(
              `❌ ${categoryReference} request error: ${error || "NOT DATA"}`
            );
          } else {
            acc.patients.push(
              ...data.map((patient) => ({
                ...patient,
                tabName: categoryReference,
                paid: 0,
              }))
            );
          }

          return acc;
        },
        {
          patients: [],
          errors: [],
        }
      );
    },
    {
      categoryReferences,
      globMedHeaders,
      baseGlobMedAPiUrl,
      globMedBodyData,
    }
  );

  const { patients: apisPatients, errors } = tabsResults;

  if (errors.length) {
    errors.forEach((error) => console.error(error));
    await closePageSafely(page);
    return;
  }

  const allPatients = allPatientsStatement.all();
  const allPatientKeys = allPatients.map(({ rowKey }) => rowKey);

  const allNewPatients = apisPatients
    .filter((patient) => {
      const rowKey = createPatientRowKey(patient);
      return !allPatientKeys.includes(rowKey);
    })
    .filter(Boolean);

  if (!allNewPatients?.length) {
    console.info("There is no new patients for past week");
    await closePageSafely(page);
    return;
  }

  const preparedPatients = allNewPatients
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
    ({ referralDate }) => new Date(referralDate)
  );

  const [minDate, maxDate] = [
    new Date(Math.min(...dates)),
    new Date(Math.max(...dates)),
  ].map((date) => {
    const [splitedDate] = date.toISOString().split("T");
    return splitedDate.split("-").reverse().join("_");
  });

  const fileTitle = `from-${minDate}-to-${maxDate}`;
  const fullFileTitle = `admitted-${fileTitle}`;

  const jsonData = JSON.stringify(preparedPatients, null, 2);

  await writeFile(
    `${generatedSummaryFolderPath}/${fullFileTitle}.json`,
    jsonData,
    "utf8"
  );

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(fileTitle);
  sheet.columns = excelColumns;

  preparedPatients.forEach((row) => sheet.addRow(row));

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
        size: 12,
        bold: false,
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle", // optional, to center vertically too
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();

  await sendWhatsappMessage(process.env.CLIENT_WHATSAPP_NUMBER, {
    files: [
      {
        fileName: fullFileTitle,
        fileBase64: buffer.toString("base64"),
        extension: "xlsx",
      },
    ],
  });

  insertPatients(allNewPatients);
  console.log("all new patients length", allNewPatients.length);

  await closePageSafely(page);
};

export default processCollectReferralSummary;

// Request URL
// https://referralprogram.globemedsaudi.com/referrals/listing
// Request Method
// POST
// Status Code
// {
//     "data": {
//         "pageNumber": 1,
//         "pageSize": 100,
//         "totalNumberOfPages": 1,
//         "totalNumberOfRecords": 1,
//         "hasNext": false,
//         "result": [
//             {
//                 "idReferral": 350844,
//                 "ihalatyReference": "31950880",
//                 "adherentId": "40562736",
//                 "adherentName": " THANIYAH  ALQAHTANI",
//                 "adherentNationalId": "1060650619",
//                 "referralDate": "2025-06-23T22:28:06",
//                 "referralType": "Emergency",
//                 "referralReason": "Bed Unavailable",
//                 "sourceZone": "Asir",
//                 "sourceProvider": "",
//                 "assignedProvider": "",
//                 "disease": "",
//                 "status": null
//             }
//         ]
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
