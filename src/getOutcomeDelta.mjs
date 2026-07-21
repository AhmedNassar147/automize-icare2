/*
 *
 * Helper: `getOutcomeDelta`.
 *
 */
import { OUTCOME_MAP } from "./constants.mjs";

const getOutcomeDelta = (outcome, elapsedMs) => {
  if (!outcome || !Number.isFinite(elapsedMs)) {
    return 0;
  }

  return (
    {
      // Low elapsedMs means app already moved too fast / dashboard returned,
      // so we clicked too late. Reduce wait to click earlier next time.
      [OUTCOME_MAP.needLessWait]: -4,
      [OUTCOME_MAP.lowWaiting]: -3,
      [OUTCOME_MAP.moderateWaiting]:
        // elapsedMs <= 710 ? -3 : elapsedMs <= 750 ? -2 : -1,
        elapsedMs <= 760 ? -3 : elapsedMs <= 790 ? -2 : -1,
      [OUTCOME_MAP.goodWaiting]:
        // elapsedMs <= 830 ? -1 : elapsedMs >= 870 ? +1 : 0,
        elapsedMs <= 825 ? -2 : 0,
      [OUTCOME_MAP.needMoreWait]:
        // elapsedMs <= 925 ? 0 : elapsedMs < 980 ? +2 : +2,
        elapsedMs <= 910 ? -1 : elapsedMs <= 1000 ? 0 : +1,
      [OUTCOME_MAP.nearToBlock]: elapsedMs >= 1500 ? +2 : 1,
      [OUTCOME_MAP.blocked]: 0,
    }[outcome] ?? 0
  );
};

export default getOutcomeDelta;
