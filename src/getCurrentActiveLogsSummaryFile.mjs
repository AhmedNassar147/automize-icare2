/*
 *
 * Helper: `getCurrentActiveLogsSummaryFile`.
 *
 */
import { casesTimingLogsFolderPath } from "./constants.mjs";

const getCurrentActiveLogsSummaryFile = (caseMonth) => {
  const currentMonth = caseMonth ? caseMonth : new Date().getMonth() + 1;

  return `${casesTimingLogsFolderPath}/${currentMonth}.txt`;
};

export default getCurrentActiveLogsSummaryFile;
