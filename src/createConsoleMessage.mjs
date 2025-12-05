/*
 *
 * Helper: `createConsoleMessage`.
 *
 */
/**
 * Creates a stylized log message for Node.js console using ANSI escape codes.
 *
 * NOTE: This version replaces browser CSS (%c) with ANSI codes for Node.js compatibility.
 *
 * @param {string} sourceTag - A tag to identify the source (e.g., "DASH").
 * @param {('log'|'warn'|'error')} level - The logging severity level.
 * @param {(string|object|Error)} message - The content to log.
 */

// ANSI color codes dictionary for Node.js
const ANSI = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors (Text Color)
  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgWhite: "\x1b[37m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
};

// Mapped styles for output
const ANSI_STYLES = {
  time: ANSI.fgBlue, // Use Blue for time

  // Tag: White text (fgWhite) on Black BG (bgBlack)
  tag: ANSI.bgBlack + ANSI.fgWhite + ANSI.bright,

  // Content Styles
  log: ANSI.fgGreen,
  warn: ANSI.fgYellow + ANSI.bright,
  error: ANSI.fgRed + ANSI.bright,

  // Reset all formatting
  reset: ANSI.reset,
};

function createConsoleMessage(message, level, sourceTag) {
  const time = new Date().toLocaleTimeString();
  const consoleMethod = console[level] || console.log;

  // Apply ANSI styles to the static parts
  const tagFormatted = `${ANSI_STYLES.tag} ${sourceTag || ""} ${
    ANSI_STYLES.reset
  }`;
  const timeFormatted = `${ANSI_STYLES.time}[${time}]${ANSI_STYLES.reset}`;

  let prefix = `${timeFormatted} ${tagFormatted}`;

  // --- Format output based on message type ---
  if (message instanceof Error) {
    // Handle Error objects with bold red text
    const errorMsg = `${ANSI_STYLES.error} Error: ${message.message} ${ANSI_STYLES.reset}`;
    // Print message and stack trace
    consoleMethod(`${prefix} ${errorMsg}\n${message.stack}`);
  } else if (typeof message === "object" && message !== null) {
    // Handle standard objects (Node.js will print these interactively)
    consoleMethod(`${prefix} Object:`, message);
  } else {
    // Handle strings with dynamic content style
    const contentStyle = ANSI_STYLES[level] || ANSI_STYLES.log;
    consoleMethod(`${prefix} ${contentStyle}${message}${ANSI_STYLES.reset}`);
  }
}

export default createConsoleMessage;
