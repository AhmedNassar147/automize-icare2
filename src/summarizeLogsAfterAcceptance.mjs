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
  const caseMonth = new Date(data.referralEndTimestamp).getMonth() + 1;
  const outputFile = getCurrentActiveLogsSummaryFile(caseMonth);

  const widths = {
    status: 17,
    referralId: 12,
    waitTime: 10,
    extraWait: 11,
    endTs: 15,
    serverEndTs: 13,
    zeroSeenAt: 15,
    readySeenAt: 15,
    backendDelayMs: 16,
    endVsServerMs: 15,
    // readyVsZeroMs: 15,
    "endVsReady(diff)": 18,
    readyVsServerMs: 17,
    "isEnd>ready": 13,
    "isEnd=ready": 13,
    endDateString: 20,
  };

  const row = {
    status: data.status || "",
    referralId: data.referralId,
    waitTime: data.waitTime,
    extraWait: data.extraWait || 0,
    endTs: data.referralEndTimestamp,
    serverEndTs: data.endDateBasedServerDateMs,
    endVsServerMs: data.referralEndTimestamp - data.endDateBasedServerDateMs,
    zeroSeenAt: data.zeroSeenAt,
    readySeenAt: data.readySeenAt,
    "endVsReady(diff)": data.referralEndTimestamp - data.readySeenAt,
    backendDelayMs: data.extraBackendDelayMs,
    readyVsServerMs: data.readySeenAt - data.endDateBasedServerDateMs,
    "isEnd>ready": data.isEndDateGreaterThanFinalCaseDate,
    "isEnd=ready": data.isEndDateEqualToFinalCaseDate,
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
//     isEndDateGreaterThanFinalCaseDate: false,
//     isEndDateEqualToFinalCaseDate: true,
//     diff: 0,
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
//     isEndDateGreaterThanFinalCaseDate: true,
//     isEndDateEqualToFinalCaseDate: false,
//     diff: 1000,
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
//     isEndDateGreaterThanFinalCaseDate: false,
//     isEndDateEqualToFinalCaseDate: true,
//     diff: 0,
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
//     isEndDateGreaterThanFinalCaseDate: true,
//     isEndDateEqualToFinalCaseDate: false,
//     referralEndTimestamp: 1778680708000,
//     claimableServerTime: 1778680707000,
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
