/**
 *
 * Helper: `handleCaseAcceptanceOrRejection`.
 *
 */
import { join } from "path";
import { readFile } from "node:fs/promises";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import waitUntilCanTakeActionByWindow from "./waitUntilCanTakeActionByWindow.mjs";
import closePageSafely from "./closePageSafely.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import sleep from "./sleep.mjs";
// import makeBeep from "./makeBeep.mjs";
import {
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  USER_ACTION_TYPES,
} from "./constants.mjs";

async function pdfToBase64(filePath) {
  const buf = await readFile(filePath);
  return buf.toString("base64");
}

const handleCaseAcceptanceOrRejection =
  ({
    actionType,
    broadcast,
    sendWhatsappMessage,
    continueFetchingPatientsIfPaused,
    browser,
  }) =>
  async (patient) => {
    const { referralId, referralEndTimestamp, providerName } = patient;

    try {
      const {
        CLIENT_NAME,
        WAIT_FOR_ACCEPT_MS,
        CLIENT_WHATSAPP_NUMBER,
        NTFY_TOPIC,
      } = process.env;

      const isAcceptanceAction = actionType === USER_ACTION_TYPES.ACCEPT;

      const folderPathe = isAcceptanceAction
        ? generatedPdfsPathForAcceptance
        : generatedPdfsPathForRejection;

      const fileName = `${actionType}-${referralId}.pdf`;

      const filePath = join(folderPathe, fileName);

      const filebase64 = await pdfToBase64(filePath);

      broadcast({
        type: "case-acceptance-or-rejection",
        data: {
          referralId,
          filebase64,
          referralEndTimestamp,
          providerName,
          clientName: CLIENT_NAME,
          fileName,
          actionType,
        },
      });

      const { newPage: page } = await makeUserLoggedInOrOpenHomePage({
        browser,
        startingPageUrl: HOME_PAGE_URL,
        noCursor: true,
        noBundleCheck: true,
      });

      const remainingMs = referralEndTimestamp - Date.now();

      const {
        reason,
        elapsedMs,
        message,
        attempts,
        claimableServerTime,
        claimableLocalTime,
      } = await waitUntilCanTakeActionByWindow({
        page,
        referralId,
        remainingMs,
      });

      const requiredDelayAfterClaim = 2488; // base cooldown only, NO reaction buffer
      const targetClickLocalTime = claimableLocalTime + requiredDelayAfterClaim; // when you want the actual click

      const waitTime = targetClickLocalTime - Date.now();

      if (waitTime > 0) {
        await sleep(waitTime);
      }

      let ntfyResult = "";

      if (NTFY_TOPIC) {
        const result = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
          method: "POST",
          body: "ACCEPT NOW: " + referralId,
          headers: {
            Title: "CNHI",
            // https://github.com/cityssm/node-ntfy-publish/blob/main/emoji.js
            Tags: "rotating_light",
            // https://github.com/cityssm/node-ntfy-publish/blob/main/priorities.js
            Priority: "5", // Add this line for max priority,
            // Icon: "https://referralprogram.globemedsaudi.com/assets/MOHlogo-a80cbf2a.png",
          },
        });

        const resJson = await result.json();
        const isSent = result.ok;
        ntfyResult = Object.entries({
          ...resJson,
          claimableServerTime,
          claimableLocalTime,
          requiredDelayAfterClaim,
          targetClickLocalTime,
          isSent: isSent,
        })
          .map(([key, value]) => `${key}=${value}`)
          .join(" ");
      } else {
        await sendWhatsappMessage(CLIENT_WHATSAPP_NUMBER, {
          message: `*${actionType} ${referralId}* _waitTime=${waitTime / 1000}s_`,
        });
      }

      await closePageSafely(page);

      createConsoleMessage(
        `✅ Patient=${referralId} waitTime=${waitTime}ms remainingMs=${remainingMs} elapsedMs=${elapsedMs} attempts=${attempts} reason=${reason} message=${message} ntfyResult=${ntfyResult}`,
        "warn",
      );

      // continueFetchingPatientsIfPaused();
    } catch (error) {
      createConsoleMessage(
        error,
        "error",
        `failed when ${actionType} patient=${referralId}`,
      );
      // continueFetchingPatientsIfPaused();
    }
  };

export default handleCaseAcceptanceOrRejection;
