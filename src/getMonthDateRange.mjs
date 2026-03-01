/**
 *
 * Helper: `getMonthDateRange`.
 *
 */
import getFormattedDateForSummary from "./getFormattedDateForSummary.mjs";

const getMonthDateRange = (useCurrentMonth) => {
  const now = new Date();

  const dateMonth = now.getMonth();

  const monthForFirst = useCurrentMonth ? dateMonth : dateMonth - 1;
  const monthForLast = useCurrentMonth ? dateMonth + 1 : dateMonth;

  const first = new Date(now.getFullYear(), monthForFirst, 1);
  const last = new Date(now.getFullYear(), monthForLast, 0);

  // Match your stored format: "YYYY-MM-DDTHH:mm:ss" (no milliseconds, no Z)
  const toDbIso = (d) => d.toISOString().slice(0, 19);

  return {
    start: toDbIso(first),
    end: toDbIso(last),
    summaryStart: getFormattedDateForSummary(first),
    summaryEnd: getFormattedDateForSummary(last),
  };
};

export default getMonthDateRange;
