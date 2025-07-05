// DeepBotExtendedTests.js
(async () => {
  const result = {
    permissions: {},
    webgl: {},
    battery: {},
    storage: {},
    connection: {},
    webrtc: {},
    advanced: {},
    additional: {},
  };

  // Extended Permissions
  const permissionsToCheck = [
    "clipboard-write",
    "camera",
    "microphone",
    "geolocation",
    "notifications",
    "background-sync",
    "persistent-storage",
    "midi",
    "nfc",
    "push",
    "screen-wake-lock",
    "window-management",
    "speaker-selection",
  ];
  for (const name of permissionsToCheck) {
    try {
      const status = await navigator.permissions.query({ name });
      result.permissions[name] = status.state;
    } catch (e) {
      result.permissions[name] = "unsupported";
    }
  }

  // Deep WebGL Tests
  try {
    const canvas = document.createElement("canvas");
    const contexts = ["webgl", "experimental-webgl", "webgl2"];
    result.webgl.contexts = {};
    for (const type of contexts) {
      const gl = canvas.getContext(type);
      if (!gl) continue;
      const ctxInfo = {};
      try {
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        ctxInfo.vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
        ctxInfo.renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
      } catch {}
      ctxInfo.supportedExtensions = gl.getSupportedExtensions();
      ctxInfo.parameters = {
        MAX_TEXTURE_SIZE: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        MAX_VERTEX_ATTRIBS: gl.getParameter(gl.MAX_VERTEX_ATTRIBS),
        SHADING_LANGUAGE_VERSION: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      };

      try {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([0, 0, 0]),
          gl.STATIC_DRAW
        );
        gl.getError();
        ctxInfo.bufferTest = true;
      } catch (e) {
        ctxInfo.bufferTest = false;
      }

      result.webgl.contexts[type] = ctxInfo;
    }
  } catch (e) {
    result.webgl.error = e.message;
  }

  // Deep Battery Info
  try {
    const battery = await navigator.getBattery();
    result.battery = {
      level: battery.level,
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
    };
  } catch (e) {
    result.battery.error = e.message;
  }

  // Deep Storage Tests
  try {
    localStorage.setItem("__test", "1");
    sessionStorage.setItem("__test", "1");
    result.storage = {
      localStorage: localStorage.getItem("__test") === "1",
      sessionStorage: sessionStorage.getItem("__test") === "1",
      indexedDB: !!indexedDB,
      cacheStorage: !!caches,
      estimate: await navigator.storage.estimate(),
    };
    localStorage.removeItem("__test");
    sessionStorage.removeItem("__test");
  } catch (e) {
    result.storage.error = e.message;
  }

  // Connection Info
  try {
    const connection =
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection;
    if (connection) {
      result.connection = {
        effectiveType: connection.effectiveType,
        rtt: connection.rtt,
        downlink: connection.downlink,
        saveData: connection.saveData,
      };
    }
  } catch (e) {
    result.connection.error = e.message;
  }

  // Deep WebRTC Tests
  try {
    const rtc = new RTCPeerConnection();
    result.webrtc.states = {
      iceConnectionState: rtc.iceConnectionState,
      iceGatheringState: rtc.iceGatheringState,
    };
    rtc.createDataChannel("test");
    rtc.createOffer().then((offer) => {
      rtc.setLocalDescription(offer);
    });
    rtc.onicecandidate = (event) => {
      if (event.candidate) {
        result.webrtc.candidate = event.candidate.candidate;
      }
    };
    setTimeout(() => rtc.close(), 1000);
  } catch (e) {
    result.webrtc.error = e.message;
  }

  // Advanced Timing & Fingerprint Analysis
  try {
    result.advanced.performance = {
      now: performance.now(),
      timing: { ...performance.timing },
      navigation: { ...performance.navigation },
    };

    result.advanced.animation = [];
    let lastTime = performance.now();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) =>
        requestAnimationFrame((t) => {
          result.advanced.animation.push(t - lastTime);
          lastTime = t;
          resolve();
        })
      );
    }

    const observer = new MutationObserver(() => {});
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
    });
    result.advanced.mutationObserver = true;
  } catch (e) {
    result.advanced.error = e.message;
  }

  // Additional Checks
  try {
    result.additional.pluginsLength = navigator.plugins.length;
    result.additional.mimeTypesLength = navigator.mimeTypes.length;
    result.additional.errorStack = new Error().stack.split("\n").slice(0, 3);
    result.additional.screenOrientation = screen.orientation?.type;
    result.additional.outerVsInnerMismatch =
      window.outerWidth - window.innerWidth !== 0;
    result.additional.deviceMemory = navigator.deviceMemory;

    // Audio Fingerprint
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    oscillator.type = "triangle";
    oscillator.frequency.value = 1000;
    oscillator.connect(analyser);
    analyser.connect(ctx.destination);
    oscillator.start();
    const array = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(array);
    result.additional.audioEntropy = array.slice(0, 10);
    oscillator.stop();

    // Invalid Permission Query
    try {
      await navigator.permissions.query();
      result.additional.invalidPermission1 = "no error";
    } catch (e) {
      result.additional.invalidPermission1 = e.message;
    }
    try {
      await navigator.permissions.query({ name: "invalid-permission" });
      result.additional.invalidPermission2 = "no error";
    } catch (e) {
      result.additional.invalidPermission2 = e.message;
    }
  } catch (e) {
    result.additional.error = e.message;
  }

  console.log(
    "%c[Deep Bot Extended Tests]",
    "color: green; font-weight: bold;"
  );
  console.dir(result);
})();
