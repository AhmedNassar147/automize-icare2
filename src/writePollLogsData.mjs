/*
 *
 * Helper: `writePollLogsData`.
 *
 */
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import createConsoleMessage from "./createConsoleMessage.mjs";
import { pollLogsFolderPath } from "./constants.mjs";

const writePollLogsData = async ({
  timesWhenOneSecondStartedAndEnded = [],
  loopCountWhenSecondIsOne,
  referralId,
  actionType,
  waitTime,
  zeroSeenAt,
  readySeenAt,
  extraBackendDelayMs,
  readySeenAtLocalMs,
  rtt,
}) => {
  const nonReadyEntries = timesWhenOneSecondStartedAndEnded.filter(
    (item) => item?.phase !== "ready",
  );

  const isSameServerDate =
    nonReadyEntries.length > 0 &&
    nonReadyEntries.every(({ serverNow }, index, array) => {
      if (!index) return true;
      return array[index - 1]?.serverNow === serverNow;
    });

  const createdAt = new Date().toISOString();

  const pollLog = {
    createdAt,
    referralId,
    actionType,
    waitTime,
    zeroSeenAt,
    readySeenAt,
    extraBackendDelayMs,
    readySeenAtLocalMs,
    rtt,
    loopCountWhenSecondIsOne,
    isSameServerDate,
    timesWhenOneSecondStartedAndEnded,
  };

  const key = createdAt.replace(/[:.]/g, "-");

  const fileName = `${
    isSameServerDate ? "same_" : ""
  }${referralId}_${actionType}_${key}.json`;

  try {
    await writeFile(
      join(pollLogsFolderPath, fileName),
      JSON.stringify(pollLog, null, 2),
      "utf8",
    );
  } catch (error) {
    createConsoleMessage(error, "error", "Failed to write poll log:");
  }
};

export default writePollLogsData;
