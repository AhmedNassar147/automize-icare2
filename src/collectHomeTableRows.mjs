/*
 *
 * Helper: `collectHomePageTableRows`.
 *
 */
import { homePageTableSelector } from "./constants.mjs";
import sleep from "./sleep.mjs";

const collectHomePageTableRows = async (page) => {
  await sleep(70 + Math.random() * 85);

  const allRows = await page.$$(`${homePageTableSelector} tbody tr`);
  const rows = [];

  if (allRows.length > 0) {
    for (const row of allRows) {
      const hasTd = await row.evaluate(
        (tr) => tr.querySelectorAll("td").length > 0
      );

      if (hasTd) {
        rows.push(row);
      }
    }
  }

  return rows;
};

export default collectHomePageTableRows;
