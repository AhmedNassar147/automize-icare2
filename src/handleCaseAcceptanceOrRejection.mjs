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
import {
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  USER_ACTION_TYPES,
} from "./constants.mjs";
import sleep from "./sleep.mjs";

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
  }) =>
  async (patient) => {
    const { referralId, referralEndTimestamp, providerName } = patient;

    try {
      const { CLIENT_NAME, WAIT_FOR_ACCEPT_MS, CLIENT_WHATSAPP_NUMBER } =
        process.env;

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

      const { reason, elapsedMs, message, attempts } =
        await waitUntilCanTakeActionByWindow({
          page,
          referralId,
          remainingMs,
        });

      const waitTime = WAIT_FOR_ACCEPT_MS * 1000;
      await sleep(WAIT_FOR_ACCEPT_MS * 1000);
      await sendWhatsappMessage(CLIENT_WHATSAPP_NUMBER, {
        message: `*${actionType} ${referralId}* _waitTime=${waitTime / 1000}s_`,
      });

      await closePageSafely(page);

      createConsoleMessage(
        `✅ actionType=${actionType} patient=${referralId} remainingMs=${remainingMs} elapsedMs=${elapsedMs} attempts=${attempts} reason=${reason} message=${message}`,
        "warn"
      );

      continueFetchingPatientsIfPaused();
    } catch (error) {
      createConsoleMessage(
        error,
        "error",
        `failed when ${actionType} patient=${referralId}`
      );
      continueFetchingPatientsIfPaused();
    }
  };

export default handleCaseAcceptanceOrRejection;
