// contentScript.js
(() => {
  "use strict";

  const LOG = (...a) => console.log("[GM details]", ...a);
  const ERR = (...a) => console.error("[GM details]", ...a); // Keep errors in the content script console for immediate debugging

  LOG("Hello browser");

  const NO_ANIM_STYLE_ID = "disable-animations";

  function injectNoAnimStyle() {
    try {
      if (document.getElementById(NO_ANIM_STYLE_ID)) return;

      const s = document.createElement("style");
      s.id = NO_ANIM_STYLE_ID;
      s.textContent = `
        * {
          transition: none !important;
          animation: none !important;
        }

        .referral-button-container {
          position: absolute !important;
          top: 85px !important;
          right: 8% !important;
          width: 100% !important;
          transform: translateZ(0) !important;
          will-change: transform !important;
          z-index: 9999 !important;
          pointer-events: auto !important;
        }
      `;
      document?.head?.appendChild(s);
    } catch (e) {
      LOG("[GM-ext] failed to inject no-animation style", e?.message || e);
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

  // function waitForElm(selector, options) {
  //   const { all, root, timeoutMs } = {
  //     all: false,
  //     root: document,
  //     timeoutMs: 8000,
  //     ...(options || null),
  //   };

  //   return new Promise((resolve) => {
  //     const initial = all
  //       ? root.querySelectorAll(selector)
  //       : root.querySelector(selector);

  //     if (initial && (all ? initial.length : initial)) {
  //       resolve(initial);
  //       return;
  //     }

  //     const observer = new MutationObserver(() => {
  //       const el = all
  //         ? root.querySelectorAll(selector)
  //         : root.querySelector(selector);

  //       if (el && (all ? el.length : el)) {
  //         observer.disconnect();
  //         resolve(el);
  //       }
  //     });

  //     observer.observe(root, { childList: true, subtree: true });

  //     if (typeof timeoutMs === "number") {
  //       setTimeout(() => {
  //         observer.disconnect();
  //         resolve(undefined);
  //       }, timeoutMs);
  //     }
  //   });
  // }

  // async function chooseOption(trigger) {
  //   ["mousedown", "mouseup"].forEach((type) => {
  //     trigger.dispatchEvent(
  //       new MouseEvent(type, {
  //         bubbles: true,
  //         cancelable: true,
  //         composed: true,
  //       })
  //     );
  //   });

  //   let directLi = await waitForElmFast(
  //     `[id^="menu-"] [role="listbox"] li[role="option"]:nth-child(${optionIndex})`
  //   );

  //   if (!directLi) {
  //     LOG("no direct li found");
  //     await sleep(2);
  //     directLi = await waitForElm(
  //       `[id^="menu-"] [role="listbox"] li[role="option"]:nth-child(${optionIndex})`
  //     );
  //   }

  //   directLi?.click?.();
  // }

  // function base64ToFile(base64Str, fileName, mime = "application/pdf") {
  //   if (!base64Str) {
  //     LOG("empty base64");
  //     return null;
  //   }

  //   let raw = base64Str;
  //   const comma = base64Str.indexOf(",");
  //   if (comma >= 0) raw = base64Str.slice(comma + 1);

  //   let bin;
  //   try {
  //     bin = atob(raw);
  //   } catch {
  //     LOG("invalid base64");
  //     return null;
  //   }
  //   const bytes = new Uint8Array(bin.length);
  //   for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  //   const blob = new Blob([bytes], { type: mime });
  //   return new File([blob], fileName || "upload.pdf", { type: blob.type });
  // }

  // async function uploadFile() {
  //   let input = document.querySelector(CONFIG.uploadInputSelector);

  //   if (!input) {
  //     return false;
  //   }

  //   const dt = new DataTransfer();
  //   dt.items.add(cashedFile);
  //   input.files = dt.files;
  //   ["input", "change"].forEach((type) => {
  //     input.dispatchEvent(
  //       new Event(type, { bubbles: true, cancelable: true, composed: true })
  //     );
  //   });

  //   return true;
  // }

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

  const isAcceptanceButtonShown = async (
    idReferral,
    remainingMs = Infinity
  ) => {
    const tStart = performance.now();

    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return { isOk: true, reason: "immediate", elapsedMs: 0 };
    }

    let attempts = 0;

    while (true) {
      attempts++;

      const result = await fetchDetailsOnce(idReferral);

      if (result.ok) {
        return {
          isOk: true,
          reason: "ready",
          message: result.message,
          elapsedMs: Math.round(performance.now() - tStart),
          attempts,
        };
      }

      if (attempts % 5 === 0) {
        await sleep(3);
      }
    }
  };

  async function clickDashboardRow(patient) {
    if (actionButtonCalled) {
      return;
    }

    actionButtonCalled = true;

    const {
      referralId,
      referralEndTimestamp,
      acceptanceFileBase64,
      fileName,
      clientName,
    } = patient;

    const _remainingMs = referralEndTimestamp - Date.now();

    const iconButton = await findRowByReferralId(referralId);

    if (!iconButton) {
      LOG(`[dash] Referral ID ${referralId} row not found. Aborting.`);
      actionButtonCalled = false;
      return;
    }

    injectNoAnimStyle();

    const files = [
      {
        fileName: fileName,
        fileData: acceptanceFileBase64,
        fileExtension: 0,
        userCode: clientName,
        idAttachmentType: 14,
        languageCode: 1,
      },
    ];

    localStorage.setItem("GM__FILS", JSON.stringify(files));

    const remainingMs = referralEndTimestamp - Date.now();

    const { elapsedMs, reason, attempts } = await isAcceptanceButtonShown(
      referralId,
      remainingMs
    );

    iconButton.click();

    LOG(
      `referralId=${referralId} remainingMsWhenReceived=${_remainingMs} remainingMs=${remainingMs} attempts=${attempts} reason=${reason} elapsedMs=${elapsedMs}`
    );

    setTimeout(() => {
      actionButtonCalled = false;
    }, 15_000);
  }

  chrome.runtime.onMessage.addListener(async (request) => {
    if (request.type === "accept" && request.data) {
      try {
        if (!actionButtonCalled) {
          LOG("Received 'accept' command from Service Worker.");
          await clickDashboardRow(request.data);
        }
      } catch (e) {
        ERR("clickDashboardRow failed:", e?.message || e);
      }
    }
    // Returning true indicates that sendResponse will be called asynchronously,
    // but here we simply acknowledge the message for one-way communication.
    return false;
  });
})();
