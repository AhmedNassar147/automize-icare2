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

      const files = isAcceptanceAction
        ? JSON.stringify([
            {
              fileName,
              fileData: filebase64,
              fileExtension: 0,
              userCode: CLIENT_NAME,
              idAttachmentType: 14,
              languageCode: 1,
            },
          ])
        : "";

      const allPatients = patientStore.getAllPatients();

      const hasTooNearCase = allPatients.some(
        ({ referralId: id, referralEndTimestamp: currentCaseTs }) => {
          if (String(id) === String(referralId) || !currentCaseTs) return false;

          const diff = currentCaseTs - Date.now();
          return diff > 0 && diff <= 4 * 60 * 1000;
        },
      );

      const onZeroSecond = async () => {
        if (isFakeReject) return;

        const pages = await browser.pages();

        const neededPage =
          pages[pages.length - 2] ||
          pages.find((p) =>
            p.url().toLowerCase().includes("/dashboard/referral"),
          );

        if (!neededPage) {
          throw new Error(`No neededPage found for referralId=${referralId}`);
        }

        console.log(
          "selected page:",
          neededPage.url(),
          "all pages:",
          pages.map((p, i) => `${i}: ${p.url()}`),
        );

        await neededPage.bringToFront();

        const clicked = await neededPage.evaluate(
          ({ referralId, files, hasTooNearCase }) => {
            if (files) {
              localStorage.setItem("GM__FILS", files);
            }

            if (!window.__gmAcceptTimingInstalled) {
              window.__gmAcceptTimingInstalled = true;

              let clickedAt = 0;
              let reported = false;

              const isDashboard = () =>
                /^\/dashboard\/referral/i.test(location.pathname);

              const isDetails = () =>
                /^\/referral\/details/i.test(location.pathname);

              const report = (payload) => {
                if (reported) return;
                reported = true;
                fetch("https://localhost:8443/setCaseOutcome", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                })
                  .catch(() => {})
                  .finally(() => {
                    if (!hasTooNearCase) {
                      window.close();
                    }
                  });
              };

              const checkRouteAfterClick = () => {
                if (!clickedAt) return;

                const elapsedMs = Date.now() - clickedAt;

                if (isDashboard()) {
                  report({
                    referralId,
                    clickedAt,
                    elapsedMs,
                    blocked: false,
                    finalUrl: location.href,
                  });
                  clickedAt = 0;
                  return;
                }

                if (!isDetails()) {
                  report({
                    referralId,
                    clickedAt,
                    elapsedMs,
                    blocked: true,
                    finalUrl: location.href,
                  });
                  clickedAt = 0;
                }
              };

              const wrapHistory = (original) =>
                function (...args) {
                  const result = original.apply(this, args);
                  setTimeout(checkRouteAfterClick, 0);
                  return result;
                };

              history.pushState = wrapHistory(history.pushState);
              history.replaceState = wrapHistory(history.replaceState);

              window.addEventListener("popstate", () => {
                setTimeout(checkRouteAfterClick, 0);
              });

              document.addEventListener(
                "click",
                (e) => {
                  const time = Date.now();
                  const btn = e.target.closest(
                    ".referral-button-container button.MuiButton-containedPrimary:not([data-gm-prepare])",
                  );

                  if (!btn) return;

                  const text = btn.textContent.trim().toLowerCase();

                  if (!text.includes("accept referral")) return;

                  clickedAt = time;
                },
                true,
              );
            }

            const normalize = (str) => (str || "").trim();
            const colIndex = 2;

            const spans = document.querySelectorAll(
              `table.MuiTable-root tbody tr td:nth-of-type(${colIndex}) span`,
            );

            const target = normalize(String(referralId));

            for (const span of spans) {
              const txt = normalize(span.textContent || "");
              if (txt !== target) continue;

              const row = span.closest("tr");
              const iconButton = row?.querySelector("td.iconCell button");

              if (iconButton) {
                iconButton.click();
                return true;
              }
            }

            return false;
          },
          { referralId, files, hasTooNearCase },
        );

        if (!clicked) {
          await navigateToNewDetailsPage({
            page: neededPage,
            referralId,
          });
        }
      };

      const { newPage: page } = await makeUserLoggedInOrOpenHomePage({
        browser,
        startingPageUrl: HOME_PAGE_URL,
        noCursor: true,
        noBundleCheck: true,
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
