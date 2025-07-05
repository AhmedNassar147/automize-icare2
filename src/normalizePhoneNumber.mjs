/*
 *
 * Helper: `normalizePhoneNumber`.
 *
 */
const normalizePhoneNumber = (phoneNumber) =>
  (phoneNumber || "").replace(/[^\d]/g, "");

export default normalizePhoneNumber;
