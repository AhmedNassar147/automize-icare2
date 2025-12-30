import Speaker from "speaker";
// import sleep from "./sleep.mjs";

export function makeSinePcm16(options) {
  const { freqHz, durationMs, sampleRate, volume } = {
    freqHz: 880,
    durationMs: 30,
    sampleRate: 44100, // try 44100 first on Windows
    volume: 0.99,
    ...(options ?? {}),
  };

  const samples = Math.round((durationMs / 1000) * sampleRate);
  const buf = Buffer.alloc(samples * 2);

  const fadeSamples = Math.max(1, Math.round(sampleRate * 0.003)); // 3ms fade
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;

    let env = 1;
    if (i < fadeSamples) env = i / fadeSamples;
    else if (i > samples - fadeSamples) env = (samples - i) / fadeSamples;

    const s = Math.sin(2 * Math.PI * freqHz * t) * volume * env;
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2);
  }
  return buf;
}

export function createBeeper(pcm, warmMs = 10) {
  const sampleRate = 44100;

  const speaker = new Speaker({
    channels: 1,
    bitDepth: 16,
    sampleRate,
  });

  speaker.on("error", (e) => console.error("Speaker error:", e));

  // Warm up once (near-silent) to prime device; do NOT await
  const warmSamples = Math.round((warmMs / 1000) * sampleRate);
  const warm = Buffer.alloc(warmSamples * 2);
  speaker.write(warm);

  return {
    // Fast path: returns immediately
    beep() {
      speaker.write(pcm);
    },

    // Optional: play a different precomputed buffer
    beepPcm(otherPcm) {
      if (Buffer.isBuffer(otherPcm)) speaker.write(otherPcm);
    },

    close() {
      speaker.end();
    },
  };
}

// const beeper = createBeeper(makeSinePcm16());

// console.time("beeper");
// beeper.beep();
// console.timeEnd("beeper");
// await sleep(500);
// beeper.close();
