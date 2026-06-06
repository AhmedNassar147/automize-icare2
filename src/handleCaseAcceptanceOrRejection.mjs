/**
 *
 * Helper: `handleCaseAcceptanceOrRejection`.
 *
 */
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import waitUntilCanTakeActionByWindow from "./waitUntilCanTakeActionByWindow.mjs";
import closePageSafely from "./closePageSafely.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import sleep from "./sleep.mjs";
import summarizeLogsAfterAcceptance from "./summarizeLogsAfterAcceptance.mjs";
import {
  FAKE_REJECT_PROBE,
  HOME_PAGE_URL,
  USER_ACTION_TYPES,
} from "./constants.mjs";
import sendNtfyMessage from "./sendNtfyMessage.mjs";
import updateEnvFile from "./updateEnvFile.mjs";
import getCurrentActionLetterFile from "./getCurrentActionLetterFile.mjs";
import getExtraTimeBasedLogs from "./getExtraTimeBasedLogs.mjs";

const handleCaseAcceptanceOrRejection =
  ({
    actionType,
    broadcast,
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
      const { CLIENT_NAME, WAIT_FOR_ACCEPT_MS, ENABLE_AUTO_WAITING } =
        process.env;

      const isAcceptanceAction = actionType === USER_ACTION_TYPES.ACCEPT;
      const isFakeReject = actionType === FAKE_REJECT_PROBE;

      const { fileName, fileData: filebase64 } =
        await getCurrentActionLetterFile(
          referralId,
          isFakeReject ? USER_ACTION_TYPES.REJECT : actionType,
        );

      const routerKey = Math.random().toString(36).slice(2, 8);

      const onZeroSecond = () => {
        if (isFakeReject) {
          return;
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
            routerKey,
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

      const remainingMs = referralEndTimestamp - Date.now();

      createConsoleMessage(
        `Navigated to details page referralId=${referralId} remainingMs=${remainingMs} and URL=${currentUrl}`,
        "info",
      );

      let extraBotMessages = [];

      if (isFakeReject) {
        extraBotMessages.push(
          `This is a fake reject probe, Please ignore the message, referralId=${referralId}`,
        );
      }

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

      const {
        zeroSeenAt,
        readySeenAt,
        extraBackendDelayMs,
        readySeenAtLocalMs,
        rtt,
      } = await waitUntilCanTakeActionByWindow({
        page,
        referralId,
        onZeroSecond,
      });

      const diff = referralEndTimestamp - readySeenAt;

      let extraWait = 0;

      const { computedExtraBotMessages, computedExtraWait } =
        await getExtraTimeBasedLogs({
          referralId,
          referralEndTimestamp,
          diff,
          extraBackendDelayMs,
          rtt,
          baseWaitingTime,
        });

      if (ENABLE_AUTO_WAITING === "1") {
        extraWait = computedExtraWait;
        extraBotMessages = extraBotMessages.concat(computedExtraBotMessages);
      }

      if (
        !readySeenAt ||
        !zeroSeenAt ||
        !readySeenAtLocalMs ||
        typeof extraBackendDelayMs !== "number"
      ) {
        extraBotMessages.push(
          `Missing readySeenAt=${readySeenAt} zeroSeenAt=${zeroSeenAt} readySeenAtLocalMs=${readySeenAtLocalMs} extraBackendDelayMs=${extraBackendDelayMs} for referralId=${referralId}`,
        );
      }
      const waitTime = baseWaitingTime + extraWait;
      const approvalMessage = `*${actionType} ${referralId}* \`waitTime: ${waitTime / 1000}s\``;

      const notificationResults = await Promise.allSettled([
        sleep(waitTime).then(() => sendTelegramMessage(approvalMessage)),
        sleep(Math.max(0, waitTime - 36)).then(() =>
          sendNtfyMessage(approvalMessage),
        ),
        summarizeLogsAfterAcceptance({
          referralId,
          waitTime,
          extraWait,
          referralEndTimestamp,
          endDateBasedServerDateMs,
          zeroSeenAt,
          readySeenAt,
          readySeenAtLocalMs,
          extraBackendDelayMs,
          referralEndDate,
          rtt,
          status: isAcceptanceAction ? "" : "not-clicked",
          claimed: isAcceptanceAction ? "" : "No",
          extraWaitMessage: computedExtraBotMessages.join("_AND_"),
        }),
      ]);

      for (const result of notificationResults) {
        if (result.status === "rejected") {
          extraBotMessages.push(
            `⚠️ Notification failed: ${result.reason?.message || result.reason}`,
          );
        }
      }

      const isTimeChanged = waitTime !== baseWaitingTime;

      if (isTimeChanged) {
        extraBotMessages.push(
          `⚠️ waitTime auto-updated from \`${baseWaitingTime}\` to \`${waitTime}\` where referralId=\`${referralId}\``,
        );

        updateEnvFile({
          WAIT_FOR_ACCEPT_MS: waitTime,
          // COMPUTED_EXTRA_WAIT: computedExtraWait,
        });
      }

      await closePageSafely(page);

      if (isAcceptanceAction) {
        patientStore.addNonClaimableCase(referralId, referralEndTimestamp);
      }

      if (extraBotMessages.length) {
        await sleep(300);
        await sendTelegramMessage(extraBotMessages.join("\n\n"));
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
    }
  };

export default handleCaseAcceptanceOrRejection;
