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
  const lastForDb = new Date(now.getFullYear(), monthForLast, 0);
  const last = new Date(now.getFullYear(), monthForLast, 1);

  const summaryStart = getFormattedDateForSummary(first);
  const summaryEnd = getFormattedDateForSummary(last);

  return {
    start: `${summaryStart}T00:00:00`,
    end: `${getFormattedDateForSummary(lastForDb)}T23:59:59`,
    summaryStart: summaryStart,
    summaryEnd: summaryEnd,
  };
};

export default getMonthDateRange;
