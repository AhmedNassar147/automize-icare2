/*
 * Helper: waitUntilCanTakeActionByWindow
 * Polls in the window context until the referral becomes actionable.
 * Infinite loop by design; rely on outer timeouts to stop it.
 */
import { globMedHeaders } from "./constants.mjs";

async function waitUntilCanTakeActionByWindow({
  page,
  referralId,
  remainingMs,
}) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return {
      isOk: true,
      reason: "invalid-remaining-ms",
      message: null,
      elapsedMs: 0,
      attempts: 0,
    };
  }

  return await page.evaluate(
    async ({ globMedHeaders, referralId }) => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      async function fetchDetailsOnce(id) {
        try {
          const r = await fetch(`/referrals/details?_=${Date.now()}`, {
            method: "POST",
            headers: {
              ...globMedHeaders,
              "Cache-Control": "no-store",
              Pragma: "no-cache",
            },
            body: JSON.stringify({ idReferral: id }),
            cache: "no-store",
            credentials: "include",
          });

          if (!r.ok) {
            return {
              ok: false,
              reason: `http-${r.status}`,
              message: null,
            };
          }

          const j = await r.json().catch(() => null);
          const { canTakeAction, canUpdate, status, message } = j?.data ?? {};

          const ok = !!(canTakeAction && canUpdate && status === "P");

          return {
            ok,
            reason: ok ? "ready" : "not-ready",
            message: message || null,
          };
        } catch (e) {
          return {
            ok: false,
            reason: "network-error",
            message: e?.message || null,
          };
        }
      }

      const tStart = performance.now();

      let attempts = 0;

      while (true) {
        attempts++;

        const result = await fetchDetailsOnce(referralId);
        const elapsedMs = Math.round(performance.now() - tStart);

        if (result.ok) {
          return {
            isOk: true,
            reason: "ready",
            message: result.message,
            elapsedMs,
            attempts,
          };
        }

        // Not ready yet; keep polling.
        // Very light throttle: short sleep every 7 attempts.
        if (attempts % 7 === 0) {
          await sleep(3);
        }
      }
    },
    {
      globMedHeaders,
      referralId,
    }
  );
}

export default waitUntilCanTakeActionByWindow;
