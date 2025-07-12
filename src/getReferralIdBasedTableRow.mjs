/*
 *
 * Helper: `getReferralIdBasedTableRow`.
 *
 *
 */

const cellSpan = "td:nth-child(2) span";

const getReferralIdBasedTableRow = async (row) => {
  try {
    await row.waitForSelector(cellSpan, {
      timeout: 2500,
    });
    const referralId = await row.$eval(cellSpan, (el) =>
      (el?.textContent || "").trim().replace(/\s|\n|\t|\\/g, "")
    );
    return referralId;
  } catch (e) {
    console.error("Failed to get referral ID:", e.message);
    return "";
  }
};

export default getReferralIdBasedTableRow;

// /*
//  *
//  * Helper: `getReferralIdBasedTableRow`.
//  *
//  *
//  */
// const getReferralIdBasedTableRow = async (row) => {
//   try {
//     const referralId = await row.$eval(
//       "td:nth-child(2) span",
//       (el) => el.textContent?.trim().replace(/\s|\n|\t|\\/g, "") || ""
//     );
//     return referralId;
//   } catch (e) {
//     console.log("ERRR", e.message)
//     return "";
//   }
// };

// export default getReferralIdBasedTableRow;
