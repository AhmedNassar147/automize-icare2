/*
 *
 * Helper: `writePollLogsData`.
 *
 */
import { join } from "node:path";
import { writeFile } from "node:fs/promises";
import createConsoleMessage from "./createConsoleMessage.mjs";
import { pollLogsFolderPath } from "./constants.mjs";

const getDerivedTiming = (pollLogs) => {
  const oneEntries = pollLogs.filter((x) => x.phase === "one");
  const actualZero = pollLogs.find((x) => x.phase === "actual-zero");
  const ready = pollLogs.find((x) => x.phase === "ready");
  const lastOne = oneEntries.at(-1);

  return {
    firstOneLocalNow: oneEntries[0]?.localNow ?? null,
    lastOneLocalNow: lastOne?.localNow ?? null,
    actualZeroLocalNow: actualZero?.localNow ?? null,
    readyLocalNow: ready?.localNow ?? null,

    firstOneDiff: oneEntries[0]?.diff ?? null,
    lastOneDiff: lastOne?.diff ?? null,
    actualZeroDiff: actualZero?.diff ?? null,
    readyDiff: ready?.diff ?? null,

    lastOneToActualZeroMs:
      lastOne && actualZero ? actualZero.localNow - lastOne.localNow : null,

    actualZeroToReadyMs:
      actualZero && ready ? ready.localNow - actualZero.localNow : null,

    lastOneToReadyMs:
      lastOne && ready ? ready.localNow - lastOne.localNow : null,
  };
};

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
  const timingSummary = getDerivedTiming(timesWhenOneSecondStartedAndEnded);

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
    timingSummary,
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
