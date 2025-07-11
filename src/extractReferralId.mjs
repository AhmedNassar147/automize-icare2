/*
 *
 * Helper: `extractReferralId`.
 *
 */
const extractReferralId = (text) => {
  if (!text) return "";

  const [, referralId] = text.match(/🔢 \*Referral ID:\* `(\d+)`/) || [];
  return (referralId || "").replace(/\s|\n|\t|\\/g, "");
};

export default extractReferralId;

const message = `
🚨 New Case Alert! 🚨

📥 Received At: 🟦 7/11/2025, 2:22:38 PM
🕐 Min Applicable At: 🟨 Invalid Date
⏳ Cutoff Time: 🟧 45 seconds
📤 Max Applicable At: 🟥 Invalid Date

────────────────────────
👤 Name: MERAYE ALAZZAM
📱 Mobile: 0554757278
🌐 Nationality: SAUDI
🆔 National ID: 1070138605
🔢 *Referral ID:* \`351464\`
🏷️ Referral Type: Emergency
🩺 Specialty: Neurology
🔬 Sub-Specialty: Neurology
🏥 Provider: Khamees Mushait Hospital
📍 Zone: Asir
🗓️ Requested At: 2025-07-11T14:18:58
📝 Reason: Health Crisis
🧾 ICDs:
U80.3 - Epilepsy (20) AND isDefault=(Yes)

`;

console.log(extractReferralId(message));
