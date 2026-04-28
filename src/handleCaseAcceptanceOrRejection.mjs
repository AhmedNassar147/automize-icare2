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

      // const COOLDOWN_MS = 2000;

      // const _referralEndTimestamp =
      //   referralEndTimestamp >= claimableServerTime
      //     ? claimableServerTime
      //     : referralEndTimestamp;

      // // 2. Server→local offset (you already have it)
      // const offset = claimableServerTime - claimableLocalTime; // e.g., -293
      // // 3. The precise local time you must click Accept
      // const targetServerTime = _referralEndTimestamp - offset;

      // const targetLocalTime = targetServerTime + COOLDOWN_MS;

      // const waitTime = targetLocalTime - Date.now();

      const COOLDOWN_MS = 2350; // start here, tune by ±100

      // 1. Base = moment the button truly appears
      const targetServerTime = claimableServerTime + COOLDOWN_MS;

      // 2. Offset from the response that detected it
      const offset = claimableServerTime - claimableLocalTime; // can be positive or negative
      const targetLocalTime = targetServerTime - offset;

      // 3. Wait exactly until that local moment
      const waitTime = targetLocalTime - Date.now() - 50;

      // waitTime=2298ms
      // claimableServerTime=1777403612000
      // _referralEndTimestamp=1777403612000
      // referralEndTimestamp=1777403612000
      // claimableLocalTime=1777403611698
      // offset=302
      // COOLDOWN_MS=2300
      // targetServerTime=1777403611698
      // targetLocalTime=1777403613998
      // ntfLatency=80
      // diff1=0
      // diff2=302
      // _diff1=0 _diff2=302

      // waitTime=2296ms
      // claimableServerTime=1777403802000
      // referralEndTimestamp=1777403803000
      // _referralEndTimestamp=1777403802000
      // claimableLocalTime=1777403801691
      // COOLDOWN_MS=2300
      // targetServerTime=1777403801691
      // offset=309
      // targetLocalTime=1777403803991

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
          isSent: isSent,
          claimableServerTime,
          claimableLocalTime,
          referralEndTimestamp,
          // _referralEndTimestamp,
          COOLDOWN_MS,
          targetServerTime,
          offset,
          targetLocalTime,
          diff1: referralEndTimestamp - claimableServerTime,
          diff2: referralEndTimestamp - claimableLocalTime,
          // _diff1: _referralEndTimestamp - claimableServerTime,
          // _diff2: _referralEndTimestamp - claimableLocalTime,
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

// import { EventSource } from "eventsource";
// const res = await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
//   method: "POST",
//   body: JSON.stringify({
//     referralId: "123522",
//     type: "ACCEPT_REQUEST",
//   }),
//   headers: {
//     "Content-Type": "application/json",
//     Title: "Accept case 123522",
//   },
// });

// const result = await res.json();
// console.log("ntfy test response:", result);

// const es = new EventSource(`https://ntfy.sh/${process.env.NTFY_TOPIC}/sse`);

// es.onmessage = (event) => {
//   const data = JSON.parse(event.data);

//   console.log("Received:", data);
// };

// return;
