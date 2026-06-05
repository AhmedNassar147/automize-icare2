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
      [OUTCOME_MAP.lowWaiting]: elapsedMs <= 630 ? -3 : -2,
      [OUTCOME_MAP.moderateWaiting]:
        elapsedMs <= 720 ? -2 : elapsedMs <= 745 ? -1 : 0,
      [OUTCOME_MAP.goodWaiting]: elapsedMs >= 875 ? +1 : 0,
      [OUTCOME_MAP.needMoreWait]: elapsedMs < 950 ? +1 : +2,
      [OUTCOME_MAP.nearToBlock]:
        elapsedMs >= 2000 ? +5 : elapsedMs >= 1600 ? +3 : +2,
      [OUTCOME_MAP.blocked]: 0,

      // [OUTCOME_MAP.needLessWait]: -3,
      // [OUTCOME_MAP.lowWaiting]: elapsedMs <= 630 ? -2 : -1,
      // [OUTCOME_MAP.moderateWaiting]: elapsedMs <= 720 ? -2 : 0,
      // [OUTCOME_MAP.goodWaiting]: elapsedMs >= 875 ? +1 : 0,
      // [OUTCOME_MAP.needMoreWait]: elapsedMs < 950 ? +1 : +2,
      // [OUTCOME_MAP.nearToBlock]:
      //   elapsedMs >= 2000 ? +4 : elapsedMs >= 1600 ? +3 : +2,
      // [OUTCOME_MAP.blocked]: 0,
    }[outcome] ?? 0
  );
};

export default getOutcomeDelta;
