/*
 * Helper: `extractReferralTableData`.
 *
 * Extract structured data from a referral table if it exists and has rows.
 *
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} homePageTableSelector - CSS selector for the table
 * @returns {Promise<Array<Object>>}
 */
import { homePageTableSelector } from "./constants.mjs";

const extractReferralTableData = async (page, targetText) => {
  try {
    await page.waitForSelector(`${homePageTableSelector} tbody tr`, {
      timeout: 90_000,
    });

    const patients = await page.evaluate((homePageTableSelector) => {
      const rows = document.querySelectorAll(
        `${homePageTableSelector} tbody tr`
      );
      const data = [];

      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 8) continue;

        const getText = (cell) => {
          const span = cell.querySelector("span");

          if (span && span.textContent) {
            return (span.textContent || "").trim();
          }
          return "";
        };

        data.push({
          referralDate: getText(cells[0]),
          referralId: getText(cells[1]),
          mohReferralId: getText(cells[2]),
          patientName: getText(cells[3]),
          nationalId: getText(cells[4]),
          referralType: getText(cells[5]),
          referralReason: getText(cells[6]),
          sourceZone: getText(cells[7]),
          mainSpecialty: "",
          subSpecialty: "",
          sourceProvider: "",
          nationality: "",
        });
      }

      return data;
    }, homePageTableSelector);

    console.log(`✅ Extracted ${patients.length} patients for ${targetText}`);
    return patients;
  } catch (err) {
    console.log(
      `❌ Failed to extract referral table for ${targetText}:`,
      err.message
    );
    return [];
  }
};

export default extractReferralTableData;
