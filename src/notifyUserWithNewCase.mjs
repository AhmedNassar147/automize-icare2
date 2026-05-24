/**
 *
 * Helper: `notifyUserWithNewCase`.
 *
 */

import createConsoleMessage from "./createConsoleMessage.mjs";
import sendNtfyMessage from "./sendNtfyMessage.mjs";
import speakText from "./speakText.mjs";

const notifyUserWithNewCase = async (referralId) => {
  const { BRANCH_NAME, CLIENT_ID } = process.env;

  const clientOrBranchName = BRANCH_NAME || CLIENT_ID || "Unknown";
  const message = `At ${clientOrBranchName} NEW Patient ${referralId}`;

  try {
    Promise.resolve(
      speakText({
        text: `Check ${clientOrBranchName} bot, ` + `there is a new patient`,
      }),
    ).catch((error) => {
      createConsoleMessage(error, "error", "SOUND error");
    });
    await sendNtfyMessage(message);
  } catch (error) {
    createConsoleMessage(error, "error", "notifyUserWithNewCase error");
  }
};

export default notifyUserWithNewCase;
