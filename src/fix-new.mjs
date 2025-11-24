// ==UserScript==
// @name         GlobeMed scripts
// @namespace    gm.rp.helper
// @version      3.2
// @description  help user.
// @match        https://referralprogram.globemedsaudi.com/*
// @run-at       document-start
// @noframes
// @grant        none
// ==/UserScript==

(function () {
  "use strict";

  let cashedFile = null;
  let actionButtonCalled = false;
  let scrollableElm = null;

  const globMedHeaders = {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "X-CSRF": "1",
  };

  const LOG = (...a) => console.log("[GM details]", ...a);
  const ERR = (...a) => console.error("[GM details]", ...a);

  const CONFIG = {
    fileInputSelector: '#upload-single-file input[type="file"]',
    waitElmMs: 8000,
    waitStateMs: 120,
    pollStepMs: 5,

    waitTableMs: 15000,
    reconnect: { start: 600, max: 10000 },
    keepAliveMs: 25000,
    gmsColOrder: 2,
    WS_URL: "wss://localhost:8443/",
    upperSectionItemOrder: 3, //  3 confirmed, 2 accepted, 1 pending
    dashboardLinkSelector: 'a[href="/dashboard/referral"] button',
  };

  function normalize(str) {
    return (str || "").trim();
  }

  async function waitForElm(
    selector,
    timeoutMs = CONFIG.waitElmMs,
    all = false
  ) {
    const existing = all
      ? document.querySelectorAll(selector)
      : document.querySelector(selector);
    if (all ? existing && existing.length : existing) return existing;

    return new Promise((resolve) => {
      let timerId = null;

      const done = (result) => {
        if (timerId) clearTimeout(timerId);
        mo.disconnect();
        resolve(result);
      };

      const mo = new MutationObserver(() => {
        const el = all
          ? document.querySelectorAll(selector)
          : document.querySelector(selector);
        if (all ? el && el.length : el) done(el);
      });

      mo.observe(document.documentElement || document, {
        childList: true,
        subtree: true,
      });

      if (timeoutMs) {
        timerId = setTimeout(() => {
          done(
            all
              ? document.querySelectorAll(selector)
              : document.querySelector(selector)
          );
        }, timeoutMs);
      }
    });
  }

  function base64ToFile(base64Str, fileName, mime = "application/pdf") {
    if (!base64Str) {
      LOG("empty base64");
      return;
    }

    let bin;

    try {
      bin = atob(base64Str);
    } catch {
      LOG("invalid base64");
    }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    return new File([blob], fileName || "upload.pdf", { type: blob.type });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function chooseOption() {
    let trigger = await waitForElm('div[role="combobox"]', 3000);
    let controlId;

    if (!trigger) {
      const label = await waitForElm("label.MuiInputLabel-root", 3000);

      if (!label) {
        return false;
      }

      controlId = label.getAttribute("for");
      trigger = document.getElementById(controlId);
    }

    if (!trigger) {
      return false;
    }

    trigger.focus();

    trigger.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        code: "ArrowDown",
        keyCode: 40,
        which: 40,
        bubbles: true,
        cancelable: true,
      })
    );

    await sleep(4 + Math.random() * 4);

    const listbox = await waitForElm('[id^="menu-"] [role="listbox"]');

    let optionName = "Acceptance";

    const index = optionName === "Acceptance" ? 1 : 2;
    await sleep(2 + Math.random() * 4);
    const li = listbox.querySelector(`li[role="option"]:nth-child(${index})`);

    li?.click?.();

    return true;
  }

  async function setHiddenFileInput() {
    const selector = '#upload-single-file input[type="file"]';

    let input =
      document.querySelector(selector) || (await waitForElm(selector, 3000));

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
    const rows = await waitForElm(
      "table.MuiTable-root tbody tr",
      CONFIG.waitElmMs,
      true
    );
    if (!rows?.length) {
      return null;
    }

    const target = normalize(String(referralId));
    const colIndex = CONFIG.gmsColOrder;

    const spans = document.querySelectorAll(
      `table.MuiTable-root tbody tr td:nth-of-type(${colIndex}) span`
    );

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
      const { message, canTakeAction, canUpdate, status } = j?.data ?? {};
      const ok = !!canTakeAction && !!canUpdate && status === "P";
      return { ok, rtt, reason: ok ? "ready" : "not-ready", message };
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

      const { ok, reason, message, rtt } = await fetchDetailsOnce(
        idReferral,
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
  };

  async function clickDashboardRow(patient) {
    if (actionButtonCalled) {
      return;
    }

    actionButtonCalled = true;

    const wrapper = document.querySelector("[secondarysidebar]");
    scrollableElm = wrapper?.children[1];

    if (!wrapper) {
      ERR("[dash] [secondarysidebar] wrapper not found");
    }

    const { referralId, referralEndTimestamp, acceptanceFileBase64 } = patient;

    const iconButton = await findRowByReferralId(referralId);

    if (!iconButton) {
      return;
    }

    const fileName = `accept-${referralId}.pdf`;

    cashedFile = base64ToFile(acceptanceFileBase64, fileName);

    // const remainingMs = referralEndTimestamp - Date.now();

    // const { elapsedMs, reason, message } = await isAcceptanceButtonShown({
    //   idReferral: referralId,
    //   remainingMs,
    // });

    iconButton.click();

    // console.log(
    //   `referralId=${referralId} remainingMs=${remainingMs} reason=${reason} elapsedMs=${elapsedMs} message=${
    //     typeof message === "string" ? message : "no-message"
    //   }`
    // );
  }

  async function runIfDashboardPage() {
    if (!/^\/dashboard\/referral/i.test(location.pathname.toLowerCase())) {
      return;
    }

    let ws = null;
    let wsConnecting = false;
    let kaTimer = null;
    let backoff = CONFIG.reconnect.start;

    function stopKA() {
      if (kaTimer) {
        clearInterval(kaTimer);
        kaTimer = null;
      }
    }

    function startKA() {
      stopKA();
      kaTimer = setInterval(() => {
        try {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('{"type":"ping"}');
          }
        } catch {}
      }, CONFIG.keepAliveMs);
    }

    function scheduleReconnect() {
      stopKA();
      setTimeout(connectWS, backoff);
      backoff = Math.min(
        CONFIG.reconnect.max,
        backoff * 2 || CONFIG.reconnect.start
      );
    }

    function connectWS() {
      if (ws && ws.readyState === WebSocket.OPEN) return;
      if (wsConnecting) return;
      wsConnecting = true;

      try {
        ws = new WebSocket(CONFIG.WS_URL);
      } catch (e) {
        wsConnecting = false;
        ERR("[dash] WS ctor failed:", e?.message || e);
        return scheduleReconnect();
      }

      ws.addEventListener("open", () => {
        wsConnecting = false;
        backoff = CONFIG.reconnect.start;
        startKA();
      });

      ws.addEventListener("message", async (ev) => {
        let msg;
        try {
          msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;

        if (msg.type === "accept" && msg.data && msg.data.referralId) {
          const p = msg.data;

          try {
            await clickDashboardRow(p);
          } catch (e) {
            ERR("[dash] clickDashboardRow failed:", e?.message || e);
          }
        }
      });

      ws.addEventListener("close", () => {
        wsConnecting = false;
        scheduleReconnect();
      });

      ws.addEventListener("error", (e) => {
        ERR("[dash] WS error:", e?.message || e);
        try {
          ws.close();
        } catch {}
      });
    }

    connectWS();
  }

  // let lastRunKey = ""; // pathname|patientId
  let lastPidHint = null;

  async function runIfOnDetails(pidHint) {
    if (!/^\/referral\/details/i.test(location.pathname)) {
      return;
    }
    const t0 = Date.now();

    if (cashedFile) {
      await chooseOption();

      scrollableElm.scrollTo(0, 2000);
      await setHiddenFileInput();

      actionButtonCalled = false;
      window.localStorage.setItem(
        "TM_took",
        `${Date.now() - t0}, ${!!scrollableElm}`
      );
    }
  }

  (function installRouteHooks() {
    const emit = (pid) => {
      try {
        lastPidHint = pid || null;
        const ev = new CustomEvent("gm:locationchange", {
          detail: { patientId: pid || null },
        });
        window.dispatchEvent(ev);
      } catch {}
    };

    const wrap = (orig) =>
      function (state, title, url) {
        const rv = orig.apply(this, arguments);
        let pid = null;
        try {
          pid =
            state &&
            state.usr &&
            (state.usr.idReferral ?? state.usr.referralId);
        } catch {}
        emit(pid != null ? String(pid) : "#val");
        return rv;
      };

    try {
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
      addEventListener("popstate", () => {
        let pid = null;
        try {
          const s = history.state;
          pid = s && s.usr && (s.usr.idReferral ?? s.usr.referralId);
        } catch {}
        emit(pid != null ? String(pid) : null);
      });
    } catch {}
  })();

  addEventListener("gm:locationchange", (e) => {
    runIfOnDetails(e.detail?.patientId || null).catch(ERR);
    runIfDashboardPage(e.detail).catch(ERR);
  });
  addEventListener("DOMContentLoaded", () => {
    runIfOnDetails(null).catch(ERR);
    runIfDashboardPage().catch(ERR);
  });
  addEventListener("pageshow", () => {
    runIfOnDetails(null).catch(ERR);
    runIfDashboardPage().catch(ERR);
  });
  runIfOnDetails(null).catch(ERR);
  runIfDashboardPage().catch(ERR);
})();
