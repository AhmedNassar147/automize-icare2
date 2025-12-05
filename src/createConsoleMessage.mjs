/*
 *
 * Helper: `createConsoleMessage`.
 *
 */

/**
 * Creates a stylized log message for Node.js console using ANSI escape codes.
 *
 * @param {string} sourceTag - A tag to identify the source (e.g., "DASH").
 * @param {('log'|'info'|'warn'|'error')} level - The logging severity level.
 * @param {(string|object|Error)} message - The content to log.
 */

// ANSI color codes dictionary for Node.js
const ANSI = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  // Foreground colors
  fgBlack: "\x1b[30m",
  fgRed: "\x1b[31m",
  fgGreen: "\x1b[32m",
  fgYellow: "\x1b[33m",
  fgBlue: "\x1b[34m",
  fgMagenta: "\x1b[35m",
  fgCyan: "\x1b[36m",
  fgWhite: "\x1b[37m",

  // Background colors
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
};

/** Palette of tag background colors */
const TAG_BG_COLORS = [
  ANSI.bgRed,
  ANSI.bgYellow,
  ANSI.bgBlue,
  ANSI.bgMagenta,
  ANSI.bgCyan,
  ANSI.bgBlack,
];

/** Palette of tag foreground colors (white is safest) */
const TAG_FG = ANSI.fgWhite + ANSI.bright;

/**
 * Simple deterministic hash → integer
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/**
 * Get auto color style for tag based on hash
 */
function getAutoTagStyle(tag) {
  const index = hashString(tag) % TAG_BG_COLORS.length;
  return TAG_BG_COLORS[index] + TAG_FG;
}

// Mapped styles
const ANSI_STYLES = {
  time: ANSI.fgBlue,

  log: ANSI.fgGreen,
  info: ANSI.fgCyan + ANSI.bright,
  warn: ANSI.fgYellow + ANSI.bright,
  error: ANSI.fgRed + ANSI.bright,
  reset: ANSI.reset,
};

function createConsoleMessage(message, level, sourceTag) {
  const time = new Date().toLocaleTimeString();
  const consoleMethod = console[level] || console.log;

  // --- AUTO COLORED TAG ---
  const tagColor = getAutoTagStyle(sourceTag || "");
  const tagFormatted = `${tagColor} ${sourceTag || ""} ${ANSI.reset}`;

  const timeFormatted = `${ANSI_STYLES.time}[${time}]${ANSI.reset}`;
  const prefix = `${timeFormatted} ${tagFormatted}`;

  if (message instanceof Error) {
    const errorMsg = `${ANSI_STYLES.error} Error: ${message.message} ${ANSI.reset}`;
    consoleMethod(`${prefix} ${errorMsg}\n${message.stack}`);
  } else if (typeof message === "object" && message !== null) {
    consoleMethod(`${prefix} Object:`, message);
  } else {
    const contentStyle = ANSI_STYLES[level] || ANSI_STYLES.log;
    consoleMethod(`${prefix} ${contentStyle}${message}${ANSI.reset}`);
  }
}

export default createConsoleMessage;
