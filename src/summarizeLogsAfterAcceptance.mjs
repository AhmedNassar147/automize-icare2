/**
 *
 * Helper: `summarizeLogsAfterAcceptance`.
 *
 */
import { writeFile, appendFile, readFile } from "fs/promises";
import createConsoleMessage from "./createConsoleMessage.mjs";
import { createPrettyRow, isHeaderLine } from "./timingLogsHelpers.mjs";
import { LOGS_SUMMARY_HEADERS, casesTimingLogsFilePath } from "./constants.mjs";

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

const COLUMNS_TO_REMOVE = ["readyVsServer"];

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
    rtt,
  } = data;

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
    clickedAt: "",
    tookMS: "",
    status: status || "",
    claimed: claimed || "",
    rtt: rtt || "",
  };

  const line = createPrettyRow(row);
  await appendFile(casesTimingLogsFilePath, `${line}\n`, "utf8");

  createConsoleMessage(
    `✅ Acceptance summary appended → ${casesTimingLogsFilePath}`,
    "info",
  );
};

export default summarizeLogsAfterAcceptance;

/**
 * Updates fields of a specific case row in the log file.
 *
 * @param {number|string} referralId  - case to find
 * @param {object}        updates     - fields to change e.g. { status: "good" }
 */
export async function updateCaseInLog(referralId, updates) {
  const raw = await readFile(casesTimingLogsFilePath, "utf8");

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
      delay: "delay",
      clickedAt: "clickedAt",
      tookMS: "tookMS",
      claimed: "claimed",
    };

    for (const [field, value] of Object.entries(updates)) {
      const key = fieldMap[field] ?? field;
      if (key in current) current[key] = String(value);
    }

    return createPrettyRow(current);
  });

  if (!found) {
    throw new Error(`updateCaseInLog: referralId ${referralId} not found`);
  }

  await writeFile(casesTimingLogsFilePath, updatedLines.join("\n"), "utf8");
}

export async function readLogsAsArray() {
  const raw = await readFile(casesTimingLogsFilePath, "utf8");

  if (!raw.trim()) {
    return [];
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
        clickedAt: parseInt(current.clickedAt, 10) || null,
        tookMS: parseInt(current.tookMS, 10) || null,
        status: current.status || "",
        referralEndDate: current.endDate || "",
        claimed: current.claimed || "",
        rtt: parseInt(current.rtt, 10) || null,
      };
    })
    .filter((r) => !isNaN(r.referralId) && r.referralId > 0);
}

export async function migrateCaseLogTimings() {
  const raw = await readFile(casesTimingLogsFilePath, "utf8");
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

    for (const key of COLUMNS_TO_REMOVE) {
      delete current[key];
    }

    // Fill missing new columns
    LOGS_SUMMARY_HEADERS.forEach((key) => {
      if (!(key in current)) current[key] = "";
    });

    return createPrettyRow(current);
  });

  await writeFile(casesTimingLogsFilePath, updatedLines.join("\n"), "utf8");
  createConsoleMessage(`✅ Log migrated → ${casesTimingLogsFilePath}`, "info");
}

export async function getCasesWithEmptyClaimStatus() {
  const logs = await readLogsAsArray();

  return logs
    .filter(
      (row) =>
        !!row.referralId &&
        Number(row.referralId) > 0 &&
        !!row.referralEndTimestamp &&
        (!row.claimed || row.claimed.trim() === ""),
    )
    .map(({ referralId, referralEndTimestamp: caseEndTimestamp }) => ({
      referralId: referralId,
      referralEndTimestamp: caseEndTimestamp,
    }));
}

// await migrateCaseLogTimings();
