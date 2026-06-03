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
      [OUTCOME_MAP.needLessWait]: -2,
      [OUTCOME_MAP.lowWaiting]: elapsedMs <= 645 ? -2 : -1,
      [OUTCOME_MAP.moderateWaiting]:
        elapsedMs <= 710 ? -2 : elapsedMs <= 745 ? -1 : 0,
      [OUTCOME_MAP.goodWaiting]: elapsedMs >= 875 ? +1 : 0,
      [OUTCOME_MAP.needMoreWait]: elapsedMs < 910 ? +1 : +2,
      [OUTCOME_MAP.nearToBlock]: elapsedMs > 2100 ? +5 : +2,
      [OUTCOME_MAP.blocked]: 0,
    }[outcome] ?? 0
  );
};

export default getOutcomeDelta;
