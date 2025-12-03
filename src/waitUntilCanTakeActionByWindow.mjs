/*
 * Helper: waitUntilCanTakeActionByWindow (poll until last 30ms)
 */
import { globMedHeaders } from "./constants.mjs";

async function waitUntilCanTakeActionByWindow({
  page,
  referralId,
  remainingMs,
  reqTimeoutMs = 600,
  minTimeoutMs = 120,
  rttPadMs = 60,
}) {
  return await page.evaluate(
    async ({
      globMedHeaders,
      referralId,
      remainingMs,
      reqTimeoutMs,
      minTimeoutMs,
      rttPadMs,
    }) => {
      async function fetchDetailsOnce(id, timeoutMs) {
        const ctrl = new AbortController();
        const t0 = performance.now();
        const timer = setTimeout(() => ctrl.abort(), Math.max(20, timeoutMs));
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
            signal: ctrl.signal,
          });
          const rtt = performance.now() - t0;
          if (!r.ok) return { ok: false, rtt, reason: `HTTP ${r.status}` };

          const j = await r.json().catch(() => null);
          const { message, canTakeAction, canUpdate, status } = j?.data ?? {};
          let ok = !!(canTakeAction && canUpdate && status === "P");

          return {
            ok,
            rtt,
            reason: ok ? "ready" : "not-ready",
            message,
          };
        } catch (e) {
          const rtt = performance.now() - t0;
          const isAbort = e?.name === "AbortError";
          return {
            ok: false,
            rtt,
            reason: isAbort ? "timeout" : e?.name || "err",
          };
        } finally {
          clearTimeout(timer);
        }
      }

      const tStart = performance.now();

      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return {
          isOk: true,
          reason: `invalid remainingMs=${remainingMs}`,
          elapsedMs: 0,
          attempts: 0,
        };
      }

      let attempts = 0;

      // EMA seed
      const seedRtt = (navigator.connection?.rtt ?? 0) | 0;
      let emaRtt =
        seedRtt > 0
          ? Math.min(Math.max(minTimeoutMs, seedRtt), reqTimeoutMs)
          : Math.max(minTimeoutMs, 280);

      const ALPHA = 0.35;

      while (true) {
        const expected = Math.max(
          minTimeoutMs,
          Math.min(reqTimeoutMs, Math.round(emaRtt + rttPadMs))
        );
        attempts++;

        const { ok, reason, message, rtt } = await fetchDetailsOnce(
          referralId,
          expected
        );

        if (ok) {
          return {
            isOk: true,
            reason: `ready (${reason}) attempts=${attempts}`,
            message,
            elapsedMs: Math.round(performance.now() - tStart),
          };
        }

        if (rtt) {
          const clamped = Math.min(Math.max(rtt, minTimeoutMs), reqTimeoutMs);
          emaRtt = ALPHA * clamped + (1 - ALPHA) * emaRtt;
        }
      }
    },
    {
      globMedHeaders,
      referralId,
      remainingMs,
      reqTimeoutMs,
      minTimeoutMs,
      rttPadMs,
    }
  );
}

export default waitUntilCanTakeActionByWindow;
