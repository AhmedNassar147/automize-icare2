/*
 *
 * Helper: `sendNtfyMessage`.
 *
 */
import getCurrentUserNtfyID from "./getCurrentUserNtfyID.mjs";
import { getPublicActionBaseUrl } from "./startCloudflareTunnel.mjs";

const sendNtfyMessage = async (messsage, referralId, withActions) => {
  const baseUrl = getPublicActionBaseUrl();
  const notifierID = getCurrentUserNtfyID();

  console.log("baseUrl", baseUrl);

  let actions = undefined;

  console.log({
    withActions,
    referralId,
    baseUrl,
  });

  if (!!(withActions && referralId)) {
    actions = [
      `view, ✅ Accept, ${baseUrl}/action?referralId=${referralId}&action=accept`,
      `view, ❌ Reject, ${baseUrl}/action?referralId=${referralId}&action=reject`,
      `view, ❌ Cancel, ${baseUrl}/action?referralId=${referralId}&action=cancel`,
      `view, 🟢 Online, ${baseUrl}/action?referralId=${referralId}&action=online`,
    ].join("; ");
  }

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
      Actions: actions,
    },
  });
};

export default sendNtfyMessage;
