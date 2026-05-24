/*
 *
 * Helpers: `realChromeHelpers`.
 *
 */
import { exec } from "child_process";
import { promisify } from "util";
import createConsoleMessage from "./createConsoleMessage.mjs";
import { APP_URL } from "./constants.mjs";

const execAsync = promisify(exec);

const isRealChromeOpen = async () => {
  const cmd =
    process.platform === "win32"
      ? `powershell -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'chrome.exe' } | Select-Object -ExpandProperty CommandLine"`
      : `ps -ax -o command | grep -i "[c]hrome"`;

  try {
    const { stdout } = await execAsync(cmd);

    const lines = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const realChromeProcesses = lines.filter((line) => {
      const lower = line.toLowerCase();

      // Puppeteer / automation indicators
      const isAutomation =
        lower.includes("puppeteer_dev_chrome_profile") ||
        lower.includes("--remote-debugging-port") ||
        lower.includes("--enable-automation") ||
        lower.includes("--user-data-dir");

      return lower.includes("chrome") && !isAutomation;
    });

    const isOpen = realChromeProcesses.length > 0;

    return {
      success: true,
      isOpen,
      message: isOpen
        ? "🔴 Real Chrome already running. open the app your self"
        : "Real Chrome was not running.",
    };
  } catch (err) {
    return {
      success: false,
      isOpen: false,
      message: `🔴 open the app your self, Failed checking real Chrome state: ${err.message}`,
    };
  }
};

const openChromeIfNeeded = async () => {
  const {
    success,
    isOpen,
    message: chromeStateMessage,
  } = await isRealChromeOpen();

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
    const errorMessage = `🔴 open the app your self, Failed opening Chrome: ${err.message}`;

    createConsoleMessage(errorMessage, "error");

    return {
      success: false,
      opened: false,
      messages: [chromeStateMessage, errorMessage],
    };
  }
};

export { isRealChromeOpen, openChromeIfNeeded };
