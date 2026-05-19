/**
 *
 * Helper: `summarizeLogsAfterAcceptance`.
 *
 */
import { writeFile, appendFile, readFile } from "fs/promises";
import checkPathExists from "./checkPathExists.mjs";
import getCurrentActiveLogsSummaryFile from "./getCurrentActiveLogsSummaryFile.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import { LOGS_SUMMARY_SEPARATOR, LOGS_SUMMARY_HEADERS } from "./constants.mjs";

const sanitize = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).replaceAll("\n", " ").replaceAll("|", "/");
};

const centerText = (text, width) => {
  text = sanitize(text);

  if (text.length >= width) return text;

  const totalPadding = width - text.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;

  return " ".repeat(leftPadding) + text + " ".repeat(rightPadding);
};

const createPrettyRow = (row, widths) => {
  return LOGS_SUMMARY_HEADERS.map((key) =>
    centerText(row[key], widths[key]),
  ).join(LOGS_SUMMARY_SEPARATOR);
};

// Column renames: old name → new name
const COLUMN_RENAMES = {
  backendDelay: "delay",
  "endVsReady(diff)": "diff",
  endDateString: "endDate",
};

const ALL_KNOWN_HEADERS = [
  ...LOGS_SUMMARY_HEADERS,
  // old names
  ...Object.keys(COLUMN_RENAMES),
];

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const isHeaderLine = (line) =>
  LOGS_SUMMARY_HEADERS.some((keyword) => {
    const regex = new RegExp(`^\\s*${escapeRegex(keyword)}\\s*[|]`);
    return regex.test(line);
  });

const widths = {
  endDate: 22,
  ID: 6,
  waitTime: 9,
  end: 13,
  serverEnd: 13,
  endVsServer: 11,
  readyAt: 13,
  diff: 11,
  zeroAt: 13,
  delay: 5,
  readyVsServer: 13,
  clickedAt: 13,
  tookMS: 6,
  status: 22,
  claimed: 7,
};

const getOutputFileBasedOnCaseEndTime = (referralEndTimestamp) => {
  const caseMonth = new Date(referralEndTimestamp).getMonth() + 1;
  const outputFile = getCurrentActiveLogsSummaryFile(caseMonth);

  return outputFile;
};

const summarizeLogsAfterAcceptance = async (data) => {
  const {
    referralId,
    waitTime,
    extraWait,
    referralEndTimestamp,
    endDateBasedServerDateMs,
    readySeenAt,
    zeroSeenAt,
    extraBackendDelayMs,
    referralEndDate,
    status,
    claimed,
  } = data;

  const outputFile = getOutputFileBasedOnCaseEndTime(referralEndTimestamp);

  let endToReady = "";
  if (referralEndTimestamp > readySeenAt) endToReady = ">";
  if (referralEndTimestamp === readySeenAt) endToReady = "=";
  if (referralEndTimestamp < readySeenAt) endToReady = "<";

  const diff = referralEndTimestamp - readySeenAt;

  const row = {
    endDate: referralEndDate,
    ID: referralId,
    waitTime: `${waitTime}_${extraWait || 0}`,
    end: referralEndTimestamp,
    serverEnd: endDateBasedServerDateMs,
    endVsServer: referralEndTimestamp - endDateBasedServerDateMs,
    readyAt: readySeenAt,
    zeroAt: zeroSeenAt,
    diff: `${diff} - (${endToReady})`,
    delay: extraBackendDelayMs,
    readyVsServer: readySeenAt - endDateBasedServerDateMs,
    clickedAt: "",
    tookMS: "",
    status: status || "",
    claimed: claimed || "",
  };

  const exists = await checkPathExists(outputFile);

  if (!exists) {
    const headerLine = createPrettyRow(
      Object.fromEntries(LOGS_SUMMARY_HEADERS.map((h) => [h, h])),
      widths,
    );

    await writeFile(outputFile, `${headerLine}\n`, "utf8");
  }

  const line = createPrettyRow(row, widths);
  await appendFile(outputFile, `${line}\n`, "utf8");

  createConsoleMessage(
    `✅ Acceptance summary appended → ${outputFile}`,
    "info",
  );
};

export default summarizeLogsAfterAcceptance;

/**
 * Updates fields of a specific case row in the log file.
 *
 * @param {number|string} referralId  - case to find
 * @param {number} referralEndTimestamp  - case end timestamp to
 * @param {object}        updates     - fields to change e.g. { status: "good" }
 */
