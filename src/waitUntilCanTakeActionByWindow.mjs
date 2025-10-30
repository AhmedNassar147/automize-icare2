/*
 * Helper: waitUntilCanTakeActionByWindow (poll until last 30ms)
 */
import { globMedHeaders } from "./constants.mjs";

async function waitUntilCanTakeActionByWindow({
  page,
  idReferral,
  remainingMs, // e.g. 4000
  reqTimeoutMs = 1200, // cap per request (will be clamped by time left)
  minGapMs = 120, // never poll faster than this
  safetyMs = 100, // keep polling until last 100ms
}) {
  return await page.evaluate(
    async ({
      idReferral,
      remainingMs,
      reqTimeoutMs,
      minGapMs,
      safetyMs,
      globMedHeaders,
    }) => {
      async function fetchDetailsOnce(id, timeoutMs) {
        const ctrl = new AbortController();
        const t0 = performance.now();
        const timer = setTimeout(() => ctrl.abort(), Math.max(50, timeoutMs));
        try {
          const r = await fetch(`/referrals/details?_=${Date.now()}`, {
            method: "POST",
            headers: { ...globMedHeaders, "Cache-Control": "no-store" },
            body: JSON.stringify({ idReferral: id }),
            cache: "no-store",
            credentials: "include",
            signal: ctrl.signal,
          });
          const rtt = performance.now() - t0;
          if (!r.ok) return { ok: false, rtt, reason: `HTTP ${r.status}` };
          const j = await r.json().catch(() => null);
          const d = j?.data ?? {};
          const ok = !!d.canTakeAction && !!d.canUpdate && d.status === "P";
          return { ok, rtt, reason: ok ? "ready" : "not-ready" };
        } catch (e) {
          return {
            ok: false,
            rtt: performance.now() - t0,
            reason: e?.name || "err",
          };
        } finally {
          clearTimeout(timer);
        }
      }

      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        return { isOk: true, reason: `invalid remainingMs=${remainingMs}` };
      }

      const deadline = performance.now() + remainingMs;

      const jitter = (ms, p = 0.08) =>
        Math.max(0, Math.floor(ms * (1 - p + Math.random() * 2 * p)));

      const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

      while (true) {
        const now = performance.now();
        const remain = deadline - now;

        // Keep polling until we’re inside the last 30ms window
        if (remain <= safetyMs) {
          // // Last-chance fire only if budget plausibly fits (based on measured RTT)
          // const budget = remain - 8; // tiny guard
          // if (budget > 50 && estRTT < budget) {
          //   const { ok } = await fetchDetailsOnce(idReferral, budget);
          //   return {
          //     isOk: !!ok,
          //     reason: ok
          //       ? "final-shot:ready"
          //       : `final-shot:timeout (budget=${Math.floor(budget)}ms)`,
          //   };
          // }

          await sleep(10);

          return {
            isOk: true,
            reason: `time-up (remain=${Math.floor(remain)}ms)`,
          };
        }

        // Ensure the request can complete before the last-30ms cutoff
        const timeLeft = remain - safetyMs;
        const thisReqTimeout = Math.min(
          reqTimeoutMs,
          Math.max(minGapMs, timeLeft - 12)
        );

        const { ok, reason } = await fetchDetailsOnce(
          idReferral,
          thisReqTimeout
        );

        if (ok) {
          return { isOk: true, reason: `ready (${reason})` };
        }

        const sleepTime = jitter(65);
        await sleep(sleepTime);
      }
    },
    {
      idReferral,
      remainingMs,
      reqTimeoutMs,
      minGapMs,
      safetyMs,
      globMedHeaders,
    }
  );
}

export default waitUntilCanTakeActionByWindow;
