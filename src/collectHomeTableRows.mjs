/*
 *
 * Helper: `collectHomePageTableRows`.
 *
 */
import { homePageTableSelector } from "./constants.mjs";
import sleep from "./sleep.mjs";
import getReferralIdBasedTableRow from "./getReferralIdBasedTableRow.mjs";

const collectHomePageTableRows = async (page, referralId = null) => {
  await sleep(70 + Math.random() * 85);

  const allRows = await page.$$(`${homePageTableSelector} tbody tr`);

  const rows = [];

  if (!allRows.length) return referralId ? null : [];

  for (const row of allRows) {
    const hasTd = await row.evaluate(
      (tr) => tr.querySelectorAll("td").length > 0
    );

    if (!hasTd) continue;

    if (referralId) {
      const currentReferralId = await getReferralIdBasedTableRow(page, row);

      if (currentReferralId === referralId) {
        const iconButton = await row.$("td:last-child button");
        return { row, iconButton }; // ✅ Return single match
      }
    } else {
      rows.push(row); // ✅ Collect all rows if no referralId passed
    }
  }

  return referralId ? null : rows; // ✅ Return null if not found when referralId is passed
};

export default collectHomePageTableRows;
