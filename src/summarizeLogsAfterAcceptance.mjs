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

const widths = {
  ID: 6,
  waitTime: 8,
  end: 13,
  serverEnd: 13,
  endVsServer: 11,
  readyAt: 13,
  "endVsReady(diff)": 16,
  zeroAt: 13,
  backendDelay: 12,
  readyVsServer: 13,
  clickedAt: 14,
  tookMS: 10,
  status: 21,
  endDateString: 22,
};

const getOutputFileBasedOnCaseEndTime = (referralEndTimestamp) => {
  const caseMonth = new Date(referralEndTimestamp).getMonth() + 1;
  const outputFile = getCurrentActiveLogsSummaryFile(caseMonth);

  return outputFile;
};

const summarizeLogsAfterAcceptance = async (data) => {
  const {
    waitTime,
    extraWait,
    referralEndTimestamp,
    isEndDateGreaterThanFinalCaseDate,
    isEndDateEqualToFinalCaseDate,
    referralId,
    endDateBasedServerDateMs,
    readySeenAt,
    zeroSeenAt,
    extraBackendDelayMs,
  } = data;

  const outputFile = getOutputFileBasedOnCaseEndTime(referralEndTimestamp);

  let endToReady = "";

  if (referralEndTimestamp > readySeenAt) {
    endToReady = ">";
  }

  if (referralEndTimestamp === readySeenAt) {
    endToReady = "=";
  }

  if (referralEndTimestamp < readySeenAt) {
    endToReady = "<";
  }

  const diff = referralEndTimestamp - readySeenAt;

  const row = {
    status: data.status || "",
    ID: referralId,
    waitTime: `${waitTime}_${extraWait || 0}`,
    end: referralEndTimestamp,
    serverEnd: endDateBasedServerDateMs,
    endVsServer: referralEndTimestamp - endDateBasedServerDateMs,
    readyAt: readySeenAt,
    zeroAt: zeroSeenAt,
    "endVsReady(diff)": `${diff} - (${endToReady})`,
    backendDelay: extraBackendDelayMs,
    readyVsServer: readySeenAt - endDateBasedServerDateMs,
    endDateString: data.referralEndDate,
    clickedAt: "",
    tookMS: "",
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
    // keep header and blank lines untouched
    if (!line.trim() || /^\s*ID\s*\|/.test(line)) return line;

    const cols = line.split("|").map((c) => c.trim());
    if (cols[0] !== target) return line;

    found = true;

    // parse current row into a key→value map
    const current = {};
    LOGS_SUMMARY_HEADERS.forEach((key, i) => {
      current[key] = cols[i] ?? "";
    });

    // apply updates (map field names to header keys)
    const fieldMap = {
      status: "status",
      waitTime: "waitTime",
      endDateString: "endDateString",
      referralEndDate: "endDateString",
      endVsServer: "endVsServer",
      readyVsServer: "readyVsServer",
      backendDelay: "backendDelay",
      clickedAt: "clickedAt",
      tookMS: "tookMS",
    };

    for (const [field, value] of Object.entries(updates)) {
      const key = fieldMap[field] ?? field;
      if (key in current) current[key] = String(value);
    }

    // re-render the row with same fixed widths
    return createPrettyRow(current, widths);
  });

  if (!found) {
    throw new Error(`updateCaseInLog: referralId ${referralId} not found`);
  }

  await writeFile(currentMonthOutputFile, updatedLines.join("\n"), "utf8");
}

export default summarizeLogsAfterAcceptance;

export async function migrateLogWidths(referralEndTimestamp) {
  const file = getOutputFileBasedOnCaseEndTime(referralEndTimestamp);
  const raw = await readFile(file, "utf8");
  const lines = raw.split("\n");

  // read old column order from existing header line
  const headerLine = lines.find((l) => /^\s*ID\s*\|/.test(l));
  const oldHeaders = headerLine
    ? headerLine.split("|").map((c) => c.trim())
    : LOGS_SUMMARY_HEADERS;

  const updatedLines = lines.map((line) => {
    if (!line.trim()) return line;

    // re-render header with new order
    if (/^\s*ID\s*\|/.test(line)) {
      return createPrettyRow(
        Object.fromEntries(LOGS_SUMMARY_HEADERS.map((h) => [h, h])),
        widths,
      );
    }

    // parse using OLD order
    const cols = line.split("|").map((c) => c.trim());
    const current = Object.fromEntries(
      oldHeaders.map((key, i) => [key, cols[i] ?? ""]),
    );

    // fill any new columns that didn't exist before
    LOGS_SUMMARY_HEADERS.forEach((key) => {
      if (!(key in current)) current[key] = "";
    });

    return createPrettyRow(current, widths);
  });

  await writeFile(file, updatedLines.join("\n"), "utf8");
  createConsoleMessage(`✅ Log migrated → ${file}`, "info");
}

await migrateLogWidths(1779014471000);
