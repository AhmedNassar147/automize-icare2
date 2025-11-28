/*
 *
 * Helper: `collectHomePageTableRows`.
 *
 */
import { homePageTableSelector } from "./constants.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";

const tableRowsSelector = `${homePageTableSelector} tbody tr`;

const collectHomePageTableRows = async (
  page,
  referralId = null,
  tableBodyTimeout
) => {
  // // Wait only if needed
  await page
    .waitForSelector(tableRowsSelector, {
      timeout: tableBodyTimeout || 4000,
      visible: true,
    })
    .catch(() => {}); // Ignore timeout

  const allRows = await page.$$(tableRowsSelector);

  if (!allRows?.length) {
    return referralId ? null : [];
  }

  if (referralId) {
    for (const row of allRows) {
      // Skip rows with no <td>
      const tdCount = await row.$$eval("td", (tds) => tds?.length ?? 0);

      if (!tdCount) continue;

      const { referralId: currentReferralId } =
        await getReferralIdBasedTableRow(row);

      if (currentReferralId === referralId) {
        const iconButton = await row.$("td.iconCell button");
        return { row, iconButton };
      }
    }
    return null;
  }

  // For collecting all valid rows
  const validRows = await Promise.all(
    allRows.map(async (row) => {
      const tdCount = await row.$$eval("td", (tds) => tds?.length ?? 0);
      return tdCount > 0 ? row : null;
    })
  );

  return validRows.filter(Boolean);
};

export default collectHomePageTableRows;
