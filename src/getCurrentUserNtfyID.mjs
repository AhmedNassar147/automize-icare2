/*
 *
 * Helper: `getCurrentUserNtfyID`.
 *
 */
const getCurrentUserNtfyID = () => {
  const { NTFY_BASE_ID, CLIENT_WHATSAPP_NUMBER } = process.env;

  return `${CLIENT_WHATSAPP_NUMBER}_${NTFY_BASE_ID}`;
};

export default getCurrentUserNtfyID;
