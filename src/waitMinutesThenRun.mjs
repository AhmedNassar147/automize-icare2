import speekText from "./speakText.mjs";

const waitMinutesThenRun = (
  caseWillBeSubmitMSAt,
  asyncAction,
  referralId,
  useVisitVoice
) => {
  let timeoutIdMain;
  let timeoutIdWarn;
  let cancelled = false;

  const now = Date.now();

  // Time until main callback
  const delayMain = caseWillBeSubmitMSAt - now;

  // Time until warning (9 seconds before end)
  const WARNING_OFFSET = 10500;
  const delayWarning = delayMain - WARNING_OFFSET;

  const cancel = () => {
    cancelled = true;
    clearTimeout(timeoutIdMain);
    if (timeoutIdWarn) {
      clearTimeout(timeoutIdWarn);
    }
  };

  // ---- Early 9-second warning ----
  if (useVisitVoice) {
    if (delayWarning <= 0) {
      // Already inside 9 seconds → fire immediately
      speekText({
        text: `Visit ${referralId}`,
        times: 1,
        useMaleVoice: true,
        volume: 100,
      });
    } else {
      timeoutIdWarn = setTimeout(() => {
        if (cancelled) return;
        speekText({
          text: `Visit ${referralId}`,
          times: 1,
          useMaleVoice: true,
          volume: 100,
        });
      }, delayWarning);
    }
  }

  // ---- Main execution at end time ----
  if (delayMain <= 0) {
    (async () => {
      if (cancelled) return;
      try {
        await asyncAction();
      } catch (err) {
        console.error("Error in asyncAction:", err);
      }
    })();
    return { cancel };
  }

  timeoutIdMain = setTimeout(async () => {
    if (cancelled) return;
    try {
      await asyncAction();
    } catch (err) {
      console.error("Error in asyncAction:", err);
    }
  }, delayMain);

  return { cancel };
};

export default waitMinutesThenRun;
