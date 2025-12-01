/*
 *
 * Helper: `isAcceptanceButtonShown`.
 *
 */
import { globMedHeaders } from "./constants.mjs";

const isAcceptanceButtonShown = ({
  page,
  idReferral,
  remainingMs,
  reqTimeoutMs = 650,
  minTimeoutMs = 120,
  rttPadMs = 60,
}) =>
  page.evaluate(
    async ({
      idReferral,
      remainingMs,
      globMedHeaders,
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
          const ok = !!(canTakeAction && canUpdate && status === "P");
          const isReadyByTime = false;

          return {
            ok,
            rtt,
            reason: ok ? "ready" : "not-ready",
            message,
            isReadyByTime,
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

        const { ok, reason, message, rtt, isReadyByTime } =
          await fetchDetailsOnce(idReferral, expected);

        if (ok) {
          return {
            isOk: true,
            reason: `ready (${reason}) attempts=${attempts}`,
            message,
            elapsedMs: Math.round(performance.now() - tStart),
            isReadyByTime,
          };
        }

        if (rtt) {
          const clamped = Math.min(Math.max(rtt, minTimeoutMs), reqTimeoutMs);
          emaRtt = ALPHA * clamped + (1 - ALPHA) * emaRtt;
        }
      }
    },
    {
      idReferral,
      remainingMs,
      reqTimeoutMs,
      minTimeoutMs,
      rttPadMs,
      globMedHeaders,
    }
  );

export default isAcceptanceButtonShown;
