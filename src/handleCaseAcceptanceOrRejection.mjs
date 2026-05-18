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
import summarizeLogsAfterAcceptance, {
  readLogsAsArray,
} from "./summarizeLogsAfterAcceptance.mjs";
import {
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  HOME_PAGE_URL,
  USER_ACTION_TYPES,
} from "./constants.mjs";
import sendNtfyMessage from "./sendNtfyMessage.mjs";
import updateEnvFile from "./updateEnvFile.mjs";

async function pdfToBase64(filePath) {
  const buf = await readFile(filePath);
  return buf.toString("base64");
}

const getWaitBasedRefferalDatesAndLogs = async ({
  referralId,
  referralEndTimestamp,
  diff,
  extraBackendDelayMs,
}) => {
  let extraWait = diff === 0 ? 4 : 0;
  const extraBotMessages = [];

  const logsData = await readLogsAsArray(referralEndTimestamp);

  let lastReferralLog = {};

  if (logsData?.length) {
    lastReferralLog = logsData[logsData.length - 1] || {};
  }

  const { diff: lastDiff, extraWait: lastExtraWait } = lastReferralLog || {};

  if (diff < 0) {
    if (lastDiff < 0) {
      const _lastExtraWait = lastExtraWait || 0;
      extraWait = 5 + (_lastExtraWait === 0 ? 2 : 4);
    } else {
      extraWait = 0;
    }
    extraBotMessages.push(
      // `Please Tell \`Ahmed\` of this: Found diff of \`${diff}\` Less than 0 where referralId=\`${referralId}\``,
      `Found diff of \`${diff}\` Less than 0`,
    );
  }

  if (extraBackendDelayMs >= 2000) {
    extraWait += 6;
    extraWait = Math.max(extraWait, 13);
  }

  if (extraBackendDelayMs < 1000) {
    extraBotMessages.push(
      // `Please Tell \`Ahmed\` of this: Found extra backend delay of \`${extraBackendDelayMs}\` < 1000 where referralId=\`${referralId}\``,
      `Found extra backend delay of \`${extraBackendDelayMs}\` < 1000`,
    );
  }

  return {
    computedExtraWait: extraWait,
    computedExtraBotMessages: extraBotMessages,
  };
};

