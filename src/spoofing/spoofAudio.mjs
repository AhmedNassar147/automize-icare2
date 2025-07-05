/*
 * spoofAudio.mjs
 *
 * Audio fingerprint spoofing script for evading Google reCAPTCHA detection
 */

import spoofNative from "./spoofNative.mjs";

const spoofAudio = ({ fingerprint, metadata } = {}) => {
  const spoofedLatency = metadata?.audioCtxBaseLatency ?? 0.01;
  const spoofedSampleRate = metadata?.audioCtxSampleRate ?? 48000;
  const spoofedState = metadata?.audioCtxState ?? "running";

  const analyserSample = metadata?.analyserSample || {};
  const analyserBinCount = metadata?.analyserBinCount ?? 1024;
  const gainValue = metadata?.gainValue ?? 0;
  const compressorValues = {
    threshold: metadata?.compressor?.threshold?.value ?? -24,
    knee: metadata?.compressor?.knee?.value ?? 30,
    ratio: metadata?.compressor?.ratio?.value ?? 12,
    attack: metadata?.compressor?.attack?.value ?? 0.003,
    release: metadata?.compressor?.release?.value ?? 0.25,
  };

  const sumFingerprint = parseFloat(fingerprint?.sum ?? 10000);

  const AudioContextNative = window.AudioContext;
  const OfflineAudioContextNative = window.OfflineAudioContext;

  function spoofAudioContext(ctx) {
    Object.defineProperty(ctx, "baseLatency", {
      get: () => spoofedLatency,
      configurable: true,
    });
    Object.defineProperty(ctx, "sampleRate", {
      get: () => spoofedSampleRate,
      configurable: true,
    });
    Object.defineProperty(ctx, "state", {
      get: () => spoofedState,
      configurable: true,
    });

    const destination = ctx.destination;
    const destinationProxy = new Proxy(destination, {
      get(target, prop) {
        const overrides = {
          channelCount: metadata?.channelCount ?? 2,
          channelCountMode: metadata?.channelCountMode ?? "explicit",
          maxChannelCount: metadata?.maxChannelCount ?? 2,
          numberOfInputs: metadata?.numberOfInputs ?? 1,
          numberOfOutputs: metadata?.numberOfOutputs ?? 0,
          toString: () =>
            metadata?.destinationToString ?? "[object AudioDestinationNode]",
        };
        return prop in overrides ? overrides[prop] : target[prop];
      },
    });
    Object.defineProperty(ctx, "destination", {
      get: () => destinationProxy,
      configurable: true,
    });

    // Patch createGain
    const originalCreateGain = ctx.createGain.bind(ctx);
    ctx.createGain = spoofNative(function () {
      const gain = originalCreateGain();
      gain.gain.value = gainValue;
      return gain;
    }, "createGain");

    // Patch createAnalyser
    const originalCreateAnalyser = ctx.createAnalyser.bind(ctx);
    ctx.createAnalyser = spoofNative(function () {
      const analyser = originalCreateAnalyser();
      analyser.fftSize = analyserBinCount * 2;
      analyser.getFloatFrequencyData = spoofNative(function (array) {
        for (let i = 0; i < array.length; i++) {
          const base = analyserSample?.[i] ?? -100 + Math.random() * 0.2;

          const drift = Math.sin(Date.now() * 0.0001 + i) * 0.02;
          array[i] = base + drift + Math.random() * 0.001;
        }
        return array;
      }, "getFloatFrequencyData");
      return analyser;
    }, "createAnalyser");

    // Patch createDynamicsCompressor
    const originalCreateDynamicsCompressor =
      ctx.createDynamicsCompressor.bind(ctx);
    ctx.createDynamicsCompressor = spoofNative(function () {
      const compressor = originalCreateDynamicsCompressor();
      compressor.threshold.value = compressorValues.threshold;
      compressor.knee.value = compressorValues.knee;
      compressor.ratio.value = compressorValues.ratio;
      compressor.attack.value = compressorValues.attack;
      compressor.release.value = compressorValues.release;
      return compressor;
    }, "createDynamicsCompressor");

    // Patch decodeAudioData
    const originalDecode = ctx.decodeAudioData?.bind(ctx);
    if (originalDecode) {
      ctx.decodeAudioData = spoofNative(function (arrayBuffer, success, error) {
        const sampleLength = 44100;
        const fakeBuffer = ctx.createBuffer(1, sampleLength, spoofedSampleRate);
        const channelData = fakeBuffer.getChannelData(0);
        for (let i = 0; i < sampleLength; i++) {
          const noise =
            (Math.sin(i / 100) + Math.random() * 0.01) *
            (sumFingerprint / 10000);
          channelData[i] = Math.max(-1, Math.min(1, noise));
        }
        success?.(fakeBuffer);
      }, "decodeAudioData");
    }

    spoofNative(ctx.resume);
    spoofNative(ctx.suspend);
    spoofNative(ctx.close);
  }

  // Proxy constructors
  window.AudioContext = spoofNative(function AudioContext(...args) {
    const ctx = new AudioContextNative(...args);
    spoofAudioContext(ctx);
    return ctx;
  }, "AudioContext");

  window.OfflineAudioContext = spoofNative(function OfflineAudioContext(
    ...args
  ) {
    const ctx = new OfflineAudioContextNative(...args);
    spoofAudioContext(ctx);
    return ctx;
  },
  "OfflineAudioContext");

  Object.defineProperty(AudioContext.prototype.constructor, "name", {
    value: "AudioContext",
    configurable: true,
  });
  AudioContext.prototype.toString = () => "[object AudioContext]";
};

export default spoofAudio;
