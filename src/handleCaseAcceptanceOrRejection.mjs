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
import sendNtfyMessage from "./sendNtfyMessage.mjs";

async function pdfToBase64(filePath) {
  const buf = await readFile(filePath);
  return buf.toString("base64");
}

const handleCaseAcceptanceOrRejection =
  ({
    actionType,
    broadcast,
    sendWhatsappMessage,
    sendTelegramMessage,
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
        NEW_WAITING_TIME_FOR_PATIENT,
        NEW_EXTRA_WAITING_TIME_FOR_PATIENT,
      } = process.env;

      const isAcceptanceAction = actionType === USER_ACTION_TYPES.ACCEPT;

      const folderPathe = isAcceptanceAction
        ? generatedPdfsPathForAcceptance
        : generatedPdfsPathForRejection;

      const fileName = `${actionType}-${referralId}.pdf`;

      const filePath = join(folderPathe, fileName);

      const filebase64 = await pdfToBase64(filePath);

      const [timeMsString, checkingReferralId] = (
        NEW_WAITING_TIME_FOR_PATIENT || ""
      ).split(",");

      let waitingTimeMSForAccept = timeMsString
        ? Math.max(Number(timeMsString), 1000)
        : undefined;

      if (checkingReferralId && checkingReferralId !== referralId) {
        waitingTimeMSForAccept = undefined;
      }

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
          waitingTime: waitingTimeMSForAccept,
          waitExtraTime: waitingTimeMSForAccept
            ? NEW_EXTRA_WAITING_TIME_FOR_PATIENT
            : undefined,
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

      const isEndDateGreaterThanFinalCaseDate =
        referralEndTimestamp > claimableServerTime;

      const isEndDateEqualToFinalCaseDate =
        referralEndTimestamp === claimableServerTime;

      const diff = referralEndTimestamp - claimableServerTime;

      let waitTime = WAIT_FOR_ACCEPT_MS;

      waitTime = diff > 0 ? waitTime : waitTime + 2;

      const approvalMessage = `*${actionType} ${referralId}* _waitTime=${waitTime / 1000}s_`;

      await Promise.all([
        sleep(waitTime).then(() =>
          sendWhatsappMessage(CLIENT_WHATSAPP_NUMBER, {
            message: approvalMessage,
          }),
        ),
        sleep(waitTime - 63).then(() => sendTelegramMessage(approvalMessage)),

        sleep(waitTime - 34).then(() => sendNtfyMessage(approvalMessage)),
      ]);

      await closePageSafely(page);

      const logs = {
        referralId,
        waitTime,
        waitingTimeMSForAccept,
        remainingMs,
        elapsedMs,
        attempts,
        reason,
        message,
        isEndDateGreaterThanFinalCaseDate,
        isEndDateEqualToFinalCaseDate,
        diff,
      };

      createConsoleMessage(
        "✅ " + Object.keys(logs).map((k) => `${k}: ${logs[k]} `),
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
