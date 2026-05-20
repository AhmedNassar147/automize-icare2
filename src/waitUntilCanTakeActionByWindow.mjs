/*
 * Helper: waitUntilCanTakeActionByWindow (poll until last 30ms)
 */
import { globMedHeaders } from "./constants.mjs";

async function waitUntilCanTakeActionByWindow({
  page,
  referralId,
  onZeroSecond,
}) {
  let fnName = null;

  if (onZeroSecond) {
    fnName = `onZeroSecond_${Date.now()}`;
    await page.exposeFunction(fnName, onZeroSecond);
  }

  return await page.evaluate(
    async ({ globMedHeaders, referralId, fnName }) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      let onZeroSecondCalled = false;
      let zeroSeenAt = 0;
      let readySeenAt = 0;
      let readySeenAtLocalMs = 0;

      async function fetchDetailsOnce() {
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

          if (!r?.ok)
            return {
              ok: false,
              reason: `HTTP ${r.status}`,
            };

          // 🕒 Read server time from response header
          const serverDate = r.headers.get("Date");
          const serverNow = serverDate ? new Date(serverDate).getTime() : null;

          const j = await r.json().catch(() => null);
          const { canTakeAction, canUpdate, status, message } = j?.data ?? {};

          let totalMsLeft = -1;

          if (message) {
            const match = message.match(
              /(\d+)\s*(?:minute(?:\(s\))?|mins?|min)\s+and\s+(\d+)\s*(?:second(?:\(s\))?|secs?|sec)/,
            );

            const minsLeft = parseInt(match?.[1], 10) || 0;
            const secsLeft = parseInt(match?.[2], 10) || 0;

            totalMsLeft = minsLeft * 60_000 + secsLeft * 1_000;

            if (totalMsLeft === 0 && !onZeroSecondCalled && fnName) {
              await window[fnName]?.();
              onZeroSecondCalled = true;
              zeroSeenAt = serverNow || localNow;
            }
          }

          const ok =
            !!(canTakeAction && canUpdate && status === "P") && !message;

          if (ok) {
            if (!onZeroSecondCalled && fnName) {
              await window[fnName]?.();
              onZeroSecondCalled = true;
              zeroSeenAt = serverNow || localNow;
            }

            readySeenAt = serverNow || localNow;
            readySeenAtLocalMs = localNow;
          }

          return {
            ok,
            reason: ok ? "ready" : "not-ready",
            message: message || null,
            serverNow,
            localNow,
            totalMsLeft,
          };
        } catch (e) {
          return {
            ok: false,
            reason: e?.name || "err in catch",
            serverNow: null,
            localNow: null,
          };
        }
      }

      const getPollDelay = (totalMsLeft) => {
        if (totalMsLeft <= 1000) return 0;
        if (totalMsLeft <= 3000) return 75;
        if (totalMsLeft <= 10000) return 150;
        return 500;
      };

      const tStart = performance.now();
      let attempts = 0;

      while (true) {
        attempts++;

        const { totalMsLeft, ok, localNow, message } = await fetchDetailsOnce();

        if (ok) {
          return {
            isOk: true,
            reason: "ready",
            message: message,
            elapsedMs: Math.round(performance.now() - tStart),
            attempts,
            claimableLocalTime: localNow,
            zeroSeenAt,
            readySeenAt,
            extraBackendDelayMs:
              zeroSeenAt && readySeenAt ? readySeenAt - zeroSeenAt : null,
            readySeenAtLocalMs,
          };
        }

        await sleep(getPollDelay(totalMsLeft));
      }
    },
    {
      globMedHeaders,
      referralId,
      fnName,
    },
  );
}

export default waitUntilCanTakeActionByWindow;
