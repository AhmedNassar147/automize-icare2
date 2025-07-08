/*
 *
 * helper: `waitMinutesThenRun`.
 *
 */
import { EFFECTIVE_REVIEW_DURATION_MS } from "./constants.mjs";

const waitMinutesThenRun = (caseStartTime, asyncAction) => {
  // isoDate is already in ISO format, just parse it directly
  const target = new Date(caseStartTime + EFFECTIVE_REVIEW_DURATION_MS);

  let timeoutId;
  let cancelled = false;

  const delay = target.getTime() - Date.now();

  const cancel = () => {
    cancelled = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  };

  if (delay <= 0) {
    const immediateRun = async () => {
      if (cancelled) return;

      try {
        await asyncAction();
      } catch (err) {
        console.error(
          "🛑 Error when calling patient action in waitMinutesThenRun:",
          err
        );
      }
    };
    immediateRun();
    return {
      cancel,
    };
  }

  timeoutId = setTimeout(async () => {
    if (cancelled) return;
    try {
      await asyncAction();
    } catch (err) {
      console.error(
        "🛑 Error when calling patient action in waitMinutesThenRun:",
        err
      );
    }
  }, delay);

  return {
    cancel,
  };
};

export default waitMinutesThenRun;
