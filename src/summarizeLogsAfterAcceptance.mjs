/**
 *
 * Helper: `summarizeLogsAfterAcceptance`.
 *
 */
import { writeFile, appendFile } from "fs/promises";
import checkPathExists from "./checkPathExists.mjs";
import getCurrentActiveLogsSummaryFile from "./getCurrentActiveLogsSummaryFile.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import { LOGS_SUMMARY_SEPARATOR, LOGS_SUMMARY_HEADERS } from "./constants.mjs";

const sanitize = (value) => {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).replaceAll("\n", " ").replaceAll("|", "/");
};

const centerText = (text, width) => {
  text = sanitize(text);

  if (text.length >= width) {
    return text;
  }

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

  const caseMonth = new Date(referralEndTimestamp).getMonth() + 1;
  const outputFile = getCurrentActiveLogsSummaryFile(caseMonth);

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
    status: 16,
    endDateString: 20,
  };

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

// const logs = [
//   {
//     status: "high-not-taken",
//     referralId: 376980,
//     waitTime: 2012,
//     extraWait: 2,
//     referralEndTimestamp: 1778652562000,
//     endDateBasedServerDateMs: 1778652561000,
//     zeroSeenAt: 1778652560000,
//     readySeenAt: 1778652562000,
//     extraBackendDelayMs: 2000,
//   },
//   {
//     status: "blocked",
//     referralId: 376981,
//     waitTime: 2012,
//     referralEndTimestamp: 1778653039000,
//     endDateBasedServerDateMs: 1778653037000,
//     zeroSeenAt: 1778653037000,
//     readySeenAt: 1778653038000,
//     extraBackendDelayMs: 1000,
//   },
//   {
//     status: "were blocked",
//     referralId: 376983,
//     waitTime: 2012,
//     referralEndTimestamp: 1778653253000,
//     endDateBasedServerDateMs: 1778653252000,
//     zeroSeenAt: 1778653252000,
//     readySeenAt: 1778653253000,
//     extraBackendDelayMs: 1000,
//   },
//   {
//     status: "",
//     referralId: 377042,
//     waitTime: 2016,
//     referralEndTimestamp: 1778680708000,
//     endDateBasedServerDateMs: 1778680706000,
//     zeroSeenAt: 1778680706000,
//     readySeenAt: 1778680707000,
//     extraBackendDelayMs: 1000,
//     referralEndDate: "13/05/2026 09:20:53 am",
//   },
// ];

// for (const log of logs) {
//   await summarizeLogsAfterAcceptance(log);
// }
