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
      const buttonId = "Speak";

      const btn = document.createElement("button");
      btn.innerText = buttonId;
      btn.id = buttonId;
      btn.onclick = () => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume?.();

        const o = ctx.createOscillator();
        const g = ctx.createGain();

        o.type = "sine";
        o.frequency.value = 880;
        g.gain.value = 0.3;

        o.connect(g);
        g.connect(ctx.destination);

        const startAt = ctx.currentTime;
        const duration = 0.2;

        o.start(startAt);
        o.stop(startAt + duration);
      };
      document.body.appendChild(btn);

      if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
        btn.click();
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
            reason: e?.name || "err in catch",
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
          btn.click();

          return {
            isOk: true,
            reason: "ready",
            message: result.message,
            elapsedMs: Math.round(performance.now() - tStart),
            attempts,
          };
        }

        if (attempts % 7 === 0) {
          await sleep(1);
        }
      }
    },
    {
      globMedHeaders,
      referralId,
      remainingMs,
    }
  );
}

export default waitUntilCanTakeActionByWindow;
