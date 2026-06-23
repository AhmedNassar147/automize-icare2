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
  APP_URL,
} from "./constants.mjs";
import sendNtfyMessage from "./sendNtfyMessage.mjs";
import updateEnvFile from "./updateEnvFile.mjs";
import getCurrentActionLetterFile from "./getCurrentActionLetterFile.mjs";
import getExtraTimeBasedLogs from "./getExtraTimeBasedLogs.mjs";
import writePollLogsData from "./writePollLogsData.mjs";

export const navigateToNewDetailsPage = async ({
  page,
  referralId,
  _routerKey,
  shouldOpenNewWindow,
}) => {
  const routerKey = _routerKey || Math.random().toString(36).slice(2, 8);

  await page.evaluate(
    ({ referralId, routerKey, shouldOpenNewWindow, APP_URL }) => {
      const targetWindow = shouldOpenNewWindow
        ? window.open(APP_URL, "_blank")
        : window;

      if (!targetWindow) {
        return;
      }

      const navigate = () => {
        try {
          targetWindow?.focus();
        } catch {}
        targetWindow.history.pushState(
          {
            usr: { idReferral: referralId, type: "Referral" },
            key: routerKey,
            idx: targetWindow.history.state?.idx + 1 || 1,
          },
          "",
          "/referral/details",
        );

        targetWindow.dispatchEvent(
          new PopStateEvent("popstate", {
            state: targetWindow.history.state,
          }),
        );
      };

      if (shouldOpenNewWindow) {
        const timer = setInterval(() => {
          try {
            if (
              targetWindow &&
              targetWindow.location.origin === window.location.origin
            ) {
              clearInterval(timer);
              navigate();
            }
          } catch {}
        }, 20);
      } else {
        navigate();
      }
    },
    { referralId, routerKey, APP_URL, shouldOpenNewWindow },
  );
};

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

      // const files = isAcceptanceAction
      //   ? JSON.stringify([
      //       {
      //         fileName,
      //         fileData: filebase64,
      //         fileExtension: 0,
      //         userCode: CLIENT_NAME,
      //         idAttachmentType: 14,
      //         languageCode: 1,
      //       },
      //     ])
      //   : "";

      const files = isAcceptanceAction
        ? [
            {
              fileName,
              fileData: filebase64,
              fileExtension: 0,
              userCode: CLIENT_NAME,
              idAttachmentType: 14,
              languageCode: 1,
            },
          ]
        : undefined;

      const onZeroSecond = async () => {
        if (isFakeReject) return;

        broadcast({
          type: "case-acceptance-or-rejection",
          data: {
            referralId,
            actionType,
            routerKey,
            files,
          },
        });
      };

      const { newPage: page } = await makeUserLoggedInOrOpenHomePage({
        browser,
        startingPageUrl: HOME_PAGE_URL,
        noCursor: true,
        noBundleCheck: true,
      });

      // await navigateToNewDetailsPage({
      //   page,
      //   referralId,
      //   _routerKey: routerKey,
      // });

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

      extraBotMessages.push(
        `Time remaining before loop: ${referralEndTimestamp - Date.now()}`,
      );

      const {
        zeroSeenAt,
        readySeenAt,
        extraBackendDelayMs,
        readySeenAtLocalMs,
        rtt,
        timesWhenOneSecondStartedAndEnded,
        loopCountWhenSecondIsOne,
        timingSummary,
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
      const approvalMessage = [
        `*${actionType} ${referralId}* \`waitTime: ${waitTime / 1000}s\``,
        "",
        `loopCountWhenSecondIsOne=${loopCountWhenSecondIsOne}`,
        "",
        `times=${JSON.stringify(timesWhenOneSecondStartedAndEnded)}`,
      ].join("\n\n");

      const notificationResults = await Promise.allSettled([
        sleep(waitTime).then(() => sendTelegramMessage(approvalMessage)),
        sleep(Math.max(0, waitTime - 37)).then(() =>
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

      await writePollLogsData({
        actionType,
        extraBackendDelayMs,
        loopCountWhenSecondIsOne,
        readySeenAt,
        readySeenAtLocalMs,
        referralId,
        rtt,
        waitTime,
        zeroSeenAt,
        timesWhenOneSecondStartedAndEnded,
        timingSummary,
      });

      if (extraBotMessages.length) {
        await sleep(250);
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
