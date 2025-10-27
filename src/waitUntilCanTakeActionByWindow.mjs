/*
 *
 * Helper: `waitUntilCanTakeActionByWindow`.
 *
 */
import { globMedHeaders } from "./constants.mjs";

async function waitUntilCanTakeActionByWindow({
  page,
  idReferral,
  remainingMs,
  reqTimeoutMs = 2000,
  minGapMs = 250,
  safetyMs = 80,
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
        const timer = setTimeout(() => ctrl.abort(), timeoutMs);

        try {
          const r = await fetch(
            // cache-buster ensures fresh response
            `https://referralprogram.globemedsaudi.com/referrals/details?_=${Date.now()}`,
            {
              method: "POST",
              headers: { ...globMedHeaders, "Cache-Control": "no-store" },
              body: JSON.stringify({ idReferral: id }),
              cache: "no-store",
              signal: ctrl.signal,
              credentials: "include", // more robust than 'same-origin'
            }
          );

          const rtt = performance.now() - t0;

          if (!r.ok) {
            // small backoff on 429/503, etc.
            if (r.status === 429 || r.status === 503) {
              await new Promise((res) => setTimeout(res, 300));
            }
            return { ok: false, rtt, status: r.status };
          }

          const j = await r.json().catch(() => null);
          const { canTakeAction, canUpdate, status } = j?.data ?? {};
          const ok = !!canTakeAction && !!canUpdate && status === "P";
          console.log(
            `fetchDetailsOnce idReferral=${id} => ok=${ok}, status=${status}, canTakeAction=${canTakeAction}, canUpdate=${canUpdate}`
          );
          return { ok, rtt, status: 200 };
        } catch (e) {
          console.log(`fetchDetailsOnce idReferral=${id} => error`, e);
          return {
            ok: false,
            rtt: performance.now() - t0,
            status: 0,
            error: e,
          };
        } finally {
          clearTimeout(timer);
        }
      }

      if (remainingMs <= 0) return false;
      const deadline = performance.now() + remainingMs;
      let estRTT = 400;

      while (true) {
        const now = performance.now();
        if (deadline - now <= safetyMs) return true;

        const timeLeft = deadline - now - safetyMs;
        const thisReqTimeout = Math.min(
          reqTimeoutMs,
          Math.max(minGapMs, timeLeft)
        );

        const { ok, rtt } = await fetchDetailsOnce(idReferral, thisReqTimeout);

        estRTT = Math.min(Math.max(rtt, 150), 3000);

        if (ok) return true;

        const tLeft = deadline - performance.now();

        let gap =
          tLeft > 8000
            ? 1000
            : tLeft > 5000
            ? 800
            : tLeft > 3000
            ? 600
            : tLeft > 1500
            ? 400
            : 300;

        // avoid overlap & respect remaining time
        gap = Math.max(gap, Math.ceil(estRTT * 1.25), minGapMs);
        gap = Math.min(gap, Math.max(minGapMs, tLeft - safetyMs));

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
