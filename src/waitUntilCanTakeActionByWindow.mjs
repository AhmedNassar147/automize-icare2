/*
 * Helper: waitUntilCanTakeActionByWindow (poll until last 30ms)
 */
import { globMedHeaders } from "./constants.mjs";

async function waitUntilCanTakeActionByWindow({
  page,
  referralId,
  remainingMs,
}) {
  return await page.evaluate(
    async ({ globMedHeaders, referralId, remainingMs }) => {
      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return {
          isOk: true,
          reason: `invalid remainingMs=${remainingMs}`,
          elapsedMs: 0,
          attempts: 0,
        };
      }

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

          if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };

          // 🕒 Read server time from response header
          const localNow = Date.now();
          const serverDate = r.headers.get("Date");
          const serverNow = serverDate ? new Date(serverDate).getTime() : null;

          const j = await r.json().catch(() => null);
          const { canTakeAction, canUpdate, status, message } = j?.data ?? {};

          const ok =
            !!(canTakeAction && canUpdate && status === "P") && !message;

          return {
            ok,
            reason: ok ? "ready" : "not-ready",
            message: message || null,
            serverNow,
            localNow,
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

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      const tStart = performance.now();
      let attempts = 0;

      while (true) {
        attempts++;

        const result = await fetchDetailsOnce();

        if (result.ok) {
          return {
            isOk: true,
            reason: "ready",
            message: result.message,
            elapsedMs: Math.round(performance.now() - tStart),
            attempts,
            claimableServerTime: result.serverNow,
            claimableLocalTime: result.localNow,
          };
        }

        if (attempts % 6 === 0) {
          await sleep(0);
        }
      }
    },
    {
      globMedHeaders,
      referralId,
      remainingMs,
    },
  );
}

export default waitUntilCanTakeActionByWindow;
