// background.js (MV3 service worker) — alarm-driven keepalive & reliable reconnect

const CONFIG = {
  reconnectBaseMs: 600, // initial backoff (ms)
  reconnectMaxMs: 10000, // max backoff (ms)
  alarmPeriodMinutes: 0.5, // periodic alarm every 30s
  WS_URL: "wss://localhost:8443/",
};

const LOG = (...a) => console.log("[GM SW]", ...a);
const ERR = (...a) => console.error("[GM SW]", ...a);

const DASHBOARD_URLS = [
  "https://referralprogram.globemedsaudi.com/dashboard/referral*",
  "https://referralprogram.globemedsaudi.com/Dashboard/Referral*",
];

let ws = null;
let wsConnecting = false;
let backoffMs = CONFIG.reconnectBaseMs;
let reconnectScheduled = false;

// --- RELIABLE MESSAGE SENDING ---
async function sendReliably(tabId, message, maxRetries = 5) {
  let delay = 50;
  let success = false;
  let lastError = null;

  const TRANSIENT_ERRORS = [
    "Receiving end does not exist",
    "The message port closed before a response was received.",
  ];

  for (let i = 0; i < maxRetries; i++) {
    lastError = null;

    await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          lastError = chrome.runtime.lastError.message;
          resolve();
        } else {
          success = true;
          resolve();
        }
      });
    });

    if (success) {
      LOG(`Message sent to tab ${tabId} after ${i + 1} attempt(s).`);
      return true;
    }

    const isTransient = TRANSIENT_ERRORS.some(
      (err) => lastError && lastError.includes(err)
    );
    if (isTransient) {
      LOG(
        `Attempt ${
          i + 1
        } failed (transient: ${lastError}). Retrying in ${delay}ms.`
      );
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 1500);
    } else {
      ERR(`Unrecoverable error sending message to tab ${tabId}: ${lastError}`);
      return false;
    }
  }

  ERR(
    `Failed to send message to tab ${tabId} after ${maxRetries} attempts. Last error: ${lastError}`
  );
  return false;
}

// --- ALARM MANAGEMENT ---
function ensureAlarm(name, periodMinutes) {
  chrome.alarms.get(name, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(name, { periodInMinutes: periodMinutes });
      LOG(`Alarm '${name}' created`);
    }
  });
}

// --- WEBSOCKET MANAGEMENT ---
function connectWS() {
  if (wsConnecting || (ws && ws.readyState === WebSocket.CONNECTING)) return;

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
    backoffMs = CONFIG.reconnectBaseMs;
    LOG("WebSocket connected");
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      if (msg && typeof msg === "object") handleIncomingMsg(msg);
    } catch (e) {
      ERR("Failed to parse WS message", e);
    }
  };

  ws.onclose = (ev) => {
    LOG("WebSocket closed", ev && ev.code);
    wsConnecting = false;
    safeCloseWs();
    scheduleReconnect(backoffMs);
  };

  ws.onerror = (e) => {
    ERR("WebSocket error", e);
    try {
      ws.close();
    } catch {}
  };
}

function safeCloseWs() {
  try {
    wsConnecting = false;

    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
      ws = null;
    }
  } catch (e) {
    ERR("safeCloseWs error", e);
  }
}

// --- RECONNECT SCHEDULING ---
function scheduleReconnect(delayMs) {
  if (reconnectScheduled) return; // already scheduled

  reconnectScheduled = true;
  const when = Date.now() + Math.max(0, delayMs || backoffMs);
  backoffMs = Math.min(
    CONFIG.reconnectMaxMs,
    Math.max(backoffMs * 2, CONFIG.reconnectBaseMs)
  );

  LOG(
    `Scheduling reconnect at ${new Date(
      when
    ).toISOString()} (next backoff ${backoffMs}ms)`
  );

  try {
    chrome.alarms.create("gm-reconnect", { when });
  } catch (e) {
    LOG("chrome.alarms.create failed, fallback setTimeout", e);
    setTimeout(() => ensureConnected(), delayMs || backoffMs);
  }
}

// --- DASHBOARD TABS CHECK & WS ENSURE ---
function ensureConnected() {
  try {
    reconnectScheduled = false;
    chrome.tabs.query({ url: DASHBOARD_URLS }, (tabs) => {
      if (chrome.runtime.lastError)
        return ERR(chrome.runtime.lastError.message);

      const onDashboard = tabs && tabs.length > 0;

      if (!onDashboard) {
        if (ws && ws.readyState === WebSocket.OPEN)
          LOG("No dashboard → closing WS");
        safeCloseWs();
        wsConnecting = false;
        return;
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping" }));
          LOG("Ping sent");
        } catch (e) {
          ERR("Ping failed, reconnecting", e);
          safeCloseWs();
          scheduleReconnect(backoffMs);
        }
        return;
      }

      connectWS();
    });
  } catch (e) {
    ERR("ensureConnected error", e);
  }
}

const sentTabMessage = (tab, data) => {
  if (tab && tab.id) {
    sendReliably(tab.id, { type: "accept", data })
      .then((success) => success && LOG(`Message delivered to tab ${tab.id}`))
      .catch((e) => ERR("sendReliably failure", e));
  }
};

// --- INCOMING MESSAGE HANDLER ---
function handleIncomingMsg(msg) {
  const { type, data } = msg;

  if (type === "accept" && data?.referralId) {
    chrome.tabs.query({ url: DASHBOARD_URLS, active: true }, (tabs) => {
      if (chrome.runtime.lastError)
        return ERR(chrome.runtime.lastError.message);

      if (!tabs || !tabs.length) {
        // fallback: any dashboard tab
        chrome.tabs.query({ url: DASHBOARD_URLS }, (allTabs) => {
          if (!allTabs || !allTabs.length) {
            return LOG("No dashboard tab available to send message");
          }
          sentTabMessage(allTabs[0], data);
        });
        return;
      }
      sentTabMessage(tabs[0], data);
    });
  }
}

// --- INSTALL & STARTUP ---
chrome.runtime.onInstalled.addListener(() =>
  ensureAlarm("gm-check-ws", CONFIG.alarmPeriodMinutes)
);
chrome.runtime.onStartup?.addListener(() =>
  ensureAlarm("gm-check-ws", CONFIG.alarmPeriodMinutes)
);

// --- ALARMS ---
chrome.alarms.onAlarm.addListener((alarm) => {
  if (!alarm || !alarm.name) return;
  if (alarm.name === "gm-check-ws" || alarm.name === "gm-reconnect") {
    ensureConnected();
  }
});

// --- INITIAL CONNECTION ---
ensureConnected();
