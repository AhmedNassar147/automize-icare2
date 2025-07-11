import { homePageTableSelector } from "./constants.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";

const tableRowsSelector = `${homePageTableSelector} tbody tr`;

const collectHomePageTableRows = async (page, referralId = null) => {
  // // Wait only if needed
  await page
    .waitForSelector(tableRowsSelector, {
      timeout: 2000,
    })
    .catch(() => {}); // Ignore timeout

  const allRows = await page.$$(tableRowsSelector);

  if (!allRows?.length) {
    return referralId ? null : [];
  }

  if (referralId) {
    for (const row of allRows) {
      // Skip rows with no <td>
      const tdCount = await row.$$eval("td", (tds) => tds.length);
      if (!tdCount) continue;

      const currentReferralId = await getReferralIdBasedTableRow(row);

      if (currentReferralId === referralId) {
        const iconButton = await row.$("td:last-child button");
        return { row, iconButton };
      }
    }
    return null;
  }

  // For collecting all valid rows
  const validRows = await Promise.all(
    allRows.map(async (row) => {
      const tdCount = (await row.$$eval("td", (tds) => tds?.length)) ?? 0;
      return tdCount > 0 ? row : null;
    })
  );

  return validRows.filter(Boolean);
};

export default collectHomePageTableRows;
