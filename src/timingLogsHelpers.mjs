/*
 *
 * Helpers: `timingLogsHelpers`.
 *
 */
import {
  LOGS_SUMMARY_SEPARATOR,
  LOGS_SUMMARY_HEADERS,
  TIMING_LOGS_WIDTHS,
} from "./constants.mjs";

export const sanitize = (value) => {
  if (value === undefined || value === null) return "";
  return String(value).replaceAll("\n", " ").replaceAll("|", "/");
};

export const centerText = (text, width) => {
  text = sanitize(text);

  if (text.length >= width) return text;

  const totalPadding = width - text.length;
  const leftPadding = Math.floor(totalPadding / 2);
  const rightPadding = totalPadding - leftPadding;

  return " ".repeat(leftPadding) + text + " ".repeat(rightPadding);
};

export const createPrettyRow = (row) => {
  return LOGS_SUMMARY_HEADERS.map((key) =>
    centerText(row[key], TIMING_LOGS_WIDTHS[key]),
  ).join(LOGS_SUMMARY_SEPARATOR);
};

const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const isHeaderLine = (line) =>
  LOGS_SUMMARY_HEADERS.some((keyword) => {
    const regex = new RegExp(`^\\s*${escapeRegex(keyword)}\\s*[|]`);
    return regex.test(line);
  });
