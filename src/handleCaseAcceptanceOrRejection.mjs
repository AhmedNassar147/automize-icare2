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
import isRecaptchaQuotaExceeded from "./isRecaptchaQuotaExceeded.mjs";
import {
  FAKE_REJECT_PROBE,
  HOME_PAGE_URL,
  USER_ACTION_TYPES,
  APP_URL,
  LETTER_LAYOUT_ABBREVIATIONS,
} from "./constants.mjs";
import sendNtfyMessage from "./sendNtfyMessage.mjs";
import updateEnvFile from "./updateEnvFile.mjs";
import shuffleArray from "./shuffleArray.mjs";
import getCurrentActionLetterFile from "./getCurrentActionLetterFile.mjs";
import getExtraTimeBasedLogs from "./getExtraTimeBasedLogs.mjs";
import randomArrayItem from "./randomArrayItem.mjs";
import writePollLogsData from "./writePollLogsData.mjs";

const createRandomAttachmentKey = (minLength = 3, maxLength = 7) => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  const length =
    Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

  return Array.from(
    { length },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join("");
};

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

const FILE_NAMES = [
  "Letter",
  "Form",
  "File",
  "Acceptance",
  "ViewAcc",
  "Document",
  "Letter Form",
  "Letter Acc",
  "Letter File",
  "DocFile",
  "ReportAcc",
  "patientAcc",
  "CaseLetter",
  "ItemFile",
  "Case Acceptance",

  "Approval",
  "Approval Letter",
  "Approval Form",
  "Approval File",
  "Acceptance Form",
  "Acceptance Letter",
  "Acceptance Report",
  "Acceptance Document",
  "Acceptance File",
  "Referral Letter",
  "Referral Form",
  "Referral File",
  "Referral Document",
  "Medical Letter",
  "Patient Letter",
  "Case File",
  "Case Approval",
  "Referral Approval",
  "Confirmation",
  "Confirmation Letter",
  "Confirmation Form",
  "Confirmation File",
  "Referral Acc",
  "Patient Report",

  "Acquire Document",
  "Acquire Letter",
  "Acquire Form",
  "Acquire Report",
];

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
      patientName,
      letterType,
    } = patient;

    try {
      const {
        CLIENT_NAME,
        WAIT_FOR_ACCEPT_MS,
        ENABLE_AUTO_WAITING,
        DOES_SYSTEM_REDUCE_WAIT,
      } = process.env;

      const isAcceptanceAction = actionType === USER_ACTION_TYPES.ACCEPT;
      const isFakeReject = actionType === FAKE_REJECT_PROBE;

      const { fileData: filebase64 } = await getCurrentActionLetterFile(
        referralId,
        isFakeReject ? USER_ACTION_TYPES.REJECT : actionType,
      );

      const routerKey = Math.random().toString(36).slice(2, 8);

      const patientFileName =
        (patientName || "").trim().split(/\s+/)[0] || "Patient";

      let files;

      if (isAcceptanceAction) {
        const attachmentKey = createRandomAttachmentKey();

        const abbreviation =
          Math.random() < 0.8
            ? LETTER_LAYOUT_ABBREVIATIONS[letterType]
            : undefined;

        const formattedKey =
          Math.random() < 0.67 ? `(${attachmentKey})` : attachmentKey;

        const attachmentSeparator = Math.random() < 0.52 ? "-" : " ";

        const formattedAttachmentKey = shuffleArray(
          [formattedKey, abbreviation].filter(Boolean),
        ).join(attachmentSeparator);

        const randomKey =
          Math.random() < 0.6 ? formattedAttachmentKey : abbreviation;

        const shouldUseRandomKeyAsSeparatePart = Math.random() < 0.7;

        const documentName = randomArrayItem(FILE_NAMES);

        const formattedDocumentName = [
          documentName,
          shouldUseRandomKeyAsSeparatePart ? undefined : randomKey,
        ]
          .filter(Boolean)
          .join(" ");

        const fileNameParts = [
          patientFileName,
          shouldUseRandomKeyAsSeparatePart ? randomKey : undefined,
          formattedDocumentName,
          referralId,
        ].filter(Boolean);

        files = [
          {
            fileName: `${shuffleArray(fileNameParts).join(" ")}.pdf`,
            fileData: filebase64,
            fileExtension: 0,
            userCode: CLIENT_NAME,
            idAttachmentType: 14,
            languageCode: 1,
          },
        ];
      }

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

      await navigateToNewDetailsPage({
        page,
        referralId,
        _routerKey: routerKey,
      });

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

      const isReducingWait = DOES_SYSTEM_REDUCE_WAIT === "Y";

      extraBotMessages.push(
        `Time remaining before loop: ${referralEndTimestamp - Date.now()}`,
      );

      const recaptchaQuotaExceeded = await isRecaptchaQuotaExceeded(page);

      const {
        zeroSeenAt,
        readySeenAt,
        extraBackendDelayMs,
        readySeenAtLocalMs,
        rtt,
        timesWhenOneSecondStartedAndEnded,
        loopCountWhenSecondIsOne,
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
          foceReduceWait: recaptchaQuotaExceeded,
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
      const approvalMessage = `*${actionType} ${referralId}*  waitTime: ${waitTime / 1000}s`;

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
          const message = `⚠️ Notification failed: ${result.reason?.message || result.reason}`;
          createConsoleMessage(message, "error");
          extraBotMessages.push(message);
        }
      }

      const isTimeChanged = waitTime !== baseWaitingTime;

      if (isTimeChanged) {
        extraBotMessages.push(
          `⚠️ waitTime auto-updated from \`${baseWaitingTime}\` to \`${waitTime}\` where referralId=\`${referralId}\``,
        );

        updateEnvFile({
          WAIT_FOR_ACCEPT_MS: waitTime,
          DOES_SYSTEM_REDUCE_WAIT: recaptchaQuotaExceeded ? "Y" : "N",
          // COMPUTED_EXTRA_WAIT: computedExtraWait,
        });
      } else {
        updateEnvFile({
          DOES_SYSTEM_REDUCE_WAIT: recaptchaQuotaExceeded ? "Y" : "N",
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
      });

      extraBotMessages.push(
        `<b>recaptchaQuotaExceeded:</b> ${recaptchaQuotaExceeded}<br><b>Where it was:</b> ${DOES_SYSTEM_REDUCE_WAIT === "Y"}`,
      );

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
