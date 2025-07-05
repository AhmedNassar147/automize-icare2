/*
 *
 * Helper: `spoofVideoAndAudio`.
 *
 */
import spoofNative from "./spoofNative.mjs";

const spoofVideoAndAudio = () => {
  const audioProto = HTMLAudioElement.prototype;
  const videoProto = HTMLVideoElement.prototype;

  Object.defineProperty(audioProto, Symbol.toStringTag, {
    value: "HTMLAudioElement",
  });

  Object.defineProperty(videoProto, Symbol.toStringTag, {
    value: "HTMLVideoElement",
  });

  const videoDefaults = {
    width: 0,
    height: 0,
    videoWidth: 0,
    videoHeight: 0,
    playsInline: false,
    autoplay: false,
    controls: false,
    loop: false,
    muted: false,
    defaultMuted: false,
    preload: "metadata",
    volume: 1,
    readyState: 0,
    networkState: 0,
  };

  Object.entries(videoDefaults).forEach(([k, v]) => {
    try {
      Object.defineProperty(videoProto, k, {
        get: () => v,
        configurable: true,
      });
    } catch {}
  });

  // canPlayType spoof
  videoProto.canPlayType = spoofNative(function canPlayType(type) {
    const supported = ["video/webm", "video/mp4", "audio/webm", "audio/mp4"];
    return supported.includes(type.split(";")[0]) ? "probably" : "";
  }, "canPlayType");

  videoProto.addTextTrack = spoofNative(function addTextTrack() {
    return { label: "", language: "", kind: "subtitles" };
  }, "addTextTrack");

  Object.defineProperty(videoProto, "textTracks", {
    get: () => ({ length: 0, toString: () => "[object TextTrackList]" }),
  });
  Object.defineProperty(videoProto, "audioTracks", {
    get: () => ({ length: 1, toString: () => "[object AudioTrackList]" }),
  });
  Object.defineProperty(videoProto, "videoTracks", {
    get: () => ({ length: 1, toString: () => "[object VideoTrackList]" }),
  });

  // MediaDevices + Permissions
  const fakeDevices = [
    { deviceId: "", kind: "audioinput", label: "", groupId: "" },
    { deviceId: "", kind: "videoinput", label: "", groupId: "" },
    { deviceId: "", kind: "audiooutput", label: "", groupId: "" },
  ];

  const supportedConstraints = {
    aspectRatio: true,
    autoGainControl: true,
    brightness: true,
    channelCount: true,
    contrast: true,
    deviceId: true,
    echoCancellation: true,
    facingMode: true,
    frameRate: true,
    groupId: true,
    height: true,
    latency: true,
    noiseSuppression: true,
    sampleRate: true,
    sampleSize: true,
    width: true,
  };

  navigator.mediaDevices.getSupportedConstraints = () => ({
    ...supportedConstraints,
  });
  navigator.mediaDevices.enumerateDevices = spoofNative(
    async () => [...fakeDevices],
    "enumerateDevices"
  );

  navigator.mediaDevices.getUserMedia = spoofNative(async function (
    constraints
  ) {
    const fakeStream = new MediaStream();

    const createTrack = (kind) => {
      const track = new MediaStreamTrack();
      track.kind = kind;
      track.label = `${kind} track`;
      track.enabled = true;
      track.getCapabilities = () =>
        kind === "video"
          ? { width: { max: 1280 }, height: { max: 720 } }
          : { sampleRate: { max: 48000 }, sampleSize: { max: 16 } };
      track.getSettings = () =>
        kind === "video"
          ? { width: 640, height: 480 }
          : { sampleRate: 44100, sampleSize: 16 };
      track.getConstraints = () => ({});
      return track;
    };

    if (constraints.video) fakeStream.addTrack(createTrack("video"));
    if (constraints.audio) fakeStream.addTrack(createTrack("audio"));

    return fakeStream;
  },
  "getUserMedia");

  // MediaCapabilities
  navigator.mediaCapabilities = {
    decodingInfo: spoofNative(
      async () => ({ supported: true, smooth: true, powerEfficient: true }),
      "decodingInfo"
    ),
    encodingInfo: spoofNative(
      async () => ({ supported: true, smooth: true, powerEfficient: true }),
      "encodingInfo"
    ),
  };

  // MediaRecorder
  if (typeof window.MediaRecorder === "function") {
    class FakeMediaRecorder {
      constructor(stream, options = {}) {
        this.stream = stream;
        this.mimeType = options.mimeType || "video/webm";
        this.state = "inactive";
        this.onstart = null;
        this.onstop = null;
        this.ondataavailable = null;
      }
      start() {
        this.state = "recording";
        if (this.onstart) this.onstart();
      }
      stop() {
        this.state = "inactive";
        if (this.ondataavailable) {
          this.ondataavailable({ data: new Blob([], { type: this.mimeType }) });
        }
        if (this.onstop) this.onstop();
      }
    }
    window.MediaRecorder = FakeMediaRecorder;
  }

  // AudioContext + OfflineAudioContext
  const spoofAudioContextProps = (proto) => {
    if (!proto) return;
    const audioDefaults = {
      sampleRate: 44100,
      baseLatency: 0.01,
      outputLatency: 0.02,
      state: "running",
    };
    for (const [key, val] of Object.entries(audioDefaults)) {
      if (!(key in proto)) {
        Object.defineProperty(proto, key, {
          get: () => val,
          configurable: true,
        });
      }
    }
  };

  spoofAudioContextProps(window.AudioContext?.prototype);
  spoofAudioContextProps(window.OfflineAudioContext?.prototype);

  // MediaStream
  Object.defineProperty(MediaStream.prototype, Symbol.toStringTag, {
    value: "MediaStream",
  });

  // Spoof timing precision (optional)
  const nativeNow = performance.now.bind(performance);
  performance.now = spoofNative(() => {
    return Math.floor(nativeNow() * 1000) / 1000;
  }, "now");
};

export default spoofVideoAndAudio;
