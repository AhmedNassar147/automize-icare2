// contentScript.js
(() => {
  "use strict";

  console.log("Hello browser");

  let styleInjected = false;
  const NO_ANIM_STYLE_ID = "disable-animations";

  function injectNoAnimStyle() {
    try {
      const s = document.createElement("style");
      s.id = NO_ANIM_STYLE_ID;
      s.textContent = `
        * {
          transition: none !important;
          animation: none !important;
        }

        section.referral-button-container {
          position: absolute !important;
          top: 845px !important;
          right: 8% !important;
          width: 100% !important;
          transform: translateZ(0) !important;
          will-change: transform !important;
          z-index: 9999 !important;
          pointer-events: auto !important;
          background-color: green !important;
        }
      `;
      document?.head?.appendChild(s);
      // styleInjected = true;
    } catch (e) {
      // ignore
      console.warn("[GM-ext] failed to inject no-animation style", e);
    }
  }

  let cashedFile = null;
  let actionButtonCalled = false;

  const globMedHeaders = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "X-CSRF": "1",
  };

  const LOG = (...a) => console.log("[GM details]", ...a);
  const ERR = (...a) => console.error("[GM details]", ...a); // Keep errors in the content script console for immediate debugging

  const CONFIG = {
    waitElmMs: 8000,
    waitTableMs: 15000,
    gmsColOrder: 2,
    upperSectionItemOrder: 3, //  3 confirmed, 2 accepted, 1 pending
    dashboardLinkSelector: 'a[href="/dashboard/referral"] button',
    uploadInputSelector: '#upload-single-file input[type="file"]',
  };

  const optionName = "Acceptance";
  const optionIndex = optionName === "Acceptance" ? 1 : 2;

  const normalize = (str) => (str || "").trim();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const waitForElmFast = (selector, all = false) =>
    new Promise((r) => {
      const c = () => {
        const e = all
          ? document.querySelectorAll(selector)
          : document.querySelector(selector);
        if (e && (all ? e.length : e)) r(e);
        else requestAnimationFrame(c);
      };
      c();
    });

  async function chooseOption(trigger) {
    if (!trigger) {
      ERR("No trigger found");
      return false;
    }

    ["mousedown", "mouseup"].forEach((type) => {
      trigger.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
        })
      );
    });

    const directLi = await waitForElmFast(
      `[id^="menu-"] [role="listbox"] li[role="option"]:nth-child(${optionIndex})`
    );
    directLi?.click?.();
  }

  function base64ToFile(base64Str, fileName, mime = "application/pdf") {
    if (!base64Str) {
      LOG("empty base64");
      return null;
    }

    let raw = base64Str;
    const comma = base64Str.indexOf(",");
    if (comma >= 0) raw = base64Str.slice(comma + 1);

    let bin;
    try {
      bin = atob(raw);
    } catch {
      LOG("invalid base64");
      return null;
    }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return new File([blob], fileName || "upload.pdf", { type: blob.type });
  }

  async function uploadFile() {
    let input = document.querySelector(CONFIG.uploadInputSelector);

    if (!input) {
      return false;
    }

    const dt = new DataTransfer();
    dt.items.add(cashedFile);
    input.files = dt.files;
    ["input", "change"].forEach((type) => {
      input.dispatchEvent(
        new Event(type, { bubbles: true, cancelable: true, composed: true })
      );
    });

    return true;
  }

  async function findRowByReferralId(referralId) {
    const colIndex = CONFIG.gmsColOrder;

    const spans = await waitForElmFast(
      `table.MuiTable-root tbody tr td:nth-of-type(${colIndex}) span`,
      true
    );
    if (!spans?.length) {
      return null;
    }

    const target = normalize(String(referralId));

    for (const span of spans) {
      const txt = normalize(span.textContent || "");
      if (!txt) continue;

      if (txt === target) {
        const row = span.closest("tr");
        if (!row) continue;

        const iconButton = row.querySelector("td.iconCell button");
        return iconButton ?? null;
      }
    }

    return null;
  }

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
      const { canTakeAction, canUpdate, status } = j?.data ?? {};
      let ok = !!(canTakeAction && canUpdate && status === "P");

      return {
        ok,
        rtt,
        reason: ok ? "ready" : "not-ready",
        message: j?.data?.message || null,
      };
    } catch (e) {
      const rtt = performance.now() - t0;
      const isAbort = e?.name === "AbortError";
      return { ok: false, rtt, reason: isAbort ? "timeout" : e?.name || "err" };
    } finally {
      clearTimeout(timer);
    }
  }

  const isAcceptanceButtonShown = async ({
    idReferral,
    remainingMs, // informational only
    reqTimeoutMs = 650,
    minTimeoutMs = 120,
    rttPadMs = 60,
    minYieldMs = 2,
    jitterPct = 0.02,
  }) => {
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
  };

  async function runIfOnDetails() {
    const t0 = Date.now();

    const selectTrigger = await waitForElmFast('div[role="combobox"]');

    if (selectTrigger && cashedFile) {
      await chooseOption(selectTrigger);
      await uploadFile();
      localStorage.setItem("TM", `${Date.now() - t0}ms`);
      cashedFile = null;
      actionButtonCalled = false;
    }
  }

  async function clickDashboardRow(patient) {
    if (actionButtonCalled) {
      return;
    }

    actionButtonCalled = true;

    const { referralId, referralEndTimestamp, acceptanceFileBase64, fileName } =
      patient;

    const _remainingMs = referralEndTimestamp - Date.now();

    const iconButton = await findRowByReferralId(referralId);

    if (!iconButton) {
      LOG(`[dash] Referral ID ${referralId} row not found. Aborting.`);
      actionButtonCalled = false;
      return;
    }

    if (!styleInjected) {
      injectNoAnimStyle();
    }

    cashedFile = base64ToFile(acceptanceFileBase64, fileName);

    const remainingMs = referralEndTimestamp - Date.now();

    const { elapsedMs, reason } = await isAcceptanceButtonShown({
      idReferral: referralId,
      remainingMs,
    });

    iconButton.click();

    try {
      await sleep(5);
      await runIfOnDetails();
    } catch (error) {
      console.error("runIfOnDetails failed:", error);
    } finally {
      LOG(
        `referralId=${referralId} remainingMsWhenReceived=${_remainingMs} remainingMs=${remainingMs} reason=${reason} elapsedMs=${elapsedMs}`
      );
    }
  }

  chrome.runtime.onMessage.addListener(async (request) => {
    if (request.type === "accept" && request.data) {
      LOG("Received 'accept' command from Service Worker.");
      try {
        await clickDashboardRow(request.data);
      } catch (e) {
        ERR("clickDashboardRow failed:", e?.message || e);
      }
    }
    // Returning true indicates that sendResponse will be called asynchronously,
    // but here we simply acknowledge the message for one-way communication.
    return false;
  });
})();
