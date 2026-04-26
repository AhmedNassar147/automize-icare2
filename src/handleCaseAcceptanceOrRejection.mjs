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

      const avgReactionMs = 100; // adjust after testing
      const requiredDelayAfterClaim = 2400 + avgReactionMs;
      const targetServerTime = claimableServerTime + requiredDelayAfterClaim;
      const serverClientOffset = claimableServerTime - claimableLocalTime;

      // Convert target server time to current local time
      const targetLocalTime = targetServerTime - serverClientOffset;

      const ntfyLatencyMs = 50;
      const waitTime = Math.abs(targetLocalTime - Date.now() - ntfyLatencyMs);

      if (waitTime > 0) {
        await sleep(waitTime);
      }

      let ntfyResult = "";

      if (NTFY_TOPIC) {
        const result = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
          method: "POST",
          body: "ACCEPT NOW: " + referralId,
          headers: {
            // https://github.com/cityssm/node-ntfy-publish/blob/main/priorities.js
            Priority: "5", // Add this line for max priority
          },
        });

        const resJson = await result.json();
        const isSent = result.ok;
        ntfyResult = Object.entries({
          ...resJson,
          avgReactionMs,
          claimableServerTime,
          claimableLocalTime,
          requiredDelayAfterClaim,
          targetServerTime,
          serverClientOffset,
          targetLocalTime,
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
