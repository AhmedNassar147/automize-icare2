/*
 *
 * Helper: `ensureCaseTimingLogsFile`.
 *
 */
import { writeFile, readFile } from "fs/promises";
import { LOGS_SUMMARY_HEADERS, casesTimingLogsFilePath } from "./constants.mjs";
import checkPathExists from "./checkPathExists.mjs";
import { createPrettyRow, isHeaderLine } from "./timingLogsHelpers.mjs";

const createBaseFileHeader = async (existingData = "") => {
  const headerLine = createPrettyRow(
    Object.fromEntries(LOGS_SUMMARY_HEADERS.map((h) => [h, h])),
  );
  await writeFile(
    casesTimingLogsFilePath,
    `${headerLine}\n${existingData}`,
    "utf8",
  );
};

const ensureCaseTimingLogsFile = async () => {
  const exists = await checkPathExists(casesTimingLogsFilePath);

  if (!exists) {
    await createBaseFileHeader();
    return true;
  }

  const fileData = await readFile(casesTimingLogsFilePath, "utf8");
  if (!fileData) {
    await createBaseFileHeader();
    return true;
  }

  const lines = fileData.split("\n");
  const headerLine = lines.find(isHeaderLine);

  if (!headerLine) {
    await createBaseFileHeader(fileData);
  }

  return true;
};

export default ensureCaseTimingLogsFile;
