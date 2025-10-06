import sleep from "./sleep.mjs";

const randn = (mean = 0, sd = 1) => {
  // Box–Muller
  let u = 1 - Math.random();
  let v = 1 - Math.random();
  return (
    mean + sd * Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  );
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export const humanDelay = (mean = 180, sd = 60, min = 60, max = 600) =>
  Math.round(clamp(randn(mean, sd), min, max));

export const humanWiggle = async (page) => {
  const x = 50 + Math.random() * 400;
  const y = 50 + Math.random() * 300;
  await page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 7) });
};

const humanTab = async (
  page,
  {
    minTabs = 1,
    maxTabs = 4,
    base = 200, // base tempo (per run you can randomize this)
    jitter = 70, // std dev around base
    backtrackChance = 0.25,
    longPauseChance = 0.15,
  } = {}
) => {
  const tabs = minTabs + Math.floor(Math.random() * (maxTabs - minTabs + 1));

  for (let i = 0; i < tabs; i++) {
    // occasional hesitation
    if (Math.random() < longPauseChance) {
      await sleep(300 + Math.random() * 600);
      if (Math.random() < 0.4) await humanWiggle(page);
    }

    // sometimes backtrack with Shift+Tab instead of Tab
    const useBacktrack = Math.random() < backtrackChance && i > 0;
    if (useBacktrack) {
      await page.keyboard.down("Shift");
      await page.keyboard.press("Tab");
      await page.keyboard.up("Shift");
    } else {
      // press includes keydown+keyup; you can pass a delay to stretch it slightly
      await page.keyboard.press("Tab", {
        delay: Math.random() < 0.2 ? 15 + Math.floor(Math.random() * 40) : 0,
      });
    }

    await sleep(humanDelay(base, jitter, 60, 500));
  }
};

export default humanTab;
