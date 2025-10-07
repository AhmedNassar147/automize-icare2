/*
 *
 * Helper: `buildDurationText`.
 *
 */
const buildDurationText = (startTime, endTime) => {
  const executionDurationMs = endTime - startTime;

  const durationText = `🕒 *Took*: \`${(executionDurationMs / 1000).toFixed(
    2
  )} seconds\``;

  return durationText;
};

export default buildDurationText;
