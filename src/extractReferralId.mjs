/*
 *
 * Helper: `extractReferralId`.
 *
 */
const extractReferralId = (text) => {
  if (!text) return "";

  const [, referralId] = text.match(/🔢 \*Referral ID:\* (\d+)/) || [];
  return referralId || "";
};

export default extractReferralId;