export async function updateCaseInLog(
  referralId,
  referralEndTimestamp,
  updates,
) {
  const currentMonthOutputFile =
    getOutputFileBasedOnCaseEndTime(referralEndTimestamp);
  const raw = await readFile(currentMonthOutputFile, "utf8");

  const target = String(referralId).trim();
  let found = false;

  const updatedLines = raw.split("\n").map((line) => {
    if (!line.trim() || isHeaderLine(line)) return line;

    const cols = line.split("|").map((c) => c.trim());
    const idIndex = LOGS_SUMMARY_HEADERS.indexOf("ID");
    if (cols[idIndex].trim() !== target) return line;

    found = true;

    const current = {};
    LOGS_SUMMARY_HEADERS.forEach((key, i) => {
      current[key] = cols[i] ?? "";
    });

    const fieldMap = {
      status: "status",
      waitTime: "waitTime",
      endVsServer: "endVsServer",
      readyVsServer: "readyVsServer",
      delay: "delay",
      clickedAt: "clickedAt",
      tookMS: "tookMS",
      claimed: "claimed",
    };

    for (const [field, value] of Object.entries(updates)) {
      const key = fieldMap[field] ?? field;
      if (key in current) current[key] = String(value);
    }

    return createPrettyRow(current, widths);
  });

  if (!found) {
    throw new Error(`updateCaseInLog: referralId ${referralId} not found`);
  }

  await writeFile(currentMonthOutputFile, updatedLines.join("\n"), "utf8");
}

export async function readLogsAsArray(referralEndTimestamp) {
  const ts = referralEndTimestamp ?? Date.now();
  const file = getOutputFileBasedOnCaseEndTime(ts);

  let raw;

  if (await checkPathExists(file)) {
    raw = await readFile(file, "utf8");
  } else {
    // fall back to previous month
    const prevMonthTs = new Date(ts);
    prevMonthTs.setMonth(prevMonthTs.getMonth() - 1);
    const prevFile = getOutputFileBasedOnCaseEndTime(prevMonthTs.getTime());

    if (await checkPathExists(prevFile)) {
      raw = await readFile(prevFile, "utf8");
    } else {
      return [];
    }
  }

  return raw
    .split("\n")
    .filter((line) => line.trim() && !isHeaderLine(line))
    .map((line) => {
      const cols = line.split("|").map((c) => c.trim());

      const current = {};
      LOGS_SUMMARY_HEADERS.forEach((key, i) => {
        current[key] = cols[i] ?? "";
      });

      const [base, extra] = (current.waitTime || "0_0").split("_").map(Number);

      const diff = parseInt(current.diff?.match(/-?\d+/)?.[0] ?? "0", 10);

      return {
        referralId: current.ID,
        waitTime: base,
        extraWait: extra || 0,
        referralEndTimestamp: parseInt(current.end, 10) || null,
        readySeenAt: parseInt(current.readyAt, 10) || null,
        diff,
        zeroSeenAt: parseInt(current.zeroAt, 10) || null,
        extraBackendDelayMs: parseInt(current.delay, 10) || null,
        endDateBasedServerDateMs: parseInt(current.serverEnd, 10) || null,
        endVsServer: parseInt(current.endVsServer, 10) || 0,
        readyVsServer: parseInt(current.readyVsServer, 10) || null,
        clickedAt: parseInt(current.clickedAt, 10) || null,
        tookMS: parseInt(current.tookMS, 10) || null,
        status: current.status || "",
        referralEndDate: current.endDate || "",
        claimed: current.claimed || "",
      };
    })
    .filter((r) => !isNaN(r.referralId) && r.referralId > 0);
}

export async function migrateLogWidths(referralEndTimestamp) {
  const file = getOutputFileBasedOnCaseEndTime(referralEndTimestamp);
  const raw = await readFile(file, "utf8");
  const lines = raw.split("\n");

  // Read old column order from existing header line
  const headerLine = lines.find(isHeaderLine);
  const oldHeaders = headerLine
    ? headerLine.split("|").map((c) => c.trim())
    : LOGS_SUMMARY_HEADERS;

  const updatedLines = lines.map((line) => {
    if (!line.trim()) return line;

    // Re-render header with new names and order
    if (isHeaderLine(line)) {
      return createPrettyRow(
        Object.fromEntries(LOGS_SUMMARY_HEADERS.map((h) => [h, h])),
        widths,
      );
    }

    // Parse using OLD order
    const cols = line.split("|").map((c) => c.trim());
    const current = Object.fromEntries(
      oldHeaders.map((key, i) => [key, cols[i] ?? ""]),
    );

    // Apply renames
    for (const [oldKey, newKey] of Object.entries(COLUMN_RENAMES)) {
      if (oldKey in current) {
        current[newKey] = current[oldKey];
        delete current[oldKey];
      }
    }

    // Fill missing new columns
    LOGS_SUMMARY_HEADERS.forEach((key) => {
      if (!(key in current)) current[key] = "";
    });

    return createPrettyRow(current, widths);
  });

  await writeFile(file, updatedLines.join("\n"), "utf8");
  createConsoleMessage(`✅ Log migrated → ${file}`, "info");
}
