/*
 *
 * Helper: `getReferralIdBasedTableRow`.
 *
 *
 */
const filter = (el) =>
  (el?.textContent || "").trim().replace(/\s|\n|\t|\\/g, "");

const getReferralIdBasedTableRow = async (row) => {
  try {
    await row.waitForSelector("td span", { timeout: 2500 });

    const [referralDate, referralId] = await Promise.all([
      row.$eval("td:nth-child(1) span", filter),
      row.$eval("td:nth-child(2) span", filter),
    ]);

    return { referralDate, referralId };
  } catch (e) {
    console.error("❌ Failed to get referral row data:", e.message);
    return {};
  }
};

export default getReferralIdBasedTableRow;
