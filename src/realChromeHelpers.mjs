/*
 *
 * Helpers: `realChromeHelpers`.
 *
 */
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import createConsoleMessage from "./createConsoleMessage.mjs";
import { APP_URL } from "./constants.mjs";

const execAsync = promisify(exec);

const isChromeOpen = async () => {
  const platform = process.platform;
  const isWindows = platform === "win32";

  const cmd = isWindows
    ? 'tasklist /FI "IMAGENAME eq chrome.exe"'
    : platform === "darwin"
      ? `pgrep -x "Google Chrome"`
      : `pgrep -x chrome || pgrep -x chromium || pgrep -x chromium-browser`;

  try {
    const { stdout } = await execAsync(cmd);

    const isOpen = isWindows
      ? stdout.toLowerCase().includes("chrome.exe")
      : stdout.trim().length > 0;

    return {
      success: true,
      isOpen,
      message: isOpen
        ? "🟡 Chrome already running, Open the app Your slef."
        : "🟢 Chrome was not running.",
    };
  } catch (e) {
    return {
      success: false,
      isOpen: false,
      message: `🔴 Failed checking Chrome state: ${e.message}`,
    };
  }
};

const openChromeIfNeeded = async () => {
  const { success, isOpen, message: chromeStateMessage } = await isChromeOpen();

  if (!success) {
    createConsoleMessage(chromeStateMessage, "error");

    return {
      success: false,
      opened: false,
      messages: [chromeStateMessage],
    };
  }

  // Chrome already running → do nothing
  if (isOpen) {
    createConsoleMessage(chromeStateMessage, "warn");

    return {
      success: true,
      opened: false,
      messages: [chromeStateMessage],
    };
  }

  const platform = process.platform;

  const cmd =
    platform === "win32"
      ? `start "" chrome "${APP_URL}"`
      : platform === "darwin"
        ? `open -a "Google Chrome" "${APP_URL}"`
        : `google-chrome "${APP_URL}" || chromium-browser "${APP_URL}" || chromium "${APP_URL}"`;

  try {
    await execAsync(cmd);

    const openedMessage = `🟢 Opened Chrome → ${APP_URL}`;

    createConsoleMessage(openedMessage, "warn");

    return {
      success: true,
      opened: true,
      messages: [chromeStateMessage, openedMessage],
    };
  } catch (err) {
    const errorMessage = `🔴 Failed opening Chrome: ${err.message}`;

    createConsoleMessage(errorMessage, "error");

    return {
      success: false,
      opened: false,
      messages: [chromeStateMessage, errorMessage],
    };
  }
};

export { isChromeOpen, openChromeIfNeeded };
