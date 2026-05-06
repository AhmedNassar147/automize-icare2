/*
 *
 * Helper: `sendNtfyMessage`.
 *
 */
import getCurrentUserNtfyID from "./getCurrentUserNtfyID.mjs";

const sendNtfyMessage = async (messsage) => {
  const notifierID = getCurrentUserNtfyID();

  return await fetch(`https://ntfy.sh/${notifierID}`, {
    method: "POST",
    body: messsage,
    headers: {
      Title: "CNHI",
      // https://github.com/cityssm/node-ntfy-publish/blob/main/emoji.js
      Tags: "rotating_light",
      // https://github.com/cityssm/node-ntfy-publish/blob/main/priorities.js
      Priority: "5", // Add this line for max priority,
      // Icon: "https://referralprogram.globemedsaudi.com/assets/MOHlogo-a80cbf2a.png",
    },
  });
};

export default sendNtfyMessage;
