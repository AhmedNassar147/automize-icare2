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
  safetyMs = 90, // keep polling until last 30ms
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
      let estRTT = 300; // updated by real calls

      const jitter = (ms, p = 0.08) =>
        Math.max(0, Math.floor(ms * (1 - p + Math.random() * 2 * p)));

      // Gap schedule tuned for short windows (keeps polling until last 30ms)
      function computeGap(tLeft) {
        if (tLeft > 3000) return 450;
        if (tLeft > 2000) return 350;
        if (tLeft > 1200) return 280;
        if (tLeft > 700) return 220;
        if (tLeft > 300) return 180;
        return 140; // last 300ms before the 30ms cutoff
      }

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

        const { ok, rtt, reason } = await fetchDetailsOnce(
          idReferral,
          thisReqTimeout
        );
        if (Number.isFinite(rtt)) estRTT = Math.min(Math.max(rtt, 90), 2000);

        if (ok) return { isOk: true, reason: `ready (${reason})` };

        // Compute next gap; avoid overlap vs RTT; don’t overshoot into last 30ms
        const tLeftNow = deadline - performance.now();
        let gap = computeGap(tLeftNow);
        gap = Math.max(gap, Math.ceil(estRTT * 1.2), minGapMs);
        gap = Math.min(gap, Math.max(minGapMs, tLeftNow - safetyMs));
        gap = jitter(gap, 0.08);

        if (gap <= 0) continue;
        await new Promise((res) => setTimeout(res, gap));
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
