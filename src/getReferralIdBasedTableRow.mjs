/*
 *
 * Helper: `getReferralIdBasedTableRow`.
 *
 *
 */
const getReferralIdBasedTableRow = async (page, row) => {
  const referralId = await page.evaluate(
    (row) =>
      row.querySelector("td:nth-child(2) span")?.textContent?.trim() || "",
    row
  );

  return (referralId || "").replace(/\s|\n|\t|\\/g, "");
};

export default getReferralIdBasedTableRow;
