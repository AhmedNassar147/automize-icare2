/*
 * Helper: waitUntilCanTakeActionByWindow
 */
import { globMedHeaders } from "./constants.mjs";

async function waitUntilCanTakeActionByWindow({
  page,
  referralId,
  onZeroSecond,
  onLastSeconds,
}) {
  const now = Date.now();
  let fnName = null;

  if (onZeroSecond) {
    fnName = `onZeroSecond_${now}`;
    await page.exposeFunction(fnName, onZeroSecond);
  }

  let onLastSecondsFnName = null;

  if (onLastSeconds) {
    onLastSecondsFnName = `onLastSeconds_${now}`;
    await page.exposeFunction(onLastSecondsFnName, onLastSeconds);
  }

  return await page.evaluate(
    async ({ globMedHeaders, referralId, fnName, onLastSecondsFnName }) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const pollLogs = [];

      let loopCountWhenSecondIsOne = 0;
      let onZeroSecondCalled = false;

      let zeroSeenAt = 0;
      let readySeenAt = 0;
      let readySeenAtLocalMs = 0;

      let leftTimeWhenLastSecondsCalled = 0;

      let lastPollLocalNow = 0;
      let lastServerNow = null;
      let sameServerSecondIndex = 0;

      const pushPollLog = (entry) => {
        pollLogs.push(entry);
      };

      const getDerivedTiming = () => {
        const oneEntries = pollLogs.filter((x) => x.phase === "one");
        const actualZero = pollLogs.find((x) => x.phase === "actual-zero");
        const ready = pollLogs.find((x) => x.phase === "ready");
        const lastOne = oneEntries.at(-1);

        return {
          firstOneLocalNow: oneEntries[0]?.localNow ?? null,
          lastOneLocalNow: lastOne?.localNow ?? null,
          actualZeroLocalNow: actualZero?.localNow ?? null,
          readyLocalNow: ready?.localNow ?? null,

          firstOneDiff: oneEntries[0]?.diff ?? null,
          lastOneDiff: lastOne?.diff ?? null,
          actualZeroDiff: actualZero?.diff ?? null,
          readyDiff: ready?.diff ?? null,

          lastOneToActualZeroMs:
            lastOne && actualZero
              ? actualZero.localNow - lastOne.localNow
              : null,

          actualZeroToReadyMs:
            actualZero && ready ? ready.localNow - actualZero.localNow : null,

          lastOneToReadyMs:
            lastOne && ready ? ready.localNow - lastOne.localNow : null,
        };
      };

      async function fetchDetailsOnce(attempt) {
        const requestStartsAt = Date.now();

        try {
          const r = await fetch(`/referrals/details?_=${Date.now()}`, {
            method: "POST",
            headers: {
              ...globMedHeaders,
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
            body: JSON.stringify({ idReferral: referralId }),
            cache: "no-store",
            credentials: "include",
          });

          const localNow = Date.now();
          const rtt = localNow - requestStartsAt;

          if (!r?.ok) {
            return {
              ok: false,
              reason: `HTTP ${r.status}`,
              localNow,
              serverNow: null,
              totalMsLeft: -1,
              rtt,
            };
          }

          const serverDateRaw = r.headers.get("Date");
          const serverNow = serverDateRaw
            ? new Date(serverDateRaw).getTime()
            : null;

          const diff = serverNow ? localNow - serverNow : null;

          const gapFromPreviousPollMs = lastPollLocalNow
            ? requestStartsAt - lastPollLocalNow
            : null;

          if (serverNow === lastServerNow) {
            sameServerSecondIndex += 1;
          } else {
            sameServerSecondIndex = 1;
            lastServerNow = serverNow;
          }

          lastPollLocalNow = localNow;

          const j = await r.json().catch(() => null);
          const { canTakeAction, canUpdate, status, message } = j?.data ?? {};

          let totalMsLeft = -1;

          if (message) {
            const match = message.match(
              /(\d+)\s*(?:minute(?:\(s\))?|mins?|min)\s+and\s+(\d+)\s*(?:second(?:\(s\))?|secs?|sec)/,
            );

            if (!match) {
              return {
                ok: false,
                reason: "unparsed-message",
                message,
                serverDateRaw,
                serverNow,
                localNow,
                totalMsLeft,
                rtt,
              };
            }

            const minsLeft = parseInt(match[1], 10) || 0;
            const secsLeft = parseInt(match[2], 10) || 0;

            totalMsLeft = minsLeft * 60_000 + secsLeft * 1_000;

            const baseLog = {
              attempt,
              requestStartsAt,
              responseReceivedAt: localNow,
              serverDateRaw,
              serverNow,
              localNow,
              diff,
              rtt,
              gapFromPreviousPollMs,
              sameServerSecondIndex,
              totalMsLeft,
              message,
            };

            if (totalMsLeft === 1000) {
              loopCountWhenSecondIsOne += 1;

              pushPollLog({
                phase: "one",
                ...baseLog,
              });
            }

            if (totalMsLeft === 0 && !onZeroSecondCalled && fnName) {
              await window[fnName]?.();
              onZeroSecondCalled = true;
              zeroSeenAt = serverNow || localNow;

              if (loopCountWhenSecondIsOne) {
                pushPollLog({
                  phase: "actual-zero",
                  ...baseLog,
                });
              }
            }
          }

          const ok =
            Boolean(canTakeAction && canUpdate && status === "P") && !message;

          if (ok) {
            if (!onZeroSecondCalled && fnName) {
              await window[fnName]?.();
              onZeroSecondCalled = true;
              zeroSeenAt = serverNow || localNow;
            }

            if (loopCountWhenSecondIsOne) {
              pushPollLog({
                phase: "ready",
                attempt,
                requestStartsAt,
                responseReceivedAt: localNow,
                serverDateRaw,
                serverNow,
                localNow,
                diff,
                rtt,
                gapFromPreviousPollMs,
                sameServerSecondIndex,
                totalMsLeft,
                message: null,
              });
            }

            readySeenAt = serverNow || localNow;
            readySeenAtLocalMs = localNow;
          }

          return {
            ok,
            reason: ok ? "ready" : "not-ready",
            message: message || null,
            serverDateRaw,
            serverNow,
            localNow,
            totalMsLeft,
            rtt,
          };
        } catch (error) {
          return {
            ok: false,
            reason: error?.name || "err in catch",
            errorMessage: error?.message || String(error),
            serverNow: null,
            localNow: null,
            totalMsLeft: -1,
            rtt: null,
          };
        }
      }

      const getPollDelay = (totalMsLeft) => {
        if (totalMsLeft <= 1000) return 0;
        if (totalMsLeft <= 3000) return 75;
        if (totalMsLeft <= 10000) return 165;
        return 500;
      };

      const tStart = performance.now();
      let attempts = 0;

      while (true) {
        attempts += 1;

        const { totalMsLeft, ok, localNow, message, rtt } =
          await fetchDetailsOnce(attempts);

        if (ok) {
          return {
            isOk: true,
            reason: "ready",
            message,
            elapsedMs: Math.round(performance.now() - tStart),
            attempts,
            claimableLocalTime: localNow,
            zeroSeenAt,
            readySeenAt,
            rtt,
            extraBackendDelayMs:
              zeroSeenAt && readySeenAt ? readySeenAt - zeroSeenAt : null,
            readySeenAtLocalMs,
            leftTimeWhenLastSecondsCalled,
            loopCountWhenSecondIsOne,
            timingSummary: getDerivedTiming(),
            timesWhenOneSecondStartedAndEnded: pollLogs,
          };
        }

        const delay = getPollDelay(totalMsLeft);

        if (delay > 0) {
          await sleep(delay);
        }
      }
    },
    {
      globMedHeaders,
      referralId,
      fnName,
      onLastSecondsFnName,
    },
  );
}

export default waitUntilCanTakeActionByWindow;
