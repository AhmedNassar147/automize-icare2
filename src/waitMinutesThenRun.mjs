/*
 *
 * helper: `waitMinutesThenRun`.
 *
 */
const waitMinutesThenRun = (caseWillBeSubmitMSAt, asyncAction) => {
  // isoDate is already in ISO format, just parse it directly
  let timeoutId;
  let cancelled = false;

  const delay = caseWillBeSubmitMSAt - Date.now();

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
