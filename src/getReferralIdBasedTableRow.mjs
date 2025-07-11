/*
 *
 * Helper: `getReferralIdBasedTableRow`.
 *
 *
 */
const getReferralIdBasedTableRow = async (row) => {
  try {
    const referralId = await row.$eval(
      "td:nth-child(2) span",
      (el) => el.textContent?.trim().replace(/\s|\n|\t|\\/g, "") || ""
    );
    return referralId;
  } catch (e) {
    return "";
  }
};

export default getReferralIdBasedTableRow;
