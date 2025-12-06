// background.js (MV3 service worker) — alarm-driven keepalive & reliable reconnect

const CONFIG = {
  reconnectBaseMs: 600, // initial backoff (ms)
  reconnectMaxMs: 10000, // max backoff (ms)
  alarmPeriodMinutes: 0.5, // periodic alarm every 30s
  WS_URL: "wss://localhost:8443/",
};

const LOG = (...a) => console.log("[GM SW]", ...a);
const ERR = (...a) => console.error("[GM SW]", ...a);

// --- GLOBAL CONSTANT FOR TARGET URLS ---
const DASHBOARD_URLS = [
  "https://referralprogram.globemedsaudi.com/dashboard/referral*",
  "https://referralprogram.globemedsaudi.com/Dashboard/Referral*",
];

let ws = null;
let wsConnecting = false;
let backoffMs = CONFIG.reconnectBaseMs;

// --- CRITICAL RELIABILITY FUNCTION ---
/**
 * Sends a message to a tab, retrying with exponential backoff if the
 * Content Script's listener is not ready (which causes 'receiving end does not exist').
 * @param {number} tabId - The ID of the target tab.
 * @param {object} message - The message payload.
 * @param {number} maxRetries - Maximum number of attempts.
 */
async function sendReliably(tabId, message, maxRetries = 5) {
  let delay = 50; // Start with 100ms delay
  let success = false;
  let lastError = null;

  for (let i = 0; i < maxRetries; i++) {
    lastError = null;

    await new Promise((resolve) => {
      // Use the callback pattern to check chrome.runtime.lastError
      chrome.tabs.sendMessage(tabId, message, (response) => {
        // Must read chrome.runtime.lastError in the callback to clear it
        if (chrome.runtime.lastError) {
          lastError = chrome.runtime.lastError.message;
          resolve();
        } else {
          // Message successfully sent (and listener existed)
          success = true;
          resolve();
        }
      });
    });

    if (success) {
      LOG(
        `Message successfully forwarded to tab ${tabId} after ${
          i + 1
        } attempts.`
      );
      return true;
    }

    // Check for the specific race condition error
    if (lastError && lastError.includes("Receiving end does not exist")) {
      LOG(
        `Attempt ${i + 1} failed (Listener not ready). Retrying in ${delay}ms.`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * 2, 1500); // Exponential backoff, max 1500
    } else {
      // An unrecoverable error occurred (e.g., tab closed, permission error)
      ERR(`Unrecoverable error sending message to tab ${tabId}: ${lastError}`);
      return false;
    }
  }

  ERR(
    `Failed to send message to tab ${tabId} after ${maxRetries} attempts. Final error: ${lastError}`
  );
  return false;
}

// ensure periodic alarm exists on install and startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("gm-check-ws", {
    periodInMinutes: CONFIG.alarmPeriodMinutes,
  });
  LOG("Alarm gm-check-ws created (onInstalled)");
});
chrome.runtime.onStartup?.addListener(() => {
  chrome.alarms.create("gm-check-ws", {
    periodInMinutes: CONFIG.alarmPeriodMinutes,
  });
  LOG("Alarm gm-check-ws ensured (onStartup)");
});

// universal alarms handler
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name) return;
  if (alarm.name === "gm-check-ws" || alarm.name === "gm-reconnect") {
    ensureConnected();
  }
});

// schedule reconnect via a one-shot alarm (reliable across SW reloads)
function scheduleReconnect(delayMs) {
  const when = Date.now() + Math.max(0, delayMs || backoffMs);
  // exponential backoff update
  backoffMs = Math.min(
    CONFIG.reconnectMaxMs,
    Math.max(backoffMs * 2, CONFIG.reconnectBaseMs)
  );
  LOG(
    `Scheduling reconnect alarm 'gm-reconnect' at ${new Date(
      when
    ).toISOString()} (next backoff ${backoffMs}ms)`
  );
  try {
    chrome.alarms.create("gm-reconnect", { when });
  } catch (e) {
    // fallback to setTimeout (may not fire if SW is suspended)
    LOG("chrome.alarms.create failed, falling back to setTimeout", e);
    setTimeout(() => ensureConnected(), delayMs || backoffMs);
  }
}

function handleIncomingMsg(msg) {
  const { type, data } = msg;
  if (type === "accept" && data?.referralId) {
    chrome.tabs.query({ url: DASHBOARD_URLS }, (tabs) => {
      if (chrome.runtime.lastError) {
        ERR("tabs.query error", chrome.runtime.lastError.message);
        return;
      }
      if (!tabs || !tabs.length) {
        LOG("No dashboard tab found to forward accept message");
        return;
      }

      const tab = tabs.find((t) => t.active) || tabs[0];
      if (!tab || !tab.id) return;

      // --- Use the reliable send function to handle the Content Script race condition ---
      sendReliably(tab.id, { type: "accept", data })
        .then((success) => {
          if (success) {
            LOG(`Accept message successfully delivered to tab ${tab.id}.`);
          } else {
            // Failure case is logged within sendReliably
          }
        })
        .catch((e) => ERR("sendReliably final process failure", e));
    });
  }
}

function connectWS() {
  if (
    ws &&
    (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)
  ) {
    LOG("connectWS: WS already connecting/open — skipping");
    return;
  }

  wsConnecting = true;

  try {
    ws = new WebSocket(CONFIG.WS_URL);
  } catch (e) {
    wsConnecting = false;
    ERR("WebSocket constructor failed:", e);
    scheduleReconnect(backoffMs);
    return;
  }

  ws.onopen = () => {
    wsConnecting = false;
    backoffMs = CONFIG.reconnectBaseMs; // reset backoff
    LOG("WS open");
  };

  ws.onmessage = (ev) => {
    let msg;
    try {
      msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;
    handleIncomingMsg(msg);
  };

  ws.onclose = (ev) => {
    LOG("WS closed", ev && ev.code);
    wsConnecting = false;
    safeCloseWs();
    scheduleReconnect(backoffMs);
  };

  ws.onerror = (e) => {
    ERR("WS error", e);
    // force close to unify handling in onclose
    try {
      ws.close();
    } catch (err) {
      ERR("force close failed", err);
    }
  };
}

function ensureConnected() {
  try {
    chrome.tabs.query({ url: DASHBOARD_URLS }, (tabs) => {
      const onDashboard = tabs && tabs.length > 0;

      // --- CASE 1: No dashboard tabs exist → teardown WS completely ---
      if (!onDashboard) {
        if (ws && ws.readyState === WebSocket.OPEN) {
          LOG("Dashboard not open → closing WS");
          safeCloseWs();
        }
        wsConnecting = false;
        return; // do NOT attempt reconnect
      }

      // If already open, just ping
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping" }));
          LOG("ping sent");
        } catch (e) {
          ERR("ping failed → closing and scheduling reconnect", e);
          safeCloseWs();
          scheduleReconnect(backoffMs);
        }
        return;
      }

      // If connecting → do nothing
      if (ws && ws.readyState === WebSocket.CONNECTING) {
        return;
      }

      if (wsConnecting) return;

      connectWS();
    });
  } catch (e) {
    ERR("ensureConnected error", e);
  }
}

function safeCloseWs() {
  try {
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close();
      } catch (e) {}
      ws = null;
    }
  } catch (e) {
    ERR("safeCloseWs error", e);
  }
}

// try initial connection on startup of SW
ensureConnected();