const handleCaseAcceptanceOrRejection =
  ({
    actionType,
    broadcast,
    sendWhatsappMessage,
    sendTelegramMessage,
    continueFetchingPatientsIfPaused,
    browser,
    patientStore,
  }) =>
  async (patient) => {
    const {
      referralId,
      referralEndTimestamp,
      providerName,
      endDateBasedServerDateMs,
      referralEndDate,
    } = patient;

    try {
      const {
        CLIENT_NAME,
        WAIT_FOR_ACCEPT_MS,
        CLIENT_WHATSAPP_NUMBER,
        NTFY_TOPIC,
        NEW_WAITING_TIME_FOR_PATIENT,
        NEW_EXTRA_WAITING_TIME_FOR_PATIENT,
        ENABLE_AUTO_WAITING,
      } = process.env;

      const isAcceptanceAction = actionType === USER_ACTION_TYPES.ACCEPT;

      const folderPath = isAcceptanceAction
        ? generatedPdfsPathForAcceptance
        : generatedPdfsPathForRejection;

      const fileName = `${actionType}-${referralId}.pdf`;

      const filePath = join(folderPath, fileName);

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

      const routerKey = Math.random().toString(36).slice(2, 8);

      const onZeroSecond = () => {
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
            routerKey,
            blockTimeMs: Number(process.env.BLOCK_TIME_MS || 1201),
            // waitingTime: waitingTimeMSForAccept,
            // waitExtraTime: waitingTimeMSForAccept
            //   ? NEW_EXTRA_WAITING_TIME_FOR_PATIENT
            //   : undefined,
          },
        });
      };

      const { newPage: page } = await makeUserLoggedInOrOpenHomePage({
        browser,
        startingPageUrl: HOME_PAGE_URL,
        noCursor: true,
        noBundleCheck: true,
      });

      await page.evaluate(
        ({ referralId, routerKey }) => {
          window.history.pushState(
            {
              usr: { idReferral: referralId, type: "Referral" },
              key: routerKey, // e.g. "a3f9kx"
              idx: window.history.state?.idx + 1 || 1,
            },
            "",
            "/referral/details",
          );
          window.dispatchEvent(
            new PopStateEvent("popstate", { state: window.history.state }),
          );
        },
        { referralId, routerKey },
      );

      const currentUrl = page.url().toLowerCase();

      createConsoleMessage(
        `Navigated to details page referralId=${referralId} and URL=${currentUrl}`,
        "info",
      );

      let extraBotMessages = [];

      const rawWaitTime = WAIT_FOR_ACCEPT_MS || "";

      let baseWaitingTime = +rawWaitTime;

      if (Number.isNaN(baseWaitingTime)) {
        const value = rawWaitTime.match(/(\d+)s/)?.[1] || 0;
        baseWaitingTime = +value;
        extraBotMessages.push(
          `Found non numeric waitTime of \`${rawWaitTime}\`, Please set it as number not with characters where referralId=\`${referralId}\``,
        );
      }

      if (!Number.isFinite(baseWaitingTime) || baseWaitingTime <= 0) {
        baseWaitingTime = 2000;
        extraBotMessages.push(
          `Didn't find the waitTime=\`${WAIT_FOR_ACCEPT_MS}\` we forced to use \`${baseWaitingTime}\` for this case, Please set the proper waitTime from bot via \`/wait some time\``,
        );
      }

      const remainingMs = referralEndTimestamp - Date.now();

      const {
        reason,
        elapsedMs,
        message,
        attempts,
        zeroSeenAt,
        readySeenAt,
        extraBackendDelayMs,
        readySeenAtLocalMs,
      } = await waitUntilCanTakeActionByWindow({
        page,
        referralId,
        remainingMs,
        onZeroSecond,
      });

      const diff = referralEndTimestamp - readySeenAt;

      let extraWait = 0;

      const { computedExtraBotMessages, computedExtraWait } =
        await getWaitBasedRefferalDatesAndLogs({
          referralId,
          referralEndTimestamp,
          diff,
          extraBackendDelayMs,
        });

      if (ENABLE_AUTO_WAITING === "1") {
        extraWait = computedExtraWait;
        extraBotMessages = extraBotMessages.concat(computedExtraBotMessages);
      }

      const waitTime = baseWaitingTime + extraWait;

      const approvalMessage = `*${actionType} ${referralId}* _waitTime=${waitTime / 1000}s_`;

      const promises = [
        sleep(waitTime).then(() =>
          sendWhatsappMessage(CLIENT_WHATSAPP_NUMBER, {
            message: approvalMessage,
          }),
        ),
        sleep(waitTime).then(() => sendTelegramMessage(approvalMessage)),
        sleep(waitTime - 34).then(() => sendNtfyMessage(approvalMessage)),
      ];

      await Promise.all(promises);

      const updateResult = await patientStore.updatePatient(referralId, {
        readySeenAtLocalMs,
        waitTime: waitTime,
      });

      if (!updateResult.success) {
        extraBotMessages.push(updateResult.message);
      }

      const isTimeChanged = waitTime !== baseWaitingTime;

      if (isTimeChanged) {
        extraBotMessages.push(
          `⚠️ waitTime auto-updated from \`${baseWaitingTime}\` to \`${waitTime}\` where referralId=\`${referralId}\``,
        );

        updateEnvFile({
          WAIT_FOR_ACCEPT_MS: waitTime,
        });
      }

      if (extraBotMessages.length) {
        await Promise.all(
          extraBotMessages.map((message, index) =>
            sleep(Math.floor(waitTime / 2 + index * 20)).then(() =>
              sendTelegramMessage(message),
            ),
          ),
        );
      }

      await closePageSafely(page);

      const logs = {
        referralId,
        waitTime,
        extraWait,
        referralEndTimestamp,
        endDateBasedServerDateMs,
        zeroSeenAt,
        readySeenAt,
        extraBackendDelayMs,
        referralEndDate,
      };

      if (isAcceptanceAction) {
        await summarizeLogsAfterAcceptance(logs);
      }

      createConsoleMessage(
        `patient=${referralId}, computedExtraWait=${computedExtraWait} computedExtraBotMessages=${computedExtraBotMessages.join("\n")}`,
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
