const shouldBeSupportedFeatureList = {
  navigator_userAgentData: {
    minVersion: 89,
    path: "navigator.userAgentData",
    weight: 3,
  },
  navigator_plugins: {
    minVersion: 1,
    path: "navigator.plugins",
    weight: 1,
  },
  navigator_mimeTypes: {
    minVersion: 1,
    path: "navigator.mimeTypes",
    weight: 1,
  },
  navigator_serial: {
    minVersion: 80,
    path: "navigator.serial",
    weight: 2,
  },
  navigator_hid: {
    minVersion: 89,
    path: "navigator.hid",
    weight: 2,
  },
  navigator_usb: {
    minVersion: 61,
    path: "navigator.usb",
    weight: 2,
  },
  navigator_bluetooth: {
    minVersion: 56,
    path: "navigator.bluetooth",
    weight: 2,
  },
  navigator_mediaCapabilities: {
    minVersion: 68,
    path: "navigator.mediaCapabilities",
    weight: 2,
  },
  navigator_clipboard: {
    minVersion: 66,
    path: "navigator.clipboard",
    weight: 3,
  },
  navigator_clipboard_event: {
    minVersion: 1,
    path: "window.ClipboardEvent",
    weight: 3,
  },
  navigator_getBattery: {
    minVersion: 38,
    path: "navigator.getBattery",
    weight: 2,
  },
  window_chrome: {
    minVersion: 1,
    path: "window.chrome",
    weight: 3,
  },
  screen_metrics: {
    minVersion: 1,
    path: "window.screen",
    weight: 1,
  },
  media_devices: {
    minVersion: 53,
    path: "navigator.mediaDevices",
    weight: 3,
  },
  matchMedia: {
    minVersion: 9,
    path: "window.matchMedia",
    weight: 2,
  },

  CSS_supports: {
    minVersion: 22,
    path: "window.CSS.supports",
    weight: 2,
  },
  CSSStyleSheet: {
    minVersion: 1,
    path: "window.CSSStyleSheet",
    weight: 2,
  },
  CSS_paintWorklet: {
    minVersion: 68,
    path: "CSS.paintWorklet",
    weight: 3,
  },
  CSS_registerProperty: {
    minVersion: 68,
    path: "CSS.registerProperty",
    weight: 2,
  },
  requestIdleCallback: {
    minVersion: 47,
    path: "window.requestIdleCallback",
    weight: 1,
  },
  requestAnimationFrame: {
    minVersion: 1,
    path: "window.requestAnimationFrame",
    weight: 1,
  },
  Intl: {
    minVersion: 24,
    path: "window.Intl",
    weight: 2,
  },
  networkConnection: {
    minVersion: 61,
    path: "navigator.connection",
    weight: 2,
  },
  indexedDB: {
    minVersion: 23,
    path: "window.indexedDB",
    isFunction: false,
    methods: ["open", "deleteDatabase"],
    weight: 2,
    checkRuntime: true,
  },
  localStorage: {
    minVersion: 4,
    path: "window.localStorage",
    weight: 2,
  },
  sessionStorage: {
    minVersion: 5,
    path: "window.sessionStorage",
    weight: 2,
  },
  StorageManager: {
    minVersion: 57,
    path: "navigator.storage",
    weight: 3,
  },
  caches: {
    minVersion: 40,
    path: "window.caches",
    weight: 3,
  },
  permissions: {
    minVersion: 43,
    path: "navigator.permissions",
    weight: 3,
  },
  webrtc: {
    minVersion: 23,
    path: "window.RTCPeerConnection",
    weight: 3,
  },
  offlineAudio: {
    minVersion: 35,
    path: "window.OfflineAudioContext",
    weight: 2,
  },
  audioContext: {
    minVersion: 10,
    path: "window.AudioContext",
    weight: 2,
  },
  audioWorklet: {
    minVersion: 66,
    path: "AudioWorklet",
    weight: 3,
  },
  MediaRecorder: {
    minVersion: 49,
    path: "window.MediaRecorder",
    isFunction: true,
    methods: ["start", "stop", "pause", "resume"],
    checkRuntime: true,
    weight: 3,
  },
  Atomics: {
    minVersion: 60,
    path: "window.Atomics",
    isFunction: false,
    weight: 2,
    methods: ["wait", "notify", "add", "sub", "store"],
  },
  ResizeObserver: {
    minVersion: 64,
    path: "window.ResizeObserver",
    weight: 3,
  },
  IntersectionObserver: {
    minVersion: 51,
    path: "window.IntersectionObserver",
    weight: 3,
  },
  MutationObserver: {
    minVersion: 14,
    path: "window.MutationObserver",
    weight: 3,
  },
  PerformanceObserver: {
    minVersion: 52,
    path: "window.PerformanceObserver",
    weight: 2,
  },

  TextEncoder: {
    minVersion: 38,
    path: "window.TextEncoder",
    isFunction: true,
    methods: ["encode"],
    checkRuntime: true,
    weight: 2,
  },
  FinalizationRegistry: {
    minVersion: 84,
    path: "window.FinalizationRegistry",
    isFunction: true,
    methods: ["register", "unregister"],
    checkRuntime: true,
    weight: 3,
  },
  WeakRef: {
    minVersion: 84,
    path: "window.WeakRef",
    isFunction: true,
    methods: ["deref"],
    checkRuntime: true,
    weight: 3,
  },
  WebAssembly: {
    minVersion: 57,
    path: "window.WebAssembly",
    isFunction: false,
    methods: ["instantiate", "validate", "compile"],
    checkRuntime: true,
    weight: 3,
  },
  ReadableStream: {
    minVersion: 65,
    path: "window.ReadableStream",
    isFunction: true,
    methods: ["getReader"],
    checkRuntime: true,
    weight: 2,
  },
  FunctionPrototypeToString: {
    minVersion: 1,
    path: "Function.prototype.toString",
    isFunction: true,
    methods: [],
    checkRuntime: true,
    weight: 2,
  },
  ErrorPrototypeToString: {
    minVersion: 1,
    path: "Error.prototype.toString",
    isFunction: true,
    methods: [],
    checkRuntime: true,
    weight: 2,
  },
  HTMLCanvasElement: {
    minVersion: 1,
    path: "window.HTMLCanvasElement",
    isFunction: false,
    methods: ["getContext", "toDataURL", "toBlob"],
    checkRuntime: true,
    weight: 2,
  },
  ImageBitmap: {
    minVersion: 50,
    path: "window.ImageBitmap",
    isFunction: true,
    methods: [],
    checkRuntime: true,
    weight: 1,
  },
  createImageBitmap: {
    minVersion: 50,
    path: "window.createImageBitmap",
    isFunction: true,
    methods: [],
    checkRuntime: true,
    weight: 2,
  },
  OffscreenCanvas: {
    minVersion: 69,
    path: "window.OffscreenCanvas",
    isFunction: true,
    methods: ["getContext", "transferToImageBitmap", "convertToBlob"],
    checkRuntime: true,
    weight: 3,
  },
  CanvasRenderingContext2D: {
    minVersion: 1,
    path: "window.CanvasRenderingContext2D",
    isFunction: false,
    methods: ["fillRect", "getImageData", "drawImage"],
    checkRuntime: true,
    weight: 2,
  },
  OffscreenCanvasRenderingContext2D: {
    minVersion: 76,
    path: "window.OffscreenCanvasRenderingContext2D",
    isFunction: false,
    methods: ["fillRect", "getImageData", "drawImage"],
    checkRuntime: true,
    weight: 3,
  },
};

const result = {
  functions: {},
  touchSupport: {
    ontouchstart_in_Window: "ontouchstart" in window,
    ontouchend_in_Window: "ontouchend" in window,
    pointerEvent_in_Window: "PointerEvent" in window,
    touchEvent_in_Window: "TouchEvent" in window,
    deviceMotionEvent_in_Window: "DeviceMotionEvent" in window,
  },
  navigator: {},
  plugins: {},
  mimeTypes: {},
  serial: {},
  hid: {},
  usb: {},
  bluetooth: {},
  mediaCapabilities: {},
  mediaDevices: {},
  chrome: {
    app: {},
    runtime: {},
  },
  screen_metrics: {},
  cssSupports: {},
  css_styleSheet: {},
  cssPaintWorklet: {},
  cssRegisterProperty: {},
  matchMedia: {},

  timers: {},
  mediaQueries: {},
  storage: {},
  clipboard: {},
  clipboardEvent: {},
  battery: {},
  requestAnimationFrameData: {},
  requestIdleCallbackData: {},
  performance: {},
  offlineAudio: {},
  audioContext: {},
  audioWorklet: {},
  intl: {},
  observers: {},
  randomness: {},
  network: {},
  mediaRecorder: {},
  atomics: {},
  permissions: {
    permissionsMeta: {},
    additional: {},
  },
  webgl: {},
  webrtc: {
    webrtcMeta: {},
  },
  canvas: {},
  visibility: {
    hidden: document.hidden,
    visibilityState: document.visibilityState,
  },
  offscreenCanvas: {},
  bitmapRendererStability: {},
  webglShaderTest: [],
  connection: {},
  canvasConsistency: {},
  logs: {},
  logsScore: 0,
  errorScore: 0,
  successScore: 0,
};

const logFinalResult = () => {
  const total = result.logsScore || 1;
  const averageScore = result.successScore / total;
  const errorImpact = result.errorScore / total;

  result.finalScore = +averageScore.toFixed(3); // Score like reCAPTCHA

  let verdict = "";
  let color = "";

  if (averageScore >= 0.9 && errorImpact < 0.05) {
    verdict = "✅ Real Browser (Score ≥ 0.9)";
    color = "green";
  } else if (averageScore >= 0.6 && errorImpact < 0.2) {
    verdict = "⚠️ Possibly Real but Suspicious (Score ~ 0.6 - 0.9)";
    color = "orange";
  } else {
    verdict = "🚫 Likely Fake / Emulated (Score < 0.6)";
    color = "red";
  }

  console.groupCollapsed(
    `%c  ${verdict} — Score: ${averageScore.toFixed(2)}`,
    `color: ${color}; font-size: 18px; font-weight: bold`
  );

  console.log("✅ Success Score:", result.successScore.toFixed(2));
  console.log("❌ Error Score:", result.errorScore.toFixed(2));
  console.log("📊 Logs Score (Total Weight):", result.logsScore.toFixed(2));
  console.log("📈 Final Score:", result.finalScore.toFixed(3));
  console.groupEnd();

  console.groupCollapsed(`🧾 Logs (${Object.keys(result.logs).length})`);
  for (const [key, value] of Object.entries(result.logs)) {
    const isError =
      /^Error[:\.]?/i.test(value) ||
      /missing|invalid|mismatch|suspicious|warning/i.test(value);
    console.log(
      `%c${key}: %c${value}`,
      isError ? "color: crimson" : "color: green",
      isError ? "color: #ff4d4d" : "color: #00cc66"
    );
  }
  console.groupEnd();
};

const runValidationWithScore = ({
  key,
  condition = null,
  error = null,
  okMsg = "OK",
  scoreIfOk = 0.2,
  scoreIfError = 0,
  notActualError = true,
  targetPath = "navigator",
}) => {
  if (!key) {
    throw new Error("runValidationWithScore requires a 'key'");
  }

  let errorMsg = null;

  if (error) {
    condition = true;

    if (typeof error === "object" && error.message) {
      const message = error.message;

      if (message.includes("TypeError")) {
        errorMsg = `Error: ${message}`;
        scoreIfError = scoreIfError || 0.25;
      } else if (
        message.includes("not implemented") ||
        message.includes("invalid") ||
        message.includes("missing") ||
        message.includes("undefined")
      ) {
        errorMsg = `Error: ${message}`;
        scoreIfError = scoreIfError || 0.1;
      } else {
        errorMsg = `Error: ${message}`;
        scoreIfError = scoreIfError || 0;
      }
    } else if (typeof error === "string") {
      errorMsg = `Error: ${error}`;
      scoreIfError = scoreIfError || 0.1;
    }
  }

  const isError = Boolean(condition);
  const message = isError ? errorMsg || `Error: ${key}` : okMsg;
  const score = isError ? scoreIfError : scoreIfOk;

  result.logs[key] = message;
  result.logsScore += score;

  const isRealError =
    /^Error[:\.]?/i.test(message) ||
    /missing|invalid|mismatch|suspicious|partial|warning/i.test(message);

  if (isRealError) {
    result.errorScore += score;
  } else {
    result.successScore += score;
  }

  if (isError && !notActualError && targetPath) {
    result[targetPath].hasError = true;
  }
};

const recordFunctionExecution = async ({
  shouldThrow = false,
  key,
  fn,
  params = [],
  targetPath,
}) => {
  let condition = false;
  let error = null;
  let okMsg = shouldThrow ? "Expected to throw" : "Executed successfully";

  try {
    await fn(...params);
    condition = shouldThrow;
  } catch (e) {
    error = shouldThrow ? null : e;
    condition = !shouldThrow;
  }

  runValidationWithScore({
    key,
    condition,
    error,
    okMsg,
    scoreIfOk: 0.25,
    scoreIfError: 0.25,
    targetPath,
  });

  return !condition; // true = validation passed
};

const isNative = (fn, name) => {
  const isValidNative =
    typeof fn === "function" && /\[native code\]/.test(fn.toString());

  runValidationWithScore({
    key: `${name}.native`,
    condition: !isValidNative,
    okMsg: `${name} is native (expected)`,
    error: "not native (not expected)",
    scoreIfOk: 0.25,
    scoreIfError: 0.1,
    targetPath: "functions",
  });

  result.functions[name] = isValidNative;
  return isValidNative;
};

const isFeatureValid = (chromeVersion, featureName) => {
  const feature = shouldBeSupportedFeatureList[featureName];
  if (!feature) throw new Error(`Unknown feature: ${featureName}`);

  const weight = feature.weight ?? 1;
  const expectedAvailable = chromeVersion >= feature.minVersion;

  let featurePath = feature.path.startsWith("window.")
    ? feature.path
    : `window.${feature.path}`;

  runValidationWithScore({
    key: featurePath,
    condition: false,
    error: `feature='${featureName}' not available in current chrome (version ${chromeVersion} < ${feature.minVersion})`,
    scoreIfOk: 0,
    notActualError: true,
  });

  if (!expectedAvailable) {
    return {
      isValid: true,
      featureWeight: weight,
      expectedAvailable,
      actuallyExists: false,
      canCheckFeature: false,
    };
  }

  result.stepsScore += 1;

  const ref = featurePath
    .split(".")
    .reduce((obj, key) => obj && obj[key], window);

  const actuallyExists = typeof ref !== "undefined" && ref !== null;

  runValidationWithScore({
    key: featurePath,
    condition: !actuallyExists,
    error: `Feature '${featureName}' missing at path '${featurePath}'`,
    scoreIfError: weight,
    scoreIfOk: weight,
  });

  if (!actuallyExists) {
    return {
      isValid: false,
      featureWeight: weight,
      expectedAvailable,
      actuallyExists,
      canCheckFeature: false,
    };
  }

  runValidationWithScore({
    key: featurePath,
    condition: false,
    okMsg: `Feature '${featureName}' exists and is accessible (expected)`,
    scoreIfOk: weight,
  });

  return {
    isValid: true,
    score: 1,
    featureWeight: weight,
    expectedAvailable,
    actuallyExists,
    canCheckFeature: true,
  };
};

const runFunctionValidtyCheck = () => {
  const asyncFunctionConstructor = async function () {}.constructor;

  // === NEW: Global native checks ===
  const globalChecks = [
    ["window.removeEventListener", window.removeEventListener],
    ["window.addEventListener", window.addEventListener],
    ["asyncFunctionConstructor", asyncFunctionConstructor],
    ["window.getSelection", window.getSelection],
    ["window.getComputedStyle", window.getComputedStyle],
    ["window.BigInt", window.BigInt],
    ["window.structuredClone", window.structuredClone],
    ["document.execCommand", document.execCommand][("eval", eval)],
    ["console.log", console.log],
    ["console.debug", console.debug],
    ["window.Function", window.Function],
    ["Function.prototype.toString", Function.prototype.toString],
    ["Function.prototype.toString", Function.prototype.toString.toString],
    ["setTimeout", setTimeout],
    ["setInterval", setInterval],
    ["clearTimeout", clearTimeout],
    ["clearInterval", clearInterval],
    ["requestAnimationFrame", requestAnimationFrame],
    ["cancelAnimationFrame", cancelAnimationFrame],
    ["Promise", Promise],
    ["Reflect", Reflect],
    ["Proxy", Proxy],
    ["Object.defineProperty", Object.defineProperty],
    ["Object.freeze", Object.freeze],
    ["Array.prototype.map", Array.prototype.map],
    ["Map", Map],
    ["Set", Set],
    ["WeakMap", WeakMap],
    ["WeakSet", WeakSet],
    ["Date", Date],
    ["Math.random", Math.random],
    ["Math.floor", Math.floor],
    ["Math.ceil", Math.ceil],
    ["Math.round", Math.round],
    ["Math.min", Math.min],
    ["Math.max", Math.max],
    ["Math.abs", Math.abs],
    ["Math.pow", Math.pow],
    ["Math.sqrt", Math.sqrt],
    ["Math.log", Math.log],
    ["Math.log10", Math.log10],
    ["Math.exp", Math.exp],
    ["Math.sin", Math.sin],
    ["Math.cos", Math.cos],
    ["Math.tan", Math.tan],
    ["Math.asin", Math.asin],
    ["Date.now", Date.now],
    ["Date.UTC", Date.UTC],
    ["Date.prototype.toJSON", Date.prototype.toJSON],
    ["Date.toString", Date.toString],
    ["window.Promise", window.Promise],
    ["window.Set", window.Set],
    ["window.Map", window.Map],
    ["window.Proxy", window.Proxy],
    ["window.Reflect", window.Reflect],
    ["navigator.locks?.lock", navigator.locks?.lock],
    ["navigator.locks?.query", navigator.locks?.query],
    ["MutationObserver", MutationObserver],
    ["MutationObserver.prototype", MutationObserver.prototype],
    ["ResizeObserver", ResizeObserver],
    ["ResizeObserver.prototype", ResizeObserver.prototype],
    ["IntersectionObserver", IntersectionObserver],
    ["IntersectionObserver.prototype", IntersectionObserver.prototype],
    ["PerformanceObserver.prototype", PerformanceObserver.prototype],
  ];

  for (const [label, fn] of globalChecks) {
    try {
      isNative(fn, label);
    } catch (error) {}
  }
};

const checkNavigatorFingerprintIntegrity = () => {
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const language = navigator.language;
  const languages = navigator.languages;
  const webdriver = navigator.webdriver;
  const concurrency = navigator.hardwareConcurrency;
  const memory = navigator.deviceMemory;
  const plugins = navigator.plugins;
  const mimeTypes = navigator.mimeTypes;
  const vendor = navigator.vendor;
  const product = navigator.product;
  const appCodeName = navigator.appCodeName;
  const appName = navigator.appName;
  const doNotTrack = navigator.doNotTrack;
  const maxTouchPoints = navigator.maxTouchPoints;

  const productSub = navigator.productSub;
  const appVersion = navigator.appVersion;

  const hasBeenActive = navigator.userActivation?.hasBeenActive ?? null;
  const isActive = navigator.userActivation?.isActive ?? null;

  const pointerEnabledLegacy = navigator.pointerEnabled;

  const base = {
    userAgent: ua,
    platform,
    language,
    languages,
    webdriver,
    hardwareConcurrency: concurrency,
    deviceMemory: memory,
    vendor,
    product,
    productSub,
    appVersion,
    appCodeName,
    appName,
    doNotTrack,
    maxTouchPoints,
    pointerEnabledLegacy,
    hasBeenActive,
    isActive,
  };

  result.navigator = {
    hasError: false,
    base,
  };

  // Define test cases as [condition, key, message, score]
  const tests = [
    [
      !plugins?.length || !mimeTypes?.length,
      "navigator.plugins.or.mimeTypes.missing",
    ],
    [!languages?.length, "languages.empty"],
    [
      languages?.length > 0 &&
        language?.toLowerCase() !== languages[0]?.toLowerCase(),
      "language.mismatch",
      `Found languages=[${languages.join(", ")}] but language=${language}`,
    ],
    [
      !ua || !platform,
      "navigator.userAgent.or.platform.missing",
      `Found userAgent=${ua} and platform=${platform}`,
    ],
    [!vendor, "navigator.vendor.missing"],
    [!product, "navigator.product.missing"],
    [!appCodeName, "navigator.appCodeName.missing"],
    [!appName, "navigator.appName.missing"],
    [
      hasBeenActive === false,
      "userActivation.hasBeenActive.false",
      "userActivation.hasBeenActive = false (may indicate automation)",
    ],
    [
      isActive === false,
      "userActivation.isActive.false",
      "userActivation.isActive = false (may indicate automation)",
    ],
    [webdriver, "webdriver.detected", "webdriver=true"],
    [
      !Number.isInteger(concurrency) || concurrency <= 0,
      "hardwareConcurrency.invalid",
      `hardwareConcurrency suspicious concurrency(${concurrency})`,
    ],
    [
      !Number.isFinite(memory) || memory <= 0 || memory > 128,
      "deviceMemory.invalid",
      `deviceMemory suspicious (${memory})`,
    ],
    [
      vendor !== "Google Inc.",
      "vendor.invalid",
      `Unexpected vendor: ${vendor}`,
    ],
    [product !== "Gecko", "product.invalid", `navigator.product=${product}`],
    [
      appCodeName !== "Mozilla",
      "appCodeName.invalid",
      `navigator.appCodeName=${appCodeName}`,
    ],
    [appName !== "Netscape", "appName.invalid", `navigator.appName=${appName}`],
    [
      doNotTrack && doNotTrack !== "1",
      "doNotTrack.invalid",
      `Unexpected DNT: ${doNotTrack}`,
    ],
    [
      maxTouchPoints > 0,
      "maxTouchPoints.suspicious",
      `maxTouchPoints=${maxTouchPoints} on desktop`,
    ],
    [
      pointerEnabledLegacy === true,
      "pointerEnabled.legacy.unexpected",
      `navigator.pointerEnabled = true on non-IE browser`,
    ],
    [
      !result.touchSupport.pointerEvent_in_Window,
      "pointerEvent.missing",
      `PointerEvent not in window (no support)`,
    ],
  ];

  tests.forEach(([condition, key, message]) => {
    const score = 1 / tests.length;
    runValidationWithScore({
      key,
      condition,
      error: message || key,
      scoreIfError: score,
      scoreIfOk: score,
      targetPath: "navigator",
    });
  });

  const chromeMatch = ua.match(/Chrome\/(\d+)/);
  const versionFromUA = chromeMatch ? parseInt(chromeMatch[1]) : NaN;

  result.navigator.base.versionFromUA = versionFromUA;

  const isVersionInvalid = isNaN(versionFromUA);

  runValidationWithScore({
    key: "userAgent.version.invalid",
    condition: isVersionInvalid,
    error: "Could not parse Chrome version from UA (invalid version)",
    targetPath: "navigator",
  });

  if (!isVersionInvalid) {
    result.navigator.chromeVersion = versionFromUA;
  }

  const isMobile = /Android|Mobi/i.test(ua);
  result.navigator.base.isMobile = isMobile;

  const touchPropsPresentButZeroTouchPoints =
    (result.touchSupport.ontouchstart_in_Window ||
      result.touchSupport.touchEvent_in_Window) &&
    maxTouchPoints === 0;

  runValidationWithScore({
    key: "touchProps.presentButZeroTouchPoints",
    condition: touchPropsPresentButZeroTouchPoints,
    error:
      "Touch props present but maxTouchPoints = 0 (likely desktop with no touch screen)",
    scoreIfError: 0.1,
    targetPath: "navigator",
    notActualError: true,
  });

  const maxTouchPointsNoTouchEvents =
    maxTouchPoints > 0 &&
    !result.touchSupport.ontouchstart_in_Window &&
    !result.touchSupport.touchEvent_in_Window;

  runValidationWithScore({
    key: "maxTouchPoints.presentButNoTouchEvents",
    condition: maxTouchPointsNoTouchEvents,
    error: "maxTouchPoints > 0 but no touch-related props found",
    targetPath: "navigator",
  });

  runValidationWithScore({
    key: "pointerEnabled.legacy.unexpected",
    condition: pointerEnabledLegacy === true && !/Trident|MSIE/.test(ua),
    error: "navigator.pointerEnabled = true on non-IE browser",
    targetPath: "navigator",
  });

  const props = [
    "userAgent",
    "platform",
    "language",
    "appVersion",
    "appName",
    "productSub",
  ];

  for (const prop of props) {
    const desc = Object.getOwnPropertyDescriptor(Navigator.prototype, prop);
    const isNative = desc?.get?.toString().includes("[native code]");
    result.navigator.toStringTests = result.navigator.toStringTests || {};
    const propTestName = `${prop}.toString.is.overridden`;

    result.navigator.toStringTests[propTestName] = isNative
      ? "native"
      : "overridden";

    runValidationWithScore({
      key: `toStringTests.${propTestName}`,
      condition: !isNative,
      error: "overridden",
      okMsg: "native (expected)",
      scoreIfError: 0.25,
      scoreIfOk: 0.25,
      targetPath: "navigator",
    });
  }

  const expectedTouch = isMobile ? [1, 2, 5, 10] : [0];
  const suspiciousMaxTouch = !expectedTouch.includes(maxTouchPoints);

  runValidationWithScore({
    key: "maxTouchPoints.suspicious",
    condition: suspiciousMaxTouch,
    error: `maxTouchPoints=${maxTouchPoints} on ${
      isMobile ? "mobile" : "desktop"
    }`,
    targetPath: "navigator",
  });

  try {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    const iframeNav = iframe.contentWindow.navigator;

    const isIframeUAMatchedUA = iframeNav.userAgent === ua;
    const iframeNavPlatform = iframeNav.platform === platform;

    result.navigator.base.isIframeUAMatchedUA = isIframeUAMatchedUA;
    result.navigator.base.iframeNavPlatform = iframeNavPlatform;

    runValidationWithScore({
      key: "iframe.userAgent.mismatch",
      condition: !isIframeUAMatchedUA,
      error: `iframe UA mismatch iframeNavUa(${iframeNav.userAgent}) vs ua(${ua})`,
      targetPath: "navigator",
    });

    runValidationWithScore({
      key: "iframe.platform.mismatch",
      condition: !iframeNavPlatform,
      error: `iframe platform mismatch iframeNavPlatform(${iframeNav.platform}) vs platform(${platform})`,
      targetPath: "navigator",
    });

    document.body.removeChild(iframe);
  } catch (e) {
    result.navigator.base.hasIframeError = true;

    runValidationWithScore({
      key: "iframe.error",
      condition: true,
      error: e,
      targetPath: "navigator",
    });
  }
};

const checkAndTestNavigatorUserAgentData = async () => {
  const key = "navigator_userAgentData";
  const {
    navigator: {
      hasError,
      base: { versionFromUA, platform: isMobile, userAgent },
    },
  } = result;

  if (hasError) return;

  // زيادة النقاط تتم في isFeatureValid
  const { canCheckFeature, featureWeight } = isFeatureValid(versionFromUA, key);

  if (!canCheckFeature) return;

  result.navigator.chromeVersion = undefined;

  const uaData = navigator.userAgentData;
  result.navigator.userAgentData = { available: !!uaData };

  runValidationWithScore({
    key,
    condition: !uaData,
    error: "navigator.userAgentData is not available",
    scoreIfError: 0.25,
    targetPath: "navigator",
  });

  if (!uaData) {
    return;
  }

  const lowEntropy = {
    brands: uaData.brands || uaData.uaList || [],
    mobile: uaData.mobile,
    platform: uaData.platform,
  };

  result.navigator.userAgentData.lowEntropy = lowEntropy;

  const highEntropyKeys = [
    "architecture",
    "bitness",
    "brands",
    "fullVersionList",
    "model",
    "mobile",
    "platform",
    "platformVersion",
    "uaFullVersion",
    "wow64",
  ];

  let highEntropy = {};
  try {
    highEntropy = await uaData.getHighEntropyValues(highEntropyKeys);
    result.navigator.userAgentData.highEntropy = highEntropy;
    runValidationWithScore({
      key: `${key}.getHighEntropyValues.failed`,
      condition: false,
      targetPath: "navigator",
      scoreIfOk: 0,
    });
  } catch (err) {
    runValidationWithScore({
      key: `${key}.getHighEntropyValues.failed`,
      condition: true,
      error: err,
      targetPath: "navigator",
    });
    return;
  }

  const props = ["brands", "mobile", "platform", "getHighEntropyValues"];

  for (const prop of props) {
    const desc = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(uaData),
      prop
    );
    const isNative =
      desc?.get?.toString().includes("[native code]") ||
      desc?.value?.toString().includes("[native code]");

    result.navigator.toStringTests = result.navigator.toStringTests || {};

    const testKey = `userAgentData.${prop}.toString`;

    result.navigator.toStringTests[testKey] = isNative
      ? "native"
      : "overridden";

    runValidationWithScore({
      key: testKey,
      condition: !isNative,
      error: `${testKey} is overridden`,
      targetPath: "navigator",
    });
  }

  // تحقق من صحة brands
  const validateBrands = (brands) => {
    const flattened = brands.map((b) => b.brand).join(" | ");
    const hasGoogle = brands.some((b) => b.brand.includes("Google Chrome"));
    const hasNotA = brands.some(
      (b) => b.brand === "Not A Brand" || b.brand === "Not/A)Brand"
    );
    const hasVersion = brands.some((b) => b.version?.length > 0);
    const brandsInvalid = !hasGoogle || !hasNotA || !hasVersion;

    result.navigator.userAgentData.brandsValid = !brandsInvalid;

    runValidationWithScore({
      key: "userAgentData.brands.invalid",
      condition: brandsInvalid,
      error: `Suspicious brands: ${flattened}`,
      targetPath: "navigator",
    });
  };

  validateBrands(lowEntropy.brands);

  // تحقق من وجود brands في lowEntropy
  runValidationWithScore({
    key: "userAgentData.lowEntropy.brands.missing",
    condition:
      !Array.isArray(lowEntropy.brands) || lowEntropy.brands.length === 0,
    error: "navigator.userAgentData.brands is missing or empty",
    targetPath: "navigator",
  });

  // مقارنة بين brands في lowEntropy و fullVersionList في highEntropy
  const matchBrands = (a, b) => {
    const extractBrands = (arr) => arr.map((x) => x.brand).sort();
    const aBrands = extractBrands(a);
    const bBrands = extractBrands(b);
    if (aBrands.length !== bBrands.length) return false;
    return aBrands.every((brand, i) => brand === bBrands[i]);
  };

  const brandsMatchHighEntropy = matchBrands(
    lowEntropy.brands,
    highEntropy.fullVersionList
  );

  result.navigator.userAgentData.brandsMatchHighEntropy =
    brandsMatchHighEntropy;

  runValidationWithScore({
    key: "userAgentData.brand.fullVersionList.mismatch",
    condition: !brandsMatchHighEntropy,
    error: "Mismatch between brands and fullVersionList",
    targetPath: "navigator",
  });

  runValidationWithScore({
    key: "userAgentData.lowEntropy.mobile.invalid",
    condition: typeof lowEntropy.mobile !== "boolean",
    error: "navigator.userAgentData.mobile is not boolean",
    targetPath: "navigator",
  });

  // // تحقق من platformVersion مع platform
  // runValidationWithScore({
  //   key: "userAgentData.platformVersion.platformMismatch",
  //   condition:
  //     typeof highEntropy.platformVersion === "string" &&
  //     !["Win", "Mac", "Linux"].includes(navigatorPlatform),
  //   error: `Suspicious platform mismatch: platform=${navigatorPlatform}, version=${highEntropy.platformVersion}`,
  //   targetPath: "navigator",
  // });

  // تحقق من architecture
  runValidationWithScore({
    key: "userAgentData.architecture.invalid",
    condition:
      highEntropy.architecture === "unknown" || highEntropy.architecture === "",
    error: `Invalid architecture: ${highEntropy.architecture}`,
    scoreIfError: 0,
    targetPath: "navigator",
  });

  // تحقق من model مع non mobile
  runValidationWithScore({
    key: "userAgentData.model.nonMobile",
    condition: highEntropy.model?.length > 0 && !isMobile,
    error: `model=${highEntropy.model} but device is not mobile isMobile=${isMobile}`,
    scoreIfError: 0,
    targetPath: "navigator",
  });

  const entropyKeysReturned = Object.keys(highEntropy).length;
  const expectedKeys = highEntropyKeys.length;
  const entropyKeysReturnedSameAsExpected =
    entropyKeysReturned === expectedKeys;

  result.navigator.userAgentData.entropyKeysReturnedSameAsExpected =
    entropyKeysReturnedSameAsExpected;

  runValidationWithScore({
    key: "userAgentData.highEntropy.partial",
    condition: !entropyKeysReturnedSameAsExpected,
    error: `Suspicious ${entropyKeysReturned}/${expectedKeys} entropy keys returned`,
    targetPath: "navigator",
  });

  if (!entropyKeysReturnedSameAsExpected) result.navigator.hasError = true;

  // تحقق من تطابق chrome version بين UA و uaFullVersion
  if (highEntropy.uaFullVersion && userAgent.includes("Chrome/")) {
    let entropyChromeVersion = parseInt(
      (highEntropy.uaFullVersion || "").split(".")[0]
    );
    const UAMatchesEntropyChrome = versionFromUA === entropyChromeVersion;

    result.navigator.chromeVersion = entropyChromeVersion;
    result.navigator.userAgentData.UAMatchesEntropyChrome =
      UAMatchesEntropyChrome;

    runValidationWithScore({
      key: "userAgentData.versionMismatch",
      condition: !UAMatchesEntropyChrome,
      error: `Chrome version mismatch: versionFromUA=${versionFromUA}, uaFullVersion=${highEntropy.uaFullVersion}`,
      targetPath: "navigator",
    });
  }

  // اختبارات دوال getHighEntropyValues
  const allGetHighEntropyValuesTests = await Promise.all([
    recordFunctionExecution({
      shouldThrow: true,
      key: "navigator.userAgentData.getHighEntropyValues.noParam",
      fn: navigator.userAgentData.getHighEntropyValues,
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: true,
      key: "navigator.userAgentData.getHighEntropyValues.wrongParams",
      fn: navigator.userAgentData.getHighEntropyValues,
      params: [""],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: true,
      key: "navigator.userAgentData.getHighEntropyValues.right.but.noParam",
      fn: () => Promise.resolve(navigator.userAgentData.getHighEntropyValues()),
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: true,
      key: 'navigator.userAgentData.getHighEntropyValues.right.but.wrongParams("")',
      fn: () =>
        Promise.resolve(navigator.userAgentData.getHighEntropyValues("")),
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: true,
      key: "navigator.userAgentData.getHighEntropyValues.right.but.wrongParams.false",
      fn: () =>
        Promise.resolve(navigator.userAgentData.getHighEntropyValues(false)),
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: true,
      key: "navigator.userAgentData.getHighEntropyValues.right.but.wrongParams.true",
      fn: () =>
        Promise.resolve(navigator.userAgentData.getHighEntropyValues(true)),
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: true,
      key: "navigator.userAgentData.getHighEntropyValues.right.but.wrongParams.object",
      fn: () =>
        Promise.resolve(navigator.userAgentData.getHighEntropyValues({})),
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: false,
      key: "navigator.userAgentData.getHighEntropyValues.right.rightParam.emptyArray",
      fn: async () => await navigator.userAgentData.getHighEntropyValues([]),
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: false,
      key: "navigator.userAgentData.getHighEntropyValues.right.rightParam.brands",
      fn: async () =>
        await navigator.userAgentData.getHighEntropyValues(["brands"]),
      params: [],
      targetPath: "navigator",
    }),
    recordFunctionExecution({
      shouldThrow: false,
      key: "navigator.userAgentData.getHighEntropyValues.right.rightParam.brandsPlatform",
      fn: async () =>
        await navigator.userAgentData.getHighEntropyValues([
          "brands",
          "platform",
        ]),
      params: [],
      targetPath: "navigator",
    }),
  ]);

  const highEntropyTestsSuccess = allGetHighEntropyValuesTests.every(Boolean);

  result.navigator.userAgentData.highEntropyTestsSuccess =
    highEntropyTestsSuccess;

  runValidationWithScore({
    key: "userAgentData.highEntropy.function.tests",
    condition: !highEntropyTestsSuccess,
    error: `Suspicious highEntropyTests (${highEntropyTestsSuccess})`,
    scoreIfOk: featureWeight,
    targetPath: "navigator",
  });
};

const checkPluginsOrMimeTypes = async (chromeVersion, featureKey, arr) => {
  const { canCheckFeature, featureWeight } = isFeatureValid(
    chromeVersion,
    featureKey
  );

  if (!canCheckFeature) {
    return;
  }

  const isPlugins = featureKey.includes("plugins");
  const mainName = isPlugins ? "plugins" : "mimeTypes";

  const list = Array.from(arr).map((a) => (isPlugins ? a.name : a.type));

  isNative(arr.item, `${mainName}.item`);
  isNative(arr.namedItem, `${mainName}.namedItem`);

  if (isPlugins) {
    isNative(arr.refresh, `${mainName}.refresh`);
  }

  // فحص خصائص navigator.plugins / mimeTypes نفسها
  const desc = Object.getOwnPropertyDescriptor(navigator, mainName);
  if (desc) {
    runValidationWithScore({
      key: `${mainName}.writable`,
      condition: desc.writable !== false,
      okMsg: "not writable (expected)",
      error: "writable",
      scoreIfOk: 0.1 * featureWeight,
      scoreIfError: 0.1 * featureWeight,
      targetPath: mainName,
    });

    runValidationWithScore({
      key: `${mainName}.configurable`,
      condition: desc.configurable !== false,
      okMsg: "not configurable (expected)",
      error: "configurable",
      scoreIfOk: 0.1 * featureWeight,
      scoreIfError: 0.1 * featureWeight,
      targetPath: mainName,
    });
  } else {
    runValidationWithScore({
      key: `${featureKey}.descriptor`,
      condition: true,
      error: "Property descriptor not found",
      scoreIfError: featureWeight,
      targetPath: mainName,
    });
  }

  ["length", "item", "namedItem", "refresh"].forEach((prop) => {
    if (prop in arr) {
      const desc = Object.getOwnPropertyDescriptor(arr, prop);
      if (desc) {
        runValidationWithScore({
          key: `${mainName}.${prop}.writable`,
          condition: desc.writable !== false,
          okMsg: "not writable (expected)",
          error: "writable",
          scoreIfOk: 0.05 * featureWeight,
          scoreIfError: 0.05 * featureWeight,
          targetPath: mainName,
        });

        runValidationWithScore({
          key: `${mainName}.${prop}.configurable`,
          condition: desc.configurable !== false,
          okMsg: "not configurable (expected)",
          error: "configurable",
          scoreIfOk: 0.05 * featureWeight,
          scoreIfError: 0.05 * featureWeight,
          targetPath: mainName,
        });
      } else {
        runValidationWithScore({
          key: `${mainName}.${prop}.descriptor`,
          condition: true,
          error: "Property descriptor not found",
          scoreIfError: weight * featureWeight,
          targetPath: mainName,
        });
      }
    }
  });

  try {
    const original = navigator[mainName];
    navigator[mainName] = null;
    runValidationWithScore({
      key: `${mainName}.set`,
      condition: navigator[mainName] !== original,
      okMsg: "not changed (expected)",
      error: "changed",
      scoreIfOk: 0.1 * featureWeight,
      targetPath: mainName,
    });
  } catch (e) {
    runValidationWithScore({
      key: `${mainName}.set`,
      condition: true,
      error: e,
      scoreIfError: 0.1 * featureWeight,
      targetPath: mainName,
    });
  }

  try {
    const deleted = delete navigator[mainName];

    if (!navigator[mainName].length) {
      runValidationWithScore({
        key: `Error: navigator.${mainName}.length is 0, deleted (unexpected)`,
        condition: true,
        error: e,
        scoreIfError: featureWeight,
        targetPath: mainName,
      });
      return;
    }

    runValidationWithScore({
      key: `${mainName}.delete`,
      condition: deleted,
      okMsg: "not deleted (expected)",
      error: "deleted",
      scoreIfOk: 0.1 * featureWeight,
      scoreIfError: 0.1 * featureWeight,
      targetPath: mainName,
    });
  } catch (e) {
    runValidationWithScore({
      key: `${mainName}.delete`,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: mainName,
    });
  }

  // recordFunctionExecution لاختبار item و namedItem
  await Promise.all(
    [
      isPlugins &&
        recordFunctionExecution({
          shouldThrow: true,
          key: `${mainName}.refresh.wrongCall`,
          fn: arr.refresh,
          params: [],
          targetPath: mainName,
        }),
      recordFunctionExecution({
        shouldThrow: true,
        key: `${mainName}.item.call`,
        fn: arr.item,
        params: [],
        targetPath: mainName,
      }),
      recordFunctionExecution({
        shouldThrow: true,
        key: `${mainName}.item()`,
        fn: () => arr.item(),
        params: [],
        targetPath: mainName,
      }),
      recordFunctionExecution({
        shouldThrow: false,
        key: `${mainName}.item("")`,
        fn: () => arr.item(""),
        params: [],
        targetPath: mainName,
      }),
      recordFunctionExecution({
        shouldThrow: false,
        key: `${mainName}.item(0)`,
        fn: () => arr.item(0),
        params: [],
        targetPath: mainName,
      }),
      recordFunctionExecution({
        shouldThrow: true,
        key: `${mainName}.namedItem.call`,
        fn: arr.namedItem,
        params: [],
        targetPath: mainName,
      }),
      recordFunctionExecution({
        shouldThrow: true,
        key: `${mainName}.namedItem()`,
        fn: () => arr.namedItem(),
        params: [],
        targetPath: mainName,
      }),
      recordFunctionExecution({
        shouldThrow: false,
        key: `${mainName}.namedItem("")`,
        fn: () => arr.namedItem(""),
        params: [],
        targetPath: mainName,
      }),
      recordFunctionExecution({
        shouldThrow: false,
        key: `${mainName}.namedItem(${
          isPlugins ? "PDF Viewer" : "application/pdf"
        })`,
        fn: () => arr.namedItem(isPlugins ? "PDF Viewer" : "application/pdf"),
        params: [],
        targetPath: mainName,
      }),
    ].filter(Boolean)
  );

  const elementsHaveProp = list.every((_, i) => {
    const el = arr[i];
    return el && typeof el === "object" && (isPlugins ? "name" : "type") in el;
  });

  runValidationWithScore({
    key: `${mainName}.elementsHaveProperty`,
    condition: !elementsHaveProp,
    okMsg: "all elements have property (expected)",
    error: "missing property",
    scoreIfOk: 0.1,
    scoreIfError: 0,
    targetPath: mainName,
  });

  // التكرارات
  const duplicates = list.filter((item, idx) => list.indexOf(item) !== idx);
  runValidationWithScore({
    key: `${mainName}.duplicates`,
    condition: duplicates.length === 0,
    okMsg: `duplicates: ${duplicates.length} (expected)`,
    error: "no duplicates",
    scoreIfOk: 0.05,
    scoreIfError: 0,
    targetPath: mainName,
  });

  // الطول يطابق العناصر؟
  runValidationWithScore({
    key: `${mainName}.lengthMatch`,
    condition: arr.length !== list.length,
    okMsg: "length matches (expected)",
    error: `mismatch: arr=${arr.length}, list=${list.length}`,
    scoreIfOk: 0.05,
    scoreIfError: 0,
    targetPath: mainName,
  });
};

const checkNavigatorPlugins = async (chromeVersion) => {
  try {
    await checkPluginsOrMimeTypes(
      chromeVersion,
      "navigator_plugins",
      navigator.plugins
    );
  } catch (e) {
    runValidationWithScore({
      key: "plugins.error",
      condition: true,
      error: e,
      scoreIfError: 1,
      targetPath: "plugins",
    });
  }
};

const checkNavigatorMimeTypes = async (chromeVersion) => {
  try {
    await checkPluginsOrMimeTypes(
      chromeVersion,
      "navigator_mimeTypes",
      navigator.plugins
    );
  } catch (e) {
    runValidationWithScore({
      key: "mimeTypes.error",
      condition: true,
      error: e,
      scoreIfError: 1,
      targetPath: "mimeTypes",
    });
  }
};

const checkNavigatorSerial = async (chromeVersion) => {
  const key = "navigator_serial";

  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);
  if (!canCheckFeature) return;

  const target = navigator.serial;
  const methods = ["getPorts", "requestPort"];
  const resultPath = "serial";

  try {
    if (!target) {
      runValidationWithScore({
        key,
        condition: true,
        error: "navigator.serial is not available",
        scoreIfError: featureWeight,
        targetPath: resultPath,
      });
      return;
    }

    // Check methods existence and if native
    const methodResults = {};
    let nativeScore = 0;

    for (const method of methods) {
      const fn = target[method];
      const isFn = typeof fn === "function";
      const isFnNative = isFn && isNative(fn, `navigator.serial.${method}`);
      methodResults[method] = {
        exists: isFn,
        isNative: isFnNative,
      };

      if (isFnNative) nativeScore += 1;
    }

    result[resultPath].methods = methodResults;

    const totalScore = (nativeScore / methods.length) * featureWeight;
    runValidationWithScore({
      key,
      condition: nativeScore < methods.length,
      okMsg: "All methods exist and are native",
      error: `Missing or non-native: ${methods
        .filter((m) => !methodResults[m].isNative)
        .join(", ")}`,
      scoreIfOk: featureWeight,
      scoreIfError: totalScore,
      targetPath: resultPath,
    });
  } catch (e) {
    runValidationWithScore({
      key,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: resultPath,
    });
  }
};

const checkNavigatorHID = async (chromeVersion) => {
  const key = "navigator_hid";
  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  if (!canCheckFeature) return;

  const target = navigator.hid;
  const methods = ["getDevices", "requestDevice"];
  const resultPath = "hid";

  try {
    if (!target) {
      runValidationWithScore({
        key,
        condition: true,
        error: "navigator.hid is not available",
        scoreIfError: featureWeight,
        targetPath: resultPath,
      });
      return;
    }

    const methodResults = {};
    let nativeScore = 0;

    for (const method of methods) {
      const fn = target[method];
      const isFn = typeof fn === "function";
      const isFnNative = isFn && isNative(fn, `navigator.hid.${method}`);
      methodResults[method] = {
        exists: isFn,
        isNative: isFnNative,
      };

      if (isFnNative) nativeScore += 1;
    }

    result[resultPath].methods = methodResults;

    const totalScore = (nativeScore / methods.length) * featureWeight;
    runValidationWithScore({
      key,
      condition: nativeScore < methods.length,
      okMsg: "All methods exist and are native",
      error: `Missing or non-native: ${methods
        .filter((m) => !methodResults[m].isNative)
        .join(", ")}`,
      scoreIfOk: featureWeight,
      scoreIfError: totalScore,
      targetPath: resultPath,
    });
  } catch (e) {
    runValidationWithScore({
      key,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: resultPath,
    });
  }
};

const checkUsbDevices = async (chromeVersion) => {
  const featureName = "navigator_usb";
  const { canCheckFeature, featureWeight } = isFeatureValid(
    chromeVersion,
    featureName
  );

  if (!canCheckFeature) {
    result.usb = {
      supported: false,
      count: 0,
    };
    return;
  }

  try {
    const usbRef = navigator.usb;

    // ✅ check getDevices()
    const devices = await usbRef.getDevices();

    const hasDevicesScore = devices.length > 0 ? 0.25 * featureWeight : 0;

    runValidationWithScore({
      key: `${featureName}.devices`,
      condition: false,
      okMsg: devices.length > 0 ? "Devices found" : "No devices",
      scoreIfOk: hasDevicesScore,
      targetPath: "usb",
    });

    [
      ["getDevices", usbRef.getDevices],
      ["requestDevice", usbRef.requestDevice],
    ].forEach(async ([methodName, method]) => {
      const isValidExecution = await recordFunctionExecution({
        shouldThrow: true,
        key: `navigator.usb.${methodName}.wrongCall`,
        fn: method,
        params: [],
        targetPath: "usb",
      });

      const fnScoreExecution = isValidExecution ? 0.25 * featureWeight : 0;

      runValidationWithScore({
        key: `${featureName}.${methodName}.execution`,
        condition: !isValidExecution,
        okMsg: `check usb.${methodName} execution (expected)`,
        error: `check usb.${methodName} execution (not expected)`,
        scoreIfOk: fnScoreExecution,
        targetPath: "usb",
      });

      isNative(method, `${featureName}.${methodName}`);
    });

    result.usb = {
      supported: true,
      count: devices.length,
      devices: devices.map((device, index) => ({
        index,
        vendorId: device.vendorId ?? null,
        productId: device.productId ?? null,
        productName: device.productName ?? null,
        manufacturerName: device.manufacturerName ?? null,
        serialNumber: device.serialNumber ?? null,
      })),
    };
  } catch (err) {
    runValidationWithScore({
      key: `${featureName}.error`,
      condition: true,
      error: err,
      targetPath: "usb",
    });
  }
};

const checkBluetoothAvailability = async (chromeVersion) => {
  const featureName = "navigator_bluetooth";
  const { canCheckFeature, featureWeight } = isFeatureValid(
    chromeVersion,
    featureName
  );

  if (!canCheckFeature) {
    return;
  }

  try {
    const bluetooth = navigator.bluetooth;

    result.bluetooth = {
      available: false,
      properties: Object.getOwnPropertyNames(bluetooth),
    };

    // ✅ getAvailability
    if (typeof bluetooth.getAvailability === "function") {
      isNative(bluetooth.getAvailability, `${featureName}.getAvailability`);

      try {
        const available = await bluetooth.getAvailability();
        runValidationWithScore({
          key: `${featureName}.getAvailability.call`,
          condition: false,
          okMsg: `getAvailability() returned ${available}`,
          scoreIfOk: 0.25 * featureWeight,
          targetPath: "bluetooth",
        });
        result.bluetooth.available = available;
      } catch (err) {
        runValidationWithScore({
          key: `${featureName}.getAvailability.error`,
          condition: true,
          error: err,
          targetPath: "bluetooth",
        });
      }
    }

    // ✅ requestDevice
    if (typeof bluetooth.requestDevice === "function") {
      isNative(bluetooth.requestDevice, `${featureName}.requestDevice`);

      await Promise.all(
        [
          undefined,
          true,
          false,
          {},
          { optional: true },
          { optional: false },
          { optional: undefined },
          { optional: null },
          { optional: false, filters: [] },
          { optional: true, filters: [] },
          [],
          null,
          "",
          0,
          1,
          -1,
          NaN,
          Infinity,
          -Infinity,
        ].map((v, i) =>
          recordFunctionExecution({
            shouldThrow: true,
            key: `bluetooth.requestDevice.wrongCallWithParan(${String(v)})`,
            fn: bluetooth.requestDevice,
            params: [v],
            targetPath: "bluetooth",
          })
        )
      );
    }
  } catch (err) {
    runValidationWithScore({
      key: `${featureName}.error`,
      condition: true,
      error: err,
      targetPath: "bluetooth",
    });
  }
};

const checkedMediaCapabilities = async (chromeVersion) => {
  const featureName = "navigator_mediaCapabilities";

  const { canCheckFeature, featureBaseWeight } = isFeatureValid(
    chromeVersion,
    featureName
  );

  if (!canCheckFeature) {
    return;
  }

  const mediaCaps = navigator.mediaCapabilities;

  result.mediaCapabilities = {
    supported: true,
    keys: Object.keys(mediaCaps),
  };

  const checkFunction = async (fnName, validConfig) => {
    const fn = mediaCaps[fnName];

    if (typeof fn !== "function") {
      runValidationWithScore({
        key: `${featureName}.${fnName}.available`,
        condition: true,
        error: `${fnName} is not a function`,
        targetPath: "mediaCapabilities",
      });
      return;
    }

    isNative(fn, `${featureName}.${fnName}`);

    // معاملات خاطئة
    const testParams = [
      undefined,
      0,
      "",
      [],
      {},
      false,
      true,
      Symbol(),
      Symbol.toStringTag,
      { type: "file" },
      { type: "file", video: {} },
    ];

    const testPromises = testParams.flatMap((param) => [
      recordFunctionExecution({
        shouldThrow: true,
        key: `${featureName}.${fnName}.callWith.${String(param)}`,
        fn,
        params: [param],
        targetPath: "mediaCapabilities",
      }),
      recordFunctionExecution({
        shouldThrow: true,
        key: `${featureName}.${fnName}.promiseWith.${String(param)}`,
        fn: () => Promise.resolve(fn(param)),
        params: [],
        targetPath: "mediaCapabilities",
      }),
    ]);

    await Promise.allSettled(testPromises);

    try {
      const info = await fn(validConfig);
      result.mediaCapabilities[fnName] = info;

      runValidationWithScore({
        key: `${featureName}.${fnName}.call`,
        condition: false,
        okMsg: `${fnName}() executed successfully`,
        scoreIfOk: 0.25 * featureBaseWeight,
        targetPath: "mediaCapabilities",
      });
    } catch (err) {
      runValidationWithScore({
        key: `${featureName}.${fnName}.call.error`,
        condition: true,
        error: err,
        scoreIfError: featureBaseWeight,
        targetPath: "mediaCapabilities",
      });
    }
  };

  await checkFunction("decodingInfo", {
    type: "file",
    video: {
      contentType: "video/webm; codecs=vp8",
      width: 640,
      height: 360,
      bitrate: 500_000,
      framerate: 30,
    },
  });

  await checkFunction("encodingInfo", {
    type: "record",
    video: {
      contentType: "video/webm; codecs=vp8",
      width: 640,
      height: 360,
      bitrate: 1_000_000,
      framerate: 30,
    },
  });
};

const checkClipboard = async (chromeVersion) => {
  const featureName = "navigator_clipboard";
  const eventFeature = "navigator_clipboard_event";

  const { canCheckFeature, featureWeight } = isFeatureValid(
    chromeVersion,
    featureName
  );

  if (!canCheckFeature) {
    return;
  }

  result.clipboard = {
    hasReadText: false,
    hasWriteText: false,
  };

  try {
    const clipboard = navigator.clipboard;

    const methodsToCheck = [
      { name: "readText", arg: [] },
      { name: "writeText", arg: ["test"] },
      { name: "read", arg: [] },
      {
        name: "write",
        arg: [
          new ClipboardItem({
            "text/plain": new Blob(["text"], { type: "text/plain" }),
          }),
        ],
      },
    ];

    for (const { name, arg } of methodsToCheck) {
      const fn = clipboard[name];
      const key = `${featureName}.${name}`;

      if (typeof fn === "function") {
        isNative(fn, `${featureName}.${name}`);

        try {
          await recordFunctionExecution({
            shouldThrow: true,
            key: `${key}.wrongCall`,
            fn,
            params: arg,
            targetPath: "clipboard",
          });

          await fn.call(clipboard, ...arg);

          runValidationWithScore({
            key: `${key}.call`,
            condition: false,
            okMsg: `${name}() executed successfully`,
            scoreIfOk: 0.25 * featureWeight,
            targetPath: "clipboard",
          });
          result.clipboard[`${name}Called`] = true;
        } catch (err) {
          runValidationWithScore({
            key: `${key}.error`,
            condition: true,
            error: err,
            scoreIfError: 0.25,
            targetPath: "clipboard",
          });
        }
      } else {
        runValidationWithScore({
          key: `${key}.missing`,
          condition: true,
          error: `${name} should be function but missing`,
          scoreIfError: 0.25 * featureWeight,
          targetPath: "clipboard",
        });
      }
    }
  } catch (err) {
    runValidationWithScore({
      key: `${featureName}.error`,
      condition: true,
      error: err,
      scoreIfError: 0.25,
      targetPath: "clipboard",
    });
  }

  const {
    canCheckFeature: canCheckFeatureForEvent,
    featureWeight: featureWeightForEvent,
  } = isFeatureValid(chromeVersion, eventFeature);

  if (!canCheckFeatureForEvent) {
    return;
  }

  isNative(ClipboardEvent, "window.ClipboardEvent");

  try {
    const hasClipboardEvent = typeof ClipboardEvent === "function";
    result.clipboardEvent = { exists: hasClipboardEvent };

    if (hasClipboardEvent) {
      const clipboardEvent = new ClipboardEvent("copy");
      const hasClipboardData = !!clipboardEvent.clipboardData;

      runValidationWithScore({
        key: `${eventFeature}.clipboardData`,
        condition: !hasClipboardData,
        okMsg: "clipboardData is present",
        error: "clipboardData is missing",
        scoreIfOk: 0.25 * featureWeightForEvent,
        scoreIfError: 0.25 * featureWeightForEvent,
        targetPath: "clipboardEvent",
      });

      result.clipboardEvent.clipboardData = hasClipboardData;
    }
  } catch (err) {
    runValidationWithScore({
      key: `${eventFeature}.error`,
      condition: true,
      error: err,
      scoreIfError: 0.25,
      targetPath: "clipboardEvent",
    });
  }
};

const checkBatteryInfo = async () => {
  const key = "navigator_getBattery";
  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  if (!canCheckFeature) return;

  isNative(navigator.getBattery, "navigator.getBattery");

  try {
    const battery = await navigator.getBattery();

    result.battery = {
      level: battery.level,
      charging: battery.charging,
      chargingTime: battery.chargingTime,
      dischargingTime: battery.dischargingTime,
    };

    const issues = [];

    if (
      typeof battery.level !== "number" ||
      battery.level < 0 ||
      battery.level > 1
    ) {
      issues.push(`Invalid battery.level=${battery.level}`);
    }

    if (typeof battery.charging !== "boolean") {
      issues.push("battery.charging is not boolean");
    }

    if (typeof battery.chargingTime !== "number" || battery.chargingTime < 0) {
      issues.push(`Invalid battery.chargingTime=${battery.chargingTime}`);
    }

    if (
      typeof battery.dischargingTime !== "number" ||
      battery.dischargingTime < 0
    ) {
      issues.push(`Invalid battery.dischargingTime=${battery.dischargingTime}`);
    }

    if (
      battery.charging &&
      battery.dischargingTime !== Infinity &&
      battery.dischargingTime !== 0
    ) {
      issues.push("battery is charging but dischargingTime is not Infinity/0");
    }

    if (
      !battery.charging &&
      battery.chargingTime !== Infinity &&
      battery.chargingTime !== 0
    ) {
      issues.push("battery is not charging but chargingTime is not Infinity/0");
    }

    const isOk = issues.length === 0;

    runValidationWithScore({
      key,
      condition: !isOk,
      okMsg: isOk ? "Battery info looks valid" : undefined,
      error: issues.join(", "),
      scoreIfOk: 1 * featureWeight,
      scoreIfError: 0.5 * featureWeight,
      targetPath: "battery",
    });

    isNative(battery.addEventListener, "battery.addEventListener");
    isNative(battery.removeEventListener, "battery.removeEventListener");
    isNative(battery.dispatchEvent, "battery.dispatchEvent");
  } catch (e) {
    result.battery.error = e.message;
    runValidationWithScore({
      key,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: "battery",
    });
  }
};

const checkWindowChromeFull = async (chromeVersion) => {
  const key = "window_chrome";
  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  if (!canCheckFeature) return;

  try {
    const chromeObj = window.chrome;
    result.chrome.exists = !!chromeObj;

    if (!chromeObj) {
      runValidationWithScore({
        key: `${key}.missing`,
        condition: true,
        error: "window.chrome not available",
        scoreIfOk: 0,
        scoreIfError: featureWeight,
      });
      return;
    }

    // Property listing
    const chromeProps = Object.getOwnPropertyNames(chromeObj || {});
    result.chrome.chromeProps = chromeProps.length > 0 ? chromeProps : "none";

    // Runtime existence
    result.chrome.runtime = {
      exists: !!chromeObj.runtime,
    };

    // --- chrome.app ---
    const app = chromeObj.app;
    result.chrome.app = {
      exists: !!app,
      type: typeof app,
      properties: [],
      descriptor: {},
      functions: [],
      extraProps: {},
    };

    if (app) {
      const props = Object.getOwnPropertyNames(app);
      result.chrome.app.properties = props;

      for (const prop of props) {
        const desc = Object.getOwnPropertyDescriptor(app, prop);
        const score = featureWeight / 2;

        if (desc) {
          result.chrome.app.descriptor[prop] = {
            writable: desc.writable,
            configurable: desc.configurable,
          };

          runValidationWithScore({
            key: `chrome_app_prop_(${prop})_writable`,
            condition: desc.writable,
            okMsg: "not writable (expected)",
            error: "writable (unexpected)",
            scoreIfError: score,
            scoreIfOk: score,
            targetPath: "chrome",
          });

          runValidationWithScore({
            key: `chrome_app_prop_(${prop})_configurable`,
            condition: desc.configurable,
            okMsg: "not configurable (expected)",
            error: "configurable (unexpected)",
            scoreIfError: score,
            scoreIfOk: score,
            targetPath: "chrome",
          });
        } else {
          runValidationWithScore({
            key: `chrome_app_descriptor_(${prop})_error`,
            condition: true,
            error: "descriptor not found",
            scoreIfError: featureWeight,
            scoreIfOk: featureWeight,
            targetPath: "chrome",
          });
        }
      }

      // Manual chrome.app functions
      ["isInstalled", "getDetails", "getIsInstalled"].forEach((fn) => {
        isNative(app[fn], `chrome_app_function_${fn}`);
      });

      // Manual chrome.app properties
      const manualProps = ["runningState", "installState"];
      const validStates = {
        runningState: ["running", "stopped", "suspended"],
        installState: ["installed", "not_installed", "pending"],
      };

      for (const prop of manualProps) {
        if (prop in app) {
          const val = app[prop];
          result.chrome.app.extraProps[prop] = val;
          const score = featureWeight / 2;

          if (typeof val === "string") {
            const valid = validStates[prop];
            runValidationWithScore({
              key: `chrome_app_${prop}_valid`,
              condition: !valid.includes(val),
              okMsg: "valid (expected)",
              error: `unexpected value: ${val}`,
              scoreIfError: score,
              scoreIfOk: score,
              targetPath: "chrome",
            });
          } else {
            runValidationWithScore({
              key: `chrome_app_${prop}_invalid_type`,
              condition: true,
              error: `invalid type: expected string but got ${typeof val}`,
              scoreIfError: score,
              scoreIfOk: score,
              targetPath: "chrome",
            });
          }
        } else {
          runValidationWithScore({
            key: `chrome_app_${prop}_missing`,
            condition: true,
            error: "property missing",
            scoreIfError: featureWeight,
            targetPath: "chrome",
          });
        }
      }
    }

    // chrome.loadTimes and chrome.csi
    const loadItems = chromeObj?.loadTimes;
    const csi = chromeObj?.csi;

    const checkFunctionScore = featureWeight / 4;

    await Promise.all([
      recordFunctionExecution({
        shouldThrow: false,
        key: "window.chrome.loadTimes",
        fn: loadItems,
        params: [],
        targetPath: "chrome",
        scoreIfOk: checkFunctionScore,
        scoreIfError: checkFunctionScore,
      }),
      recordFunctionExecution({
        shouldThrow: false,
        key: "window.chrome.csi",
        fn: csi,
        params: [],
        targetPath: "chrome",
        scoreIfOk: checkFunctionScore,
        scoreIfError: checkFunctionScore,
      }),
      isNative(loadItems, "chrome_loadTimes"),
      isNative(csi, "chrome_csi"),
    ]);

    // chrome.runtime methods
    if (chromeObj.runtime) {
      const { getPlatformInfo, getPackageDirectoryEntry } = chromeObj.runtime;

      result.chrome.runtime.getPlatformInfo_Fn =
        typeof getPlatformInfo === "function";
      result.chrome.runtime.getPackageDirectoryEntry_Fn =
        typeof getPackageDirectoryEntry === "function";

      if (getPlatformInfo) {
        isNative(getPlatformInfo, "chrome_runtime_getPlatformInfo");
      }

      if (getPackageDirectoryEntry) {
        isNative(
          getPackageDirectoryEntry,
          "chrome_runtime_getPackageDirectoryEntry"
        );
      }
    }
  } catch (e) {
    result.chrome.error = e.message;
    runValidationWithScore({
      key: "chrome.error",
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: "chrome",
    });
  }
};

const checkWindowScreenMetrics = (chromeVersion) => {
  const key = "screen_metrics";
  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  try {
    if (!canCheckFeature) return;

    const zoom = +(window.outerWidth / window.innerWidth).toFixed(2);
    const dpr = window.devicePixelRatio;

    const dim = {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      outerWidth: window.outerWidth,
      outerHeight: window.outerHeight,
      screenWidth: screen.width,
      screenHeight: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth ?? 0,
      pixelDepth: screen.pixelDepth ?? 0,
      devicePixelRatio: dpr,
      visualViewport: {
        width: window.visualViewport?.width,
        height: window.visualViewport?.height,
        scale: window.visualViewport?.scale,
      },
      documentElement: {
        clientWidth: document.documentElement.clientWidth ?? 0,
        clientHeight: document.documentElement.clientHeight ?? 0,
        scrollWidth: document.documentElement.scrollWidth ?? 0,
        scrollHeight: document.documentElement.scrollHeight ?? 0,
      },
    };

    const orientation = {
      type: screen.orientation?.type,
      angle: screen.orientation?.angle,
    };

    result.screen_metrics.dimensions = dim;
    result.screen_metrics.zoom = zoom;
    result.screen_metrics.orientation = orientation;

    const issues = [];

    if (!orientation.type) issues.push("orientation.type missing");
    if (dim.innerWidth > dim.outerWidth) issues.push("innerWidth > outerWidth");
    if (dim.innerHeight > dim.outerHeight)
      issues.push("innerHeight > outerHeight");
    if (dim.innerWidth > dim.screenWidth)
      issues.push("innerWidth > screenWidth");
    if (
      dim.visualViewport.width &&
      dim.visualViewport.width > dim.innerWidth + 5
    )
      issues.push("visualViewport.width too large");
    if (dpr < 0.5 || dpr > 10) issues.push("DPR out of range");
    if (dim.screenWidth < 100) issues.push("screenWidth too small");
    if (dim.screenHeight < 100) issues.push("screenHeight too small");
    if (dim.documentElement.clientWidth === 0) issues.push("clientWidth = 0");
    if (dim.documentElement.clientHeight === 0) issues.push("clientHeight = 0");

    result.screen_metrics.issues = issues;

    const issuesScore = (issues.length > 0 ? 0.5 : 1) * featureWeight;

    runValidationWithScore({
      key: "screen-dimensions.tests",
      condition: issues.length > 0,
      error: issues.join(", "),
      scoreIfOk: issuesScore,
      scoreIfError: issuesScore,
      targetPath: key,
    });

    const nativeMethods = [
      "addEventListener",
      "removeEventListener",
      "dispatchEvent",
      "lock",
      "unlock",
    ];
    nativeMethods.forEach((fn) => {
      isNative(screen.orientation?.[fn], `screen.orientation.${fn}`);
    });
  } catch (e) {
    runValidationWithScore({
      key: "window_screen_metrics_error",
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: key,
    });
  }
};

const checkMediaDevices = async (chromeVersion) => {
  const key = "media_devices";

  const featureCheck = isFeatureValid(chromeVersion, key);

  const { canCheckFeature, featureWeight } = featureCheck;
  if (!canCheckFeature) return;

  try {
    const md = navigator.mediaDevices;
    const info = {
      available: !!md,
      enumerateDevicesNative: false,
      getUserMediaNative: false,
      hasGetUserMedia: isNative(md?.getUserMedia, `${key}.getUserMedia`),
      devices: [],
      emptyLabels: 0,
      kindCounts: {
        audioinput: 0,
        audiooutput: 0,
        videoinput: 0,
      },
      getUserMediaTrap: null,
    };

    if (!md || typeof md.enumerateDevices !== "function") {
      result.mediaDevices = {
        available: !!md,
        error: "navigator.mediaDevices.enumerateDevices missing",
      };

      runValidationWithScore({
        key: `${key}.enumerateDevices`,
        condition: true,
        error: "navigator.mediaDevices.enumerateDevices not available",
        scoreIfError: featureWeight,
        targetPath: "mediaDevices",
      });

      return;
    }

    // Native checks
    info.enumerateDevicesNative = isNative(
      md.enumerateDevices,
      `${key}.enumerateDevices`
    );
    info.getUserMediaNative = isNative(md.getUserMedia, `${key}.getUserMedia`);

    // Device list
    const devices = await md.enumerateDevices();

    info.devices = devices.map((d, i) => {
      const label = d.label?.trim() ?? "";
      const kind = d.kind;
      const hasLabel = label.length > 0;

      if (!hasLabel) info.emptyLabels++;
      if (info.kindCounts[kind] !== undefined) {
        info.kindCounts[kind]++;
      }

      return {
        kind,
        label,
        deviceId: d.deviceId,
        groupId: d.groupId,
        hasLabel,
        index: i,
      };
    });

    // getUserMedia trap test (non-intrusive)
    if (info.hasGetUserMedia) {
      try {
        await md.getUserMedia({ audio: false, video: false });
        info.getUserMediaTrap = "resolved";
      } catch (e) {
        info.getUserMediaTrap = e?.name || "rejected";
      }
    }

    // Score calculation
    const uniqueKinds = Object.values(info.kindCounts).filter(
      (n) => n > 0
    ).length;
    const labelScore = info.emptyLabels === 0 ? 0.5 : 0.25;
    const kindScore = uniqueKinds > 1 ? 0.5 : 0.25;
    const trapScore = info.getUserMediaTrap === "resolved" ? 0.25 : 0.1;
    const nativeScore =
      (info.enumerateDevicesNative ? 0.25 : 0.1) +
      (info.getUserMediaNative ? 0.25 : 0.1);

    const totalScore = +(
      labelScore +
      kindScore +
      trapScore +
      nativeScore
    ).toFixed(2);

    result.mediaDevices = info;

    runValidationWithScore({
      key: `${key}.fullCheck`,
      condition: false,
      okMsg: `Found ${devices.length} devices (${uniqueKinds} kinds), ${info.emptyLabels} empty labels, getUserMedia trap: ${info.getUserMediaTrap}`,
      scoreIfOk: totalScore * featureWeight,
      targetPath: "mediaDevices",
    });
  } catch (e) {
    result.mediaDevices.error = e.message;
    runValidationWithScore({
      key: `${key}.error`,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: "mediaDevices",
    });
  }
};

const checkMatchMediaFeature = () => {
  const key = "matchMedia";
  try {
    const { canCheckFeature, featureWeight } = isFeatureValid(
      chromeVersion,
      key
    );
    if (!canCheckFeature) return;

    isNative(window.matchMedia, "window.matchMedia");

    const queries = [
      "(prefers-color-scheme: dark)",
      "(forced-colors: active)",
      "(prefers-reduced-motion: reduce)",
      "(inverted-colors: inverted)",
    ];

    const itemScore = featureWeight / (queries.length + 1);

    for (const query of queries) {
      const matched = window.matchMedia(query).matches;
      result.matchMedia[query] = matched;

      runValidationWithScore({
        key: `matchMedia.${query}`,
        condition: !matched,
        okMsg: `Query matched: ${query}`,
        error: `Query NOT matched: ${query}`,
        scoreIfOk: itemScore,
        scoreIfError: itemScore,
        targetPath: key,
      });
    }
  } catch (e) {
    result.matchMedia.error = e.message;
    runValidationWithScore({
      key: "matchMedia_error",
      condition: true,
      error: e,
      targetPath: key,
      scoreIfError: featureWeight,
    });
  }
};

const checkCSSFeatures = (chromeVersion) => {
  try {
    const { canCheckFeature, featureWeight } = isFeatureValid(
      chromeVersion,
      "CSS_supports"
    );

    if (canCheckFeature) {
      try {
        isNative(CSS.supports, "cssSupports");

        const supportTests = [
          ["display", "grid"],
          ["(--a)", "0"],
          ["backdrop-filter", "blur(2px)"],
        ];

        const itemScore = featureWeight / (supportTests.length + 1);

        for (const [prop, value] of supportTests) {
          const isSupported = CSS.supports(prop, value);
          result.cssSupports[prop] = isSupported;

          runValidationWithScore({
            key: `CSS.supports.${prop}`,
            condition: !isSupported,
            okMsg: `Supported: ${prop}:${value}`,
            error: `Not supported: ${prop}:${value}`,
            scoreIfOk: itemScore,
            scoreIfError: itemScore,
            targetPath: "cssSupports",
          });
        }
      } catch (error) {
        result.cssSupports.error = error.message;
        runValidationWithScore({
          key: `CSS.supports.error`,
          condition: true,
          error: error,
          scoreIfError: featureWeight,
          targetPath: "cssSupports",
        });
      }
    }

    const {
      canCheckFeature: canCheckCSSStyleSheet,
      featureWeight: cssSheetFeatureWeight,
    } = isFeatureValid(chromeVersion, "CSSStyleSheet");

    if (canCheckCSSStyleSheet) {
      try {
        const cssSheet = window.CSSStyleSheet;

        result.css_styleSheet = {
          exists: !!cssSheet,
          type: typeof cssSheet,
        };

        isNative(window.CSSStyleSheet, "css_styleSheet");

        const methods = ["insertRule", "deleteRule"];

        const itemScore = cssSheetFeatureWeight / (methods.length + 1);

        for (const method of methods) {
          const hasMethod = typeof cssSheet?.prototype?.[method] === "function";
          result.css_styleSheet[method] = hasMethod;

          runValidationWithScore({
            key: `CSSStyleSheet.method.${method}`,
            condition: !hasMethod,
            okMsg: `${method} present`,
            error: `${method} missing`,
            scoreIfOk: itemScore,
            scoreIfError: itemScore,
            targetPath: "css_styleSheet",
          });
        }
      } catch (error) {
        result.css_styleSheet.error = error.message;

        runValidationWithScore({
          key: `CSSStyleSheet.error`,
          condition: true,
          error: error,
          scoreIfError: cssSheetFeatureWeight,
          targetPath: "css_styleSheet",
        });
      }
    }

    // --- CSS.paintWorklet ---
    const {
      canCheckFeature: canCheckPaintWorklet,
      featureWeight: paintWorkletFeatureWeight,
    } = isFeatureValid(chromeVersion, "CSS_paintWorklet");

    if (canCheckPaintWorklet) {
      try {
        const hasPaintWorklet = !!CSS.paintWorklet?.addModule;
        result.cssPaintWorklet = {
          hasPaintWorklet,
        };

        if (hasPaintWorklet) {
          isNative(CSS.paintWorklet?.addModule, "CSS.paintWorklet?.addModule");
        }

        runValidationWithScore({
          key: "CSS.paintWorklet.addModule",
          condition: !hasPaintWorklet,
          okMsg: "paintWorklet.addModule exists",
          error: "Missing paintWorklet.addModule",
          scoreIfOk: paintWorkletFeatureWeight,
          scoreIfError: paintWorkletFeatureWeight,
          targetPath: "cssPaintWorklet",
        });
      } catch (error) {
        result.cssPaintWorklet.error = error.message;

        runValidationWithScore({
          key: "CSS.paintWorklet.addModule.error",
          condition: true,
          error: error,
          scoreIfError: paintWorkletFeatureWeight,
          targetPath: "cssPaintWorklet",
        });
      }
    }

    // --- CSS.registerProperty ---
    const {
      canCheckFeature: canCheckRegisterProperty,
      featureWeight: registerPropertyFeatureWeight,
    } = isFeatureValid(chromeVersion, "CSS_registerProperty");
    result.cssRegisterProperty = {
      exists: typeof CSS.registerProperty === "function",
    };

    try {
      if (canCheckRegisterProperty) {
        const hasRegisterProperty = typeof CSS.registerProperty === "function";

        runValidationWithScore({
          key: "CSS.registerProperty",
          condition: !hasRegisterProperty,
          okMsg: "CSS.registerProperty exists",
          error: "Missing registerProperty",
          scoreIfOk: registerPropertyFeatureWeight,
          scoreIfError: registerPropertyFeatureWeight,
          targetPath: "cssRegisterProperty",
        });
      }
    } catch (error) {
      result.cssRegisterProperty.error = error.message;

      runValidationWithScore({
        key: "cssRegisterProperty_error",
        condition: true,
        error: error,
        scoreIfError: registerPropertyFeatureWeight,
        targetPath: "cssRegisterProperty",
      });
    }
  } catch (e) {}
};

const checkIdleCallbackSupport = (chromeVersion) => {
  const key = "requestIdleCallback";

  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  if (!canCheckFeature) return;

  try {
    requestIdleCallback((deadline) => {
      result.requestIdleCallbackData = {
        didTimeout: deadline.didTimeout,
        timeRemaining: deadline.timeRemaining(),
      };

      const time = deadline.timeRemaining();
      const suspicious = time <= 0;

      runValidationWithScore({
        key,
        condition: suspicious,
        okMsg: `Time remaining: ${time.toFixed(2)}ms`,
        error: `Suspicious time remaining: ${time.toFixed(2)}ms`,
        scoreIfOk: 1 * featureWeight,
        scoreIfError: 0.5 * featureWeight,
        targetPath: "requestIdleCallbackData",
      });
    });
  } catch (e) {
    result.requestIdleCallbackData = { error: e.message };

    runValidationWithScore({
      key,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: "requestIdleCallbackData",
    });
  }
};

const getDynamicThresholds = (isMobile) => {
  switch (isMobile) {
    case true:
      return {
        avgFrameDelay: 35,
        loadTime: 15000,
        domReady: 8000,
        memory: {
          totalJSHeapSize: 20 * 1024 * 1024,
          jsHeapSizeLimit: 128 * 1024 * 1024,
        },
      };

    default:
      return {
        avgFrameDelay: 25,
        loadTime: 10000,
        domReady: 5000,
        memory: {
          totalJSHeapSize: 50 * 1024 * 1024,
          jsHeapSizeLimit: 256 * 1024 * 1024,
        },
      };
  }
};

const checkPerformanceAndAnimation = async (chromeVersion, isMobile) => {
  const key = "requestAnimationFrame";
  try {
    const { canCheckFeature, featureWeight } = isFeatureValid(
      chromeVersion,
      key
    );

    if (!canCheckFeature) return;

    const thresholds = getDynamicThresholds(isMobile);

    const timing = performance.timing;
    const navigation = performance.navigation;
    const memory = performance.memory || null;

    result.requestAnimationFrameData = {
      t0: performance.now(),
      timing: { ...timing },
      navigation: { ...navigation },
      memory: memory
        ? {
            jsHeapSizeLimit: memory.jsHeapSizeLimit,
            totalJSHeapSize: memory.totalJSHeapSize,
            usedJSHeapSize: memory.usedJSHeapSize,
          }
        : null,
    };

    // Animation frame delay jitter
    const animDelays = [];
    let last = performance.now();
    for (let i = 0; i < 5; i++) {
      await new Promise((resolve) =>
        requestAnimationFrame((now) => {
          animDelays.push(now - last);
          last = now;
          resolve();
        })
      );
    }

    result.requestAnimationFrameData.animation = animDelays;
    const avgDelay = animDelays.reduce((a, b) => a + b, 0) / animDelays.length;

    runValidationWithScore({
      key,
      condition: avgDelay >= thresholds.avgFrameDelay,
      okMsg: `avg delay ${avgDelay.toFixed(2)}ms`,
      error: `high avg delay: ${avgDelay.toFixed(2)}ms`,
      scoreIfOk: 1 * featureWeight,
      scoreIfError: 0.5 * featureWeight,
      targetPath: "requestAnimationFrameData",
    });

    // Load time
    const loadTime = timing.loadEventEnd - timing.navigationStart;
    runValidationWithScore({
      key: "perf-load-time",
      condition: loadTime > thresholds.loadTime,
      okMsg: `${loadTime}ms`,
      error: `slow load: ${loadTime}ms`,
      scoreIfOk: 1 * featureWeight,
      scoreIfError: 0.5 * featureWeight,
      targetPath: "requestAnimationFrameData",
    });

    // DOM Ready
    const domReadyTime =
      timing.domContentLoadedEventEnd - timing.navigationStart;
    runValidationWithScore({
      key: "perf-dom-ready",
      condition: domReadyTime > thresholds.domReady,
      okMsg: `${domReadyTime}ms`,
      error: `DOM Ready slow: ${domReadyTime}ms`,
      scoreIfOk: 1 * featureWeight,
      scoreIfError: 0.5 * featureWeight,
      targetPath: "requestAnimationFrameData",
    });

    // Navigation
    const isNavOk =
      [0, 1].includes(navigation.type) && navigation.redirectCount < 5;
    runValidationWithScore({
      key: "perf-navigation",
      condition: !isNavOk,
      okMsg: `nav OK`,
      error: `type=${navigation.type}, redirects=${navigation.redirectCount}`,
      scoreIfOk: 1 * featureWeight,
      scoreIfError: 0.5 * featureWeight,
      targetPath: "requestAnimationFrameData",
    });

    // Memory
    if (memory) {
      const { jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize } = memory;
      const memThreshold = thresholds.memory;
      const isMemoryOk =
        jsHeapSizeLimit >= memThreshold.jsHeapSizeLimit &&
        totalJSHeapSize >= memThreshold.totalJSHeapSize &&
        usedJSHeapSize <= jsHeapSizeLimit;

      runValidationWithScore({
        key: "perf-memory",
        condition: !isMemoryOk,
        okMsg: `Memory OK`,
        error: `Memory suspicious: used=${usedJSHeapSize}`,
        scoreIfOk: 1 * featureWeight,
        scoreIfError: 0.5 * featureWeight,
        targetPath: "requestAnimationFrameData",
      });
    } else {
      runValidationWithScore({
        key: "perf-memory",
        condition: true,
        error: "performance.memory unsupported",
        scoreIfError: 0,
        targetPath: "requestAnimationFrameData",
      });
    }
  } catch (e) {
    runValidationWithScore({
      key,
      condition: true,
      error: e,
      targetPath: "requestAnimationFrameData",
    });
  }
};

// done
const checkIntl = (chromeVersion) => {
  const { featureWeight, canCheckFeature } = isFeatureValid(
    chromeVersion,
    "Intl"
  );
  if (!canCheckFeature) return;

  // we test 9 functions
  const methodWeight = featureWeight / 9;

  try {
    const nfOptions = Intl.NumberFormat().resolvedOptions();
    const dtfOptions = Intl.DateTimeFormat().resolvedOptions();
    const locale = dtfOptions.locale;

    const ts = 0;
    const date = new Date(ts);
    const testNumber = 123456.789;

    // DateTimeFormat
    try {
      const dtf = new Intl.DateTimeFormat();
      const resolved = dtf.resolvedOptions();
      result.intl.locale = resolved.locale;
      result.intl.timeZone = resolved.timeZone;
      result.intl.calendar = resolved.calendar;
      result.intl.dtfOptionKeys = Object.keys(resolved).length;

      const formattedDate = dtf.format(date);
      const localeDateFormatted = date.toLocaleString();

      result.intl.dateFormatConsistency = {
        timestamp: ts,
        dtfFormatted: formattedDate,
        localeDateFormatted,
        cleanedLocaleDateFormatted: localeDateFormatted
          .replace(/,.*$/, "")
          .trim(),
        match: formattedDate === localeDateFormatted.replace(/,.*$/, "").trim(),
      };
      runValidationWithScore({
        key: "Intl.DateTimeFormat",
        condition: false,
        error: "OK",
        scoreIfOk: methodWeight,
        targetPath: "intl",
      });
    } catch (e) {
      runValidationWithScore({
        key: "Intl.DateTimeFormat",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    // DurationFormat
    try {
      if (typeof Intl.DurationFormat === "function") {
        const df = new Intl.DurationFormat("en", {
          style: "long",
          years: "numeric",
          months: "numeric",
          days: "numeric",
        });
        const formattedDuration = df.format({ years: 1, months: 2, days: 3 });
        result.intl.durationFormat = formattedDuration;
        runValidationWithScore({
          key: "Intl.DurationFormat",
          condition: false,
          error: "OK",
          scoreIfOk: methodWeight,
          targetPath: "intl",
        });
      }
    } catch (e) {
      runValidationWithScore({
        key: "Intl.DurationFormat",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    // NumberFormat
    try {
      const nf = new Intl.NumberFormat();
      const resolved = nf.resolvedOptions();
      result.intl.numberFormat = resolved;
      result.intl.nfOptionKeys = Object.keys(resolved).length;

      const nfFormatted = nf.format(testNumber);
      const localeFormatted = testNumber.toLocaleString();

      result.intl.formatConsistency = {
        testNumber,
        nfFormatted,
        localeFormatted,
        match: nfFormatted === localeFormatted,
      };
      runValidationWithScore({
        key: "Intl.NumberFormat",
        condition: false,
        error: "OK",
        scoreIfOk: methodWeight,
        targetPath: "intl",
      });
    } catch (e) {
      runValidationWithScore({
        key: "Intl.NumberFormat",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    // RelativeTimeFormat
    try {
      const rtf = new Intl.RelativeTimeFormat();
      result.intl.relativeTime = rtf.format(-1, "day");
      runValidationWithScore({
        key: "Intl.RelativeTimeFormat",
        condition: false,
        error: "OK",
        scoreIfOk: methodWeight,
        targetPath: "intl",
      });
    } catch (e) {
      runValidationWithScore({
        key: "Intl.RelativeTimeFormat",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    // Collator
    try {
      const collator = new Intl.Collator();
      result.intl.collatorCompare = collator.compare("a", "b");
      runValidationWithScore({
        key: "Intl.Collator",
        condition: false,
        error: "OK",
        scoreIfOk: methodWeight,
        targetPath: "intl",
      });
    } catch (e) {
      runValidationWithScore({
        key: "Intl.Collator",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    // PluralRules
    if (typeof Intl.PluralRules === "function") {
      try {
        const pr = new Intl.PluralRules("ar-EG");
        result.intl.pluralRules = {
          locale: pr.resolvedOptions().locale,
          type: pr.resolvedOptions().type,
          categories: pr.resolvedOptions().pluralCategories,
          testValue: 2,
          category: pr.select(2),
        };
        runValidationWithScore({
          key: "Intl.PluralRules",
          condition: false,
          error: "OK",
          scoreIfOk: methodWeight,
          targetPath: "intl",
        });
      } catch (e) {
        runValidationWithScore({
          key: "Intl.PluralRules",
          condition: true,
          error: `Error: ${e.message}`,
          scoreIfError: methodWeight,
          targetPath: "intl",
        });
      }
    }

    // Segmenter
    try {
      const segmenter = new Intl.Segmenter("en", { granularity: "word" });
      const segments = [...segmenter.segment("Hello world!")];
      result.intl.segmenter = segments.map((seg) => seg.segment);
      runValidationWithScore({
        key: "Intl.Segmenter",
        condition: false,
        error: "OK",
        scoreIfOk: methodWeight,
        targetPath: "intl",
      });
    } catch (e) {
      runValidationWithScore({
        key: "Intl.Segmenter",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    // DisplayNames
    try {
      if (typeof Intl.DisplayNames === "function") {
        const dn = new Intl.DisplayNames(["en"], { type: "region" });
        result.intl.displayNames = {
          regionUS: dn.of("US"),
          regionEG: dn.of("EG"),
          supportedLocales: Intl.DisplayNames.supportedLocalesOf([
            "en",
            "ar",
            "ja",
          ]),
        };
      }
      runValidationWithScore({
        key: "Intl.DisplayNames",
        condition: false,
        error: "OK",
        scoreIfOk: methodWeight,
        targetPath: "intl",
      });
    } catch (e) {
      runValidationWithScore({
        key: "Intl.DisplayNames",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    // getCanonicalLocales
    try {
      if (typeof Intl.getCanonicalLocales === "function") {
        const languages = ["en", "ar", "ja"];
        const values = Intl.getCanonicalLocales(languages);

        if (values.toString() === languages.toString()) {
          runValidationWithScore({
            key: "Intl.getCanonicalLocales",
            condition: false,
            error: "OK",
            scoreIfOk: methodWeight,
            targetPath: "intl",
          });
        } else {
          runValidationWithScore({
            key: "Intl.getCanonicalLocales",
            condition: true,
            error: "NOT_OK",
            scoreIfError: methodWeight,
            targetPath: "intl",
          });
        }
      }
    } catch (e) {
      runValidationWithScore({
        key: "Intl.getCanonicalLocales",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: methodWeight,
        targetPath: "intl",
      });
    }

    result.stepsScore += 1;
    const nextTestItemScore = 1 / 4;

    // Format Samples
    try {
      result.intl.formatSamples = [
        {
          locale: "en-US",
          sample: new Intl.DateTimeFormat("en-US").format(date),
        },
        {
          locale: "ar-EG",
          sample: new Intl.DateTimeFormat("ar-EG").format(date),
        },
        {
          locale: "ja-JP",
          sample: new Intl.DateTimeFormat("ja-JP").format(date),
        },
      ];
      runValidationWithScore({
        key: "intl.formatSamples",
        condition: false,
        error: "OK",
        scoreIfOk: nextTestItemScore,
        targetPath: "intl",
      });
    } catch (e) {
      runValidationWithScore({
        key: "intl.formatSamples",
        condition: true,
        error: `Error: ${e.message}`,
        scoreIfError: nextTestItemScore,
        targetPath: "intl",
      });
    }

    const localeDoesntMatchNavigatorLang =
      nfOptions?.locale !== locale ||
      locale?.toLowerCase() !== navigator.language.toLowerCase();

    runValidationWithScore({
      key: "intl.check-navigator-language-with-locale",
      condition: localeDoesntMatchNavigatorLang,
      error: `Error: navigator.language (${navigator.language}) !== Intl resolved locale (${locale}) and nfOptions?.locale (${nfOptions?.locale})`,
      scoreIfError: nextTestItemScore,
      targetPath: "intl",
    });

    const languages = navigator.languages;

    // navigator.languages includes resolved locale
    const navigatorLanguagesIncludeLocale =
      languages &&
      Array.isArray(languages) &&
      !languages.map((l) => l.toLowerCase()).includes(locale?.toLowerCase());

    runValidationWithScore({
      key: "intl-locale-with-navigator-languages",
      condition: navigatorLanguagesIncludeLocale,
      error: `Error: navigator.languages (${languages}) does not include resolved locale (${locale})`,
      scoreIfError: nextTestItemScore,
      targetPath: "intl",
    });

    // اختبار دوال الأصلية
    const testFunctionsList = [
      isNative(Intl.DateTimeFormat, "Intl.DateTimeFormat"),
      isNative(Intl.NumberFormat, "Intl.NumberFormat"),
      isNative(
        Intl.DateTimeFormat().resolvedOptions,
        "Intl.DateTimeFormat().resolvedOptions"
      ),
      isNative(
        Intl.NumberFormat().resolvedOptions,
        "Intl.NumberFormat().resolvedOptions"
      ),
      isNative(Intl.RelativeTimeFormat, "Intl.RelativeTimeFormat"),
      isNative(Intl.Collator, "Intl.Collator"),
      isNative(Intl.Segmenter, "Intl.Segmenter"),
      isNative(Intl.PluralRules, "Intl.PluralRules"),
      isNative(Intl.DisplayNames, "Intl.DisplayNames"),
      isNative(Date.prototype.toLocaleString, "Date.prototype.toLocaleString"),
    ];

    if (typeof Intl.DurationFormat === "function") {
      testFunctionsList.push(
        isNative(Intl.DurationFormat, "Intl.DurationFormat")
      );
    }

    const isEverySuccess = testFunctionsList.every(Boolean);

    runValidationWithScore({
      key: "Intl-with-date-test-functions",
      condition: !isEverySuccess,
      error: isEverySuccess ? "OK" : "NOT_OK",
      scoreIfOk: isEverySuccess ? nextTestItemScore : 0,
      scoreIfError: isEverySuccess ? 0 : nextTestItemScore,
      targetPath: "intl",
    });
  } catch (e) {
    runValidationWithScore({
      key: "Intl-error",
      condition: true,
      error: e,
      targetPath: "intl",
    });
  }
};

// done
const checkNetworkConnection = async (chromeVersion) => {
  const key = "networkConnection";
  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  if (!canCheckFeature) return;

  const conn = navigator.connection || navigator.webkitConnection;

  result.connection = {
    effectiveType: conn.effectiveType,
    rtt: conn.rtt,
    downlink: conn.downlink,
    saveData: conn.saveData,
  };

  // تحقق من صلاحية القيم
  const validations = [
    [
      typeof conn.effectiveType === "string" && conn.effectiveType.length > 0,
      "effectiveType",
    ],
    [typeof conn.rtt === "number" && conn.rtt > 0, "rtt"],
    [typeof conn.downlink === "number" && conn.downlink > 0, "downlink"],
    [typeof conn.saveData === "boolean", "saveData"],
  ];

  validations.forEach(([condition, msg]) => {
    if (!condition) {
      runValidationWithScore({
        key: `${key}.${msg}`,
        condition: true,
        error: `Invalid or missing ${msg}`,
        targetPath: "connection",
      });
    }
  });

  // اختبارات الدوال الأصلية
  const functionTests = [
    isNative(conn.addEventListener, "connection.addEventListener"),
    isNative(conn.removeEventListener, "connection.removeEventListener"),
    recordFunctionExecution({
      shouldThrow: true,
      fn: conn.addEventListener,
      key: `${key}.addEventListener`,
      targetPath: "connection",
    }),
    recordFunctionExecution({
      shouldThrow: true,
      fn: conn.removeEventListener,
      key: `${key}.removeEventListener`,
      targetPath: "connection",
    }),

    recordFunctionExecution({
      shouldThrow: true,
      key: `${key}.addEventListener.change`,
      targetPath: "connection",
      fn: () => conn.addEventListener("change", () => {}),
    }),

    recordFunctionExecution({
      shouldThrow: true,
      key: `${key}.removeEventListener.change`,
      targetPath: "connection",
      fn: () => conn.removeEventListener("change", () => {}),
    }),

    recordFunctionExecution({
      shouldThrow: false,
      key: `${key}.removeEventListener.change`,
      targetPath: "connection",
      fn: () => conn.removeEventListener("change", () => {}),
    }),
  ];

  const functionResults = await Promise.all(functionTests);
  const allTestsDoneSuccessfully = functionResults.every(Boolean);
  result.connection.allTestsDoneSuccessfully = allTestsDoneSuccessfully;

  // حساب الدرجة النهائية
  const validPropsCount = validations.filter(([cond]) => cond).length;
  const propScore = validPropsCount / validations.length;
  const label =
    validPropsCount === validations.length && allTestsDoneSuccessfully
      ? "OK"
      : "Suspicious";
  const score = propScore * (allTestsDoneSuccessfully ? 1 : 0.5);

  runValidationWithScore({
    key,
    condition: label !== "OK",
    error: label,
    scoreIfOk: score * featureWeight,
    targetPath: "connection",
  });
};

const checkStorageCapabilities = async (chromeVersion) => {
  const key = "storage";
  const featuresToCheck = [
    "indexedDB",
    "localStorage",
    "sessionStorage",
    "StorageManager",
    "caches",
  ];

  result.storage = {};
  result.functions = {};

  try {
    for (const featureName of featuresToCheck) {
      const { canCheckFeature, isValid, featureWeight, actuallyExists } =
        isFeatureValid(chromeVersion, featureName);

      if (!canCheckFeature || !actuallyExists || !isValid) continue;

      const featureKey = `storage.${featureName}`;
      const targetPath = "storage";

      switch (featureName) {
        case "indexedDB":
          await recordFunctionExecution({
            key: featureKey,
            fn: () =>
              new Promise((resolve, reject) => {
                const dbName = "__test_idb";
                const req = indexedDB.open(dbName, 1);

                req.onupgradeneeded = () => {
                  const db = req.result;
                  if (!db.objectStoreNames.contains("store")) {
                    db.createObjectStore("store");
                  }
                };

                req.onerror = () => reject("open error");

                req.onsuccess = () => {
                  const db = req.result;
                  const tx = db.transaction("store", "readwrite");
                  const store = tx.objectStore("store");

                  const put = store.put("val", "key");
                  put.onerror = () => reject("put error");

                  put.onsuccess = () => {
                    const get = store.get("key");
                    get.onerror = () => reject("get error");

                    get.onsuccess = () => {
                      if (get.result !== "val") return reject("mismatch");
                      db.close();
                      indexedDB.deleteDatabase(dbName);
                      resolve();
                    };
                  };
                };
              }),
            targetPath,
          });
          break;

        case "localStorage":
          await recordFunctionExecution({
            key: featureKey,
            fn: () => {
              localStorage.setItem("t", "1");
              const v = localStorage.getItem("t");
              if (v !== "1") throw new Error("localStorage mismatch");
              localStorage.removeItem("t");
            },
            targetPath,
          });

          isNative(localStorage.setItem, "localStorage.setItem");
          break;

        case "sessionStorage":
          await recordFunctionExecution({
            key: featureKey,
            fn: () => {
              sessionStorage.setItem("t", "1");
              const v = sessionStorage.getItem("t");
              if (v !== "1") throw new Error("sessionStorage mismatch");
              sessionStorage.removeItem("t");
            },
            targetPath,
          });

          isNative(sessionStorage.setItem, "sessionStorage.setItem");
          break;

        case "StorageManager":
          if (navigator.storage?.estimate) {
            await recordFunctionExecution({
              key: featureKey,
              fn: async () => {
                const { usage, quota } = await navigator.storage.estimate();
                if (!quota || !usage) throw new Error("invalid estimate");
              },
              targetPath,
            });

            result.storage.estimate = await navigator.storage.estimate();
          } else {
            runValidationWithScore({
              key: featureKey,
              condition: true,
              error: "navigator.storage.estimate not available",
              scoreIfError: featureWeight,
              targetPath,
            });
          }

          break;

        case "caches":
          await recordFunctionExecution({
            key: featureKey,
            fn: async () => {
              const cache = await caches.open("__test_cache");
              await cache.put(
                "/test",
                new Response("test-response", {
                  headers: { "Content-Type": "text/plain" },
                })
              );
              const match = await cache.match("/test");
              if (!match) throw new Error("Cache match failed");
              await caches.delete("__test_cache");
            },
            targetPath,
          });
          break;

        default:
          runValidationWithScore({
            key: featureKey,
            condition: true,
            error: `No test defined for ${featureName}`,
            scoreIfError: 0,
            targetPath,
          });
      }
    }

    runValidationWithScore({
      key,
      condition: false,
      okMsg: "Storage features validated",
      scoreIfOk: 1,
    });
  } catch (e) {
    result.storage.error = e.message;
    runValidationWithScore({
      key,
      condition: true,
      error: e,
      targetPath: "storage",
    });
  }
};

const checkPermissionsAPI = async (chromeVersion) => {
  const keyBase = "permissions";
  const keyEdgeCases = `${keyBase}.invalid-calls`;
  const keyKnownChecks = `${keyBase}.known-checks`;
  const keyPrototype = `${keyBase}.prototype`;
  const keyWindowObj = `${keyBase}.window-object`;

  const { canCheckFeature, featureWeight } = isFeatureValid(
    chromeVersion,
    keyBase
  );

  if (!canCheckFeature) return;

  // -----------------------------------------
  // 0. window.PermissionStatus CHECK
  // -----------------------------------------
  const statusObj = window?.PermissionStatus;

  result.permissions.permissionsMeta.windowPermissionStatus = {
    exists: typeof statusObj !== "undefined",
    type: typeof statusObj,
    toString: isNative(statusObj, "window.PermissionStatus"),
    constructorName: statusObj?.constructor?.name ?? null,
  };

  runValidationWithScore({
    key: keyWindowObj,
    condition: typeof statusObj === "undefined",
    okMsg: "window.PermissionStatus exists",
    error: "window.PermissionStatus is missing",
    scoreIfOk: 0.3 * featureWeight,
    scoreIfError: 0.3 * featureWeight,
    targetPath: "permissions",
  });

  // -----------------------------------------
  // 1. INVALID PERMISSION QUERY EDGE CASES
  // -----------------------------------------
  const edgeTests = [
    { name: "noParams", call: () => navigator.permissions.query() },
    { name: "emptyObject", call: () => navigator.permissions.query({}) },
    {
      name: "emptyName",
      call: () => navigator.permissions.query({ name: "" }),
    },
    {
      name: "symbolName",
      call: () => navigator.permissions.query({ name: "⚠️" }),
    },
    {
      name: "invalidName",
      call: () => navigator.permissions.query({ name: "ahmed" }),
    },
  ];

  let passedEdge = 0;
  for (const test of edgeTests) {
    await recordFunctionExecution({
      shouldThrow: true,
      key: `${keyEdgeCases}.${test.name}`,
      fn: test.call,
      targetPath: "permissions",
    }).then((passed) => {
      if (passed) passedEdge++;
    });
  }

  // -----------------------------------------
  // 2. KNOWN PERMISSION QUERIES
  // -----------------------------------------
  const knownPermissions = [
    "camera",
    "microphone",
    "geolocation",
    "notifications",
    "persistent-storage",
    "push",
    "accelerometer",
    "gyroscope",
    "ambient-light-sensor",
    "clipboard-read",
    "clipboard-write",
    "background-sync",
    "midi",
    "magnetometer",
    "accessibility-events",
    "clipboard",
    "payment-handler",
    "periodic-background-sync",
    "window-placement",
    "idle_detection",
    "bluetooth",
    "usb",
  ];

  for (const name of knownPermissions) {
    try {
      const status = await navigator.permissions.query({ name });

      let onchangeFired = false;
      status.onchange = () => {
        onchangeFired = true;
      };

      result.permissions[name] = status.state;
      result.permissions.permissionsMeta[name] = {
        state: status.state,
        onchange: typeof status.onchange === "function",
        hasFiredOnChange: onchangeFired,
        permissionName: status.name ?? name,
        statusToString: Object.prototype.toString.call(status),
      };

      runValidationWithScore({
        key: `${keyKnownChecks}.${name}`,
        condition: !["granted", "denied", "prompt"].includes(status.state),
        okMsg: `Permission '${name}' state is valid (${status.state})`,
        error: `Unexpected permission state '${status.state}'`,
        scoreIfOk: 0.25,
        scoreIfError: 0.1,
        targetPath: "permissions",
      });
    } catch (e) {
      runValidationWithScore({
        key: `${keyKnownChecks}.${name}`,
        condition: true,
        error: e,
        scoreIfError: 0.1,
        targetPath: "permissions",
      });

      result.permissions[name] = "unsupported";
      result.permissions.permissionsMeta[name] = { error: e.message };
    }
  }

  // -----------------------------------------
  // 3. PROTOTYPE INSPECTION
  // -----------------------------------------
  const proto = window?.PermissionStatus?.prototype;

  if (!proto) {
    runValidationWithScore({
      key: keyPrototype,
      condition: true,
      error: "PermissionStatus.prototype is missing",
      scoreIfError: 0.5 * featureWeight,
      targetPath: "permissions",
    });
    return;
  }

  isNative(proto, "window?.PermissionStatus?.prototype");

  ["state", "onchange"].forEach((prop) => {
    const hasProp = prop in proto;

    runValidationWithScore({
      key: `${keyPrototype}.${prop}`,
      condition: !hasProp,
      okMsg: `${prop} exists`,
      error: `${prop} missing`,
      scoreIfOk: 0.1,
      scoreIfError: 0.1,
      targetPath: "permissions",
    });

    result.permissions.permissionsMeta[`proto_${prop}`] = {
      exists: hasProp,
      type: typeof proto[prop],
    };
  });

  // Check native
  isNative(proto.onchange, `${keyPrototype}.onchange`);

  // Mutation test
  try {
    const temp = Object.create(proto);
    temp.state = "granted";
    const wasOverwritten = temp.state === "granted";

    runValidationWithScore({
      key: `${keyPrototype}.state_mutation`,
      condition: wasOverwritten,
      okMsg: "state is read-only",
      error: "state was overwritten",
      scoreIfOk: 0.1,
      scoreIfError: 0.1,
      targetPath: "permissions",
    });

    result.permissions.permissionsMeta.stateMutation = wasOverwritten;
  } catch (e) {
    runValidationWithScore({
      key: `${keyPrototype}.state_mutation`,
      condition: true,
      error: e,
      scoreIfError: 0.1,
      targetPath: "permissions",
    });
  }
};

const checkWebRTCConnectionStates = (chromeVersion) => {
  const key = "webrtc";

  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  if (!canCheckFeature) return;

  try {
    const rtc = new RTCPeerConnection();

    result.webrtc.initialStates = {
      iceConnectionState: rtc.iceConnectionState,
      iceGatheringState: rtc.iceGatheringState,
    };

    rtc.onicegatheringstatechange = () => {
      result.webrtc.webrtcMeta.iceGatheringStateChange = rtc.iceGatheringState;
    };
    rtc.oniceconnectionstatechange = () => {
      result.webrtc.webrtcMeta.iceConnectionStateChange =
        rtc.iceConnectionState;
    };

    // Test addTrack (optional track fallback)
    let addTrackWorked = false;
    try {
      const stream = new MediaStream();
      const dummyTrack = new MediaStreamTrack(); // can throw
      rtc.addTrack(dummyTrack, stream);
      addTrackWorked = true;
    } catch (e) {
      result.webrtc.webrtcMeta.addTrackError = e.message;
    }

    // Test createOffer and setLocalDescription
    rtc.createDataChannel("test");

    rtc
      .createOffer()
      .then((offer) => {
        result.webrtc.offerCreated = true;
        rtc.setLocalDescription(offer);
      })
      .catch((e) => {
        result.webrtc.webrtcMeta.offerError = e.message;
      });

    // Test createAnswer
    rtc
      .createAnswer()
      .then(() => {
        result.webrtc.answerCreated = true;
      })
      .catch((e) => {
        result.webrtc.webrtcMeta.answerError = e.message;
      });

    // onicecandidate + mutation protection check
    rtc.onicecandidate = (event) => {
      if (event.candidate) {
        result.webrtc.candidate = event.candidate.candidate;
        try {
          event.candidate.candidate = "fake";
          result.webrtc.webrtcMeta.mutationAllowed =
            event.candidate.candidate === "fake";
        } catch {
          result.webrtc.webrtcMeta.mutationAllowed = false;
        }
      }
    };

    let dataChannelInfo = {};
    try {
      const dc = rtc.createDataChannel("test_channel");
      dataChannelInfo.label = dc.label;
      dataChannelInfo.ordered = dc.ordered;
      dataChannelInfo.protocol = dc.protocol;
      dataChannelInfo.id = dc.id;
      dataChannelInfo.readyState = dc.readyState;
      dataChannelInfo.reliable = dc.reliable;
      dataChannelInfo.maxPacketLifeTime = dc.maxPacketLifeTime;
      dataChannelInfo.maxRetransmits = dc.maxRetransmits;

      result.webrtc.dataChannel = dataChannelInfo;

      // Prototype & native method checks
      const dcProto = RTCDataChannel?.prototype;
      if (dcProto) {
        result.webrtc.webrtcMeta.RTCDataChannel = {
          toString: Object.prototype.toString.call(dc),
          nativeSend: isNative(dcProto.send),
          nativeClose: isNative(dcProto.close),
          nativeAddEventListener: isNative(dcProto.addEventListener),
        };
      }
    } catch (e) {
      result.webrtc.dataChannelError = e.message;
    }

    // Prototype API validation
    const rtcProto = RTCPeerConnection.prototype;
    for (const method of [
      "createOffer",
      "createAnswer",
      "setLocalDescription",
      "addTrack",
    ]) {
      result.webrtc.webrtcMeta[`proto_${method}`] = {
        type: typeof rtcProto[method],
        native: isNative(rtcProto[method]),
      };
    }

    isNative(rtc, "RTCPeerConnection");

    runValidationWithScore({
      key,
      condition: false,
      okMsg: "WebRTC APIs validated",
      scoreIfOk: featureWeight,
      targetPath: "webrtcMeta",
    });

    setTimeout(() => rtc.close(), 1000);
  } catch (e) {
    result.webrtc.error = e.message;
    runValidationWithScore({
      key: `${key}.error`,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: "webrtc",
    });
  }
};

const digestSHA256FromFloat32 = async (arr) => {
  const buf = new Float32Array(arr.slice(0, 512)).buffer; // hash first 512 samples only
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// done
const checkOfflineAudioFingerprint = async (chromeVersion) => {
  const key = "offlineAudio";

  let localScore = 0;
  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);

  if (!canCheckFeature) {
    return;
  }

  const testKey = `${key}.test`;

  const ctxClass =
    window.OfflineAudioContext || window.webkitOfflineAudioContext;

  try {
    const context = new ctxClass(1, 44100, 44100); // mono, 1s buffer
    const oscillator = context.createOscillator();
    const compressor = context.createDynamicsCompressor();

    oscillator.type = "triangle";
    oscillator.frequency.value = 1000;
    oscillator.connect(compressor);
    compressor.connect(context.destination);

    oscillator.start(0);

    const buffer = await context.startRendering();
    const samples = buffer.getChannelData(0);

    const hash = await digestSHA256FromFloat32(samples);

    const maxSample = Math.max(...samples);
    const minSample = Math.min(...samples);
    const dynamicRange = maxSample - minSample;

    if (dynamicRange > 0.01) localScore += 1;
    if (samples.length >= 44100) localScore += 1;
    if (hash) localScore += 1;
    localScore += 1; // support confirmed

    result.offlineAudio = {
      hash,
      sampleCount: samples.length,
      min: minSample.toFixed(6),
      max: maxSample.toFixed(6),
      dynamicRange: dynamicRange.toFixed(6),
    };

    runValidationWithScore({
      key: testKey,
      condition: false,
      error: "OK",
      scoreIfOk: localScore,
      targetPath: key,
    });
  } catch (err) {
    result.offlineAudio.error = err.message;
    runValidationWithScore({
      key: testKey,
      condition: true,
      error: err,
      scoreIfError: featureWeight,
      targetPath: key,
    });
  }
};

const checkAudioContextSupport = (chromeVersion) => {
  const key = "audioContext";
  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);
  if (!canCheckFeature) return;

  const ctxClass = window.AudioContext || window.webkitAudioContext;

  const testKey = `${key}.test`;

  try {
    if (!ctxClass) {
      runValidationWithScore({
        key: testKey,
        condition: true,
        error: "AudioContext not available",
        scoreIfError: featureWeight,
        targetPath: key,
      });
      return;
    }

    const ctx = new ctxClass();
    result.audioContext = {
      sampleRate: ctx.sampleRate,
      state: ctx.state,
    };

    runValidationWithScore({
      key: testKey,
      condition: false,
      okMsg: "AudioContext supported",
      scoreIfOk: featureWeight,
      targetPath: key,
    });

    ctx.close(); // clean up
  } catch (e) {
    result.audioContext.error = e.message;
    runValidationWithScore({
      key: testKey,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: key,
    });
  }
};

const checkAudioWorkletSupport = (chromeVersion) => {
  const key = "audioWorklet";

  const { canCheckFeature, featureWeight } = isFeatureValid(chromeVersion, key);
  if (!canCheckFeature) return;

  const testKey = `${key}.test`;

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const hasAudioWorklet = !!ctx.audioWorklet;

    result.audioWorklet = {
      supported: hasAudioWorklet,
      workletType: typeof ctx.audioWorklet,
    };

    runValidationWithScore({
      key: testKey,
      condition: !hasAudioWorklet,
      okMsg: "AudioWorklet supported",
      error: "AudioWorklet not available",
      scoreIfOk: featureWeight,
      scoreIfError: featureWeight,
      targetPath: key,
    });

    ctx.close();
  } catch (e) {
    result.audioWorklet.error = e.message;
    runValidationWithScore({
      key: testKey,
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: key,
    });
  }
};

const checkTimerDriftBetweenDateAndPerformance = async () => {
  const key = "performance-drift";
  let passed = 0;

  const deltas = [];
  let suspicious = false;

  try {
    for (let i = 0; i < 10; i++) {
      const d1 = Date.now();
      const p1 = performance.now();
      await new Promise((r) => setTimeout(r, 20));
      const d2 = Date.now();
      const p2 = performance.now();

      const systemElapsed = d2 - d1;
      const highResElapsed = p2 - p1;
      const drift = Math.abs(systemElapsed - highResElapsed);

      deltas.push({
        systemElapsed,
        highResElapsed,
        drift: +drift.toFixed(3),
      });

      if (drift > 10) suspicious = true;
    }

    const avgDrift = deltas.reduce((a, b) => a + b.drift, 0) / deltas.length;

    result.timers.driftCheck = {
      samples: deltas,
      avgDrift: +avgDrift.toFixed(2),
      suspicious,
    };

    if (avgDrift < 7) passed++;
    if (!suspicious) passed++;

    runValidationWithScore({
      key,
      condition: suspicious,
      error: suspicious ? "Mismatch" : "OK",
      scoreIfOk: passed,
      scoreIfError: passed,
      targetPath: "timers",
    });
  } catch (e) {
    result.timers.driftError = e.message;
    runValidationWithScore({
      key: `${key}.error`,
      condition: true,
      error: e,
      scoreIfError: passed,
      targetPath: "timers",
    });
  }
};

const checkPerformanceTimers = async () => {
  try {
    const intervals = [];
    const start = performance.now();

    await new Promise((resolve) => {
      let i = 0;
      const interval = setInterval(() => {
        intervals.push(performance.now() - start);
        if (++i >= 5) {
          clearInterval(interval);
          resolve(null);
        }
      }, 50);
    });

    result.timers = result.timers || {};
    result.timers.intervals = intervals;
  } catch (e) {
    result.timers = result.timers || {};
    result.timers.intervalsError = e.message;
    runValidationWithScore({
      key: "performance-interval",
      condition: true,
      error: e,
      scoreIfError: 0,
      targetPath: "timers",
    });
    return;
  }

  try {
    const deltas = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      await new Promise((r) => setTimeout(r, 10));
      const end = performance.now();
      deltas.push(end - start);
    }

    const jitter = deltas.slice(1).map((v, i) => Math.abs(v - deltas[i]));
    const avgJitter = jitter.reduce((a, b) => a + b, 0) / jitter.length;

    result.timers.jitter = jitter;
    result.timers.avgJitter = avgJitter;
    result.timers.stable = avgJitter < 5;

    runValidationWithScore({
      key: "performance-jitter",
      condition: avgJitter >= 5,
      okMsg: "Stable",
      error: "Unstable",
      scoreIfOk: 2,
      scoreIfError: 0.5,
      targetPath: "timers",
    });
  } catch (e) {
    result.timers.jitterError = e.message;
    runValidationWithScore({
      key: "performance-jitter",
      condition: true,
      error: e,
      targetPath: "timers",
    });
  }
};

const checkRandomPredictability = () => {
  try {
    const randSet = Array.from({ length: 10 }, () => Math.random());
    const uniqueCount = new Set(randSet.map((x) => x.toFixed(10))).size;

    result.randomness = {
      samples: randSet,
      uniqueCount,
      isPredictable: uniqueCount < 7,
    };

    runValidationWithScore({
      key: "randomness-quality",
      condition: uniqueCount < 7,
      okMsg: "OK",
      error: "Predictable",
      scoreIfOk: 2,
      scoreIfError: 0.5,
      targetPath: "randomness",
    });
  } catch (e) {
    result.randomness = { error: e.message };
    runValidationWithScore({
      key: "randomness-quality",
      condition: true,
      error: e,
      targetPath: "randomness",
    });
  }
};

const checkMediaRecorderFeature = (chromeVersion) => {
  try {
    const { canCheckFeature, featureWeight } = isFeatureValid(
      chromeVersion,
      "MediaRecorder"
    );
    if (!canCheckFeature) return;

    const MediaRecorderFn = window.MediaRecorder;
    const exists = typeof MediaRecorderFn === "function";
    result.mediaRecorder = { exists };

    runValidationWithScore({
      key: "MediaRecorder.exists",
      condition: !exists,
      okMsg: "MediaRecorder available",
      error: "MediaRecorder not available",
      scoreIfOk: 0.5,
      scoreIfError: 0.5,
      targetPath: "mediaRecorder",
    });

    const methods = ["start", "stop", "pause", "resume"];

    const itemScore = featureWeight / (methods.length + 1);

    if (exists) {
      const proto = MediaRecorderFn.prototype;
      result.mediaRecorder.methods = {};

      for (const method of methods) {
        const hasMethod = typeof proto?.[method] === "function";
        result.mediaRecorder.methods[method] = hasMethod;

        runValidationWithScore({
          key: `MediaRecorder.method.${method}`,
          condition: !hasMethod,
          okMsg: `${method} exists`,
          error: `${method} missing`,
          scoreIfOk: itemScore,
          scoreIfError: itemScore,
          targetPath: "mediaRecorder",
        });
      }
    }
  } catch (e) {
    result.mediaRecorder.error = e.message;
    runValidationWithScore({
      key: "MediaRecorder_error",
      condition: true,
      error: e,
      scoreIfError: featureWeight,
      targetPath: "mediaRecorder",
    });
  }
};

const checkAtomicsFeature = (chromeVersion) => {
  try {
    const { canCheckFeature, featureWeight } = isFeatureValid(
      chromeVersion,
      "Atomics"
    );
    if (!canCheckFeature) return;

    const AtomicsObj = window.Atomics;
    const exists = typeof AtomicsObj !== "undefined";
    result.atomics = { exists };

    runValidationWithScore({
      key: "Atomics.exists",
      condition: !exists,
      okMsg: "Atomics exists",
      error: "Atomics missing",
      scoreIfOk: 0.5,
      scoreIfError: 0.5,
      targetPath: "atomics",
    });

    const methods = ["wait", "notify", "add", "sub", "store"];

    const itemScore = featureWeight / (methods.length + 1);
    result.atomics.methods = {};

    if (exists) {
      for (const method of methods) {
        const hasMethod = typeof AtomicsObj?.[method] === "function";
        result.atomics.methods[method] = hasMethod;

        runValidationWithScore({
          key: `Atomics.method.${method}`,
          condition: !hasMethod,
          okMsg: `${method} exists`,
          error: `${method} missing`,
          scoreIfOk: itemScore,
          scoreIfError: itemScore,
          targetPath: "atomics",
        });
      }
    }
  } catch (e) {
    result.atomics.error = e.message;

    runValidationWithScore({
      key: "Atomics_error",
      condition: true,
      error: e,
      targetPath: "atomics",
    });
  }
};

const checkObservers = async (chromeVersion) => {
  try {
    result.observers = {
      mutationTriggered: false,
      resizeTriggered: false,
      intersectionTriggered: false,
      performance: false,
      calls: { mutation: 0, resize: 0 },
      active: false,
      meta: {},
      supportedEntryTypes: [],
    };

    const div = document.createElement("div");
    div.style.width = "100px";
    div.style.height = "100px";
    document.body.appendChild(div);

    // --- MutationObserver ---
    try {
      const { canCheckFeature, featureWeight } = isFeatureValid(
        chromeVersion,
        "MutationObserver"
      );
      if (canCheckFeature) {
        const mo = new MutationObserver(() => {
          result.observers.mutationTriggered = true;
          result.observers.calls.mutation += 1;
        });

        mo.observe(document.body, {
          childList: true,
          attributes: true,
          subtree: true,
        });

        result.observers.meta.mutation = Object.getOwnPropertyNames(
          MutationObserver.prototype
        );

        runValidationWithScore({
          key: "MutationObserver",
          condition: false,
          okMsg: "MutationObserver works",
          scoreIfOk: featureWeight,
          targetPath: "observers",
        });
      }
    } catch (error) {
      runValidationWithScore({
        key: "mutationObserver-error",
        condition: true,
        error,
        targetPath: "observers",
      });
    }

    // --- ResizeObserver ---
    try {
      const { canCheckFeature, featureWeight } = isFeatureValid(
        chromeVersion,
        "ResizeObserver"
      );
      if (canCheckFeature) {
        const ro = new ResizeObserver(() => {
          result.observers.resizeTriggered = true;
          result.observers.calls.resize += 1;
        });

        ro.observe(div);
        result.observers.meta.resize = Object.getOwnPropertyNames(
          ResizeObserver.prototype
        );

        runValidationWithScore({
          key: "ResizeObserver",
          condition: false,
          okMsg: "ResizeObserver works",
          scoreIfOk: featureWeight,
          targetPath: "observers",
        });
      }
    } catch (error) {
      runValidationWithScore({
        key: "resizeObserver-error",
        condition: true,
        error,
        targetPath: "observers",
      });
    }

    const span = document.createElement("span");
    document.body.appendChild(span);

    // trigger resize
    setTimeout(() => {
      div.style.width = "120px";
    }, 80);

    await new Promise((r) => setTimeout(r, 200));
    result.observers.active = true;

    // --- IntersectionObserver ---
    try {
      const { canCheckFeature, featureWeight } = isFeatureValid(
        chromeVersion,
        "IntersectionObserver"
      );
      if (canCheckFeature) {
        const ioTarget = document.createElement("div");
        ioTarget.style.width = "100px";
        ioTarget.style.height = "100px";
        ioTarget.style.background = "blue";
        document.body.appendChild(ioTarget);

        const io = new IntersectionObserver((entries) => {
          if (entries[0].isIntersecting) {
            result.observers.intersectionTriggered = true;
          }
        });

        io.observe(ioTarget);

        result.observers.meta.intersection = Object.getOwnPropertyNames(
          IntersectionObserver.prototype
        );

        runValidationWithScore({
          key: "IntersectionObserver",
          condition: false,
          okMsg: "IntersectionObserver works",
          scoreIfOk: featureWeight,
          targetPath: "observers",
        });

        setTimeout(() => {
          ioTarget.style.display = "none";
        }, 110);
      }
    } catch (error) {
      runValidationWithScore({
        key: "intersectionObserver-error",
        condition: true,
        error,
        targetPath: "observers",
      });
    }

    // --- PerformanceObserver ---
    try {
      const { canCheckFeature, featureWeight } = isFeatureValid(
        chromeVersion,
        "PerformanceObserver"
      );
      if (canCheckFeature) {
        const po = new PerformanceObserver((list) => {
          result.observers.performance = list.getEntries().length > 0;
        });

        po.observe({ entryTypes: ["navigation", "resource"] });

        result.observers.meta.performance = Object.getOwnPropertyNames(
          PerformanceObserver.prototype
        );

        if (PerformanceObserver.supportedEntryTypes) {
          result.observers.supportedEntryTypes =
            PerformanceObserver.supportedEntryTypes;
        }

        runValidationWithScore({
          key: "PerformanceObserver",
          condition: false,
          okMsg: "PerformanceObserver works",
          scoreIfOk: featureWeight,
          targetPath: "observers",
        });
      }
    } catch (error) {
      runValidationWithScore({
        key: "performanceObserver-error",
        condition: true,
        error,
        targetPath: "observers",
      });
    }

    setTimeout(() => {
      try {
        document.body.removeChild(div);
        document.body.removeChild(span);
      } catch {}
    }, 500);
  } catch (e) {
    runValidationWithScore({
      key: "observers.error",
      condition: true,
      error: e,
      targetPath: "observers",
    });
  }
};

const suspiciousVendors = [
  "swiftshader",
  "google",
  "llvmpipe",
  "mesa",
  "angle",
];

const digestSHA256FromBase64 = async (dataURL) => {
  const bin = atob(dataURL.split(",")[1]);
  const buffer = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buffer[i] = bin.charCodeAt(i);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(hash)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const checkWebGLFingerprint = () => {
  const glTypes = ["webgl", "experimental-webgl", "webgl2"];

  for (const type of glTypes) {
    const canvas = document.createElement("canvas");

    try {
      const gl = canvas.getContext(type);
      if (!gl) {
        runValidationWithScore({
          key: `webgl-${type}`,
          condition: true,
          error: `Error: Context type=(${type}) not found`,
        });
        continue;
      }

      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      const vendor = ext
        ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)
        : "unknown vendor";
      const renderer = ext
        ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
        : "unknown renderer";

      const info = {
        vendor,
        renderer,
        version: gl.getParameter(gl.VERSION),
        shadingLangVersion: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
        maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
        maxCombinedTextureImageUnits: gl.getParameter(
          gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS
        ),
        supportedExtensions: gl.getSupportedExtensions() || [],
      };

      result.webgl[type] = info;

      const combinedInfo = (vendor + renderer).toLowerCase();
      const isSuspicious = suspiciousVendors.some((v) =>
        combinedInfo.includes(v)
      );

      runValidationWithScore({
        key: `webgl-${type}`,
        condition: isSuspicious,
        error: isSuspicious ? "Suspicious vendor or renderer detected" : null,
        okMsg: "OK",
        scoreIfOk: 2,
        scoreIfError: 0.5,
      });
    } catch (e) {
      runValidationWithScore({
        key: `webgl-${type}-error`,
        condition: true,
        error: e,
      });
    }
  }
};

const testWebGLMethodNatives = () => {
  const gl = document.createElement("canvas").getContext("webgl");
  if (!gl) {
    runValidationWithScore({
      key: "webgl-method-natives",
      condition: true,
      error: "Error: No WebGL context",
    });

    return;
  }

  const methods = [
    "getParameter",
    "getExtension",
    "createBuffer",
    "getSupportedExtensions",
  ];

  const results = methods.map((name) => {
    const fn = gl[name];
    return isNative(fn);
  });

  const allNative = results.every(Boolean);

  runValidationWithScore({
    key: "webgl-method-natives",
    condition: !allNative,
    error: !allNative ? "WebGL methods have been modified" : null,
    okMsg: "OK",
    scoreIfOk: 1,
    scoreIfError: 0.7,
  });
};

const checkWebGL2Support = () => {
  const gl2 = document.createElement("canvas").getContext("webgl2");
  if (!gl2) {
    runValidationWithScore({
      key: "webgl2",
      condition: true,
      error: "Error: WebGL2 not supported",
      scoreIfError: 0.7,
    });
    return;
  }

  const methods = [
    "getBufferSubData",
    "beginQuery",
    "createFramebuffer",
    "createBuffer",
    "getParameter",
    "getSupportedExtensions",
  ];

  const supported = methods.map((m) => typeof gl2[m] === "function");
  const allSupported = supported.every(Boolean);

  runValidationWithScore({
    key: "webgl2",
    condition: !allSupported,
    error: !allSupported ? "Partial WebGL2 support" : null,
    okMsg: "OK",
    scoreIfOk: 1,
    scoreIfError: 0.7,
  });
};

const testShader = (gl, shaderSource, shaderType) => {
  const shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  const start = performance.now();
  gl.compileShader(shader);
  const end = performance.now();

  const compiled = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  const log = gl.getShaderInfoLog(shader);

  gl.deleteShader(shader);

  return {
    compiled,
    log,
    time: end - start,
  };
};

const checkWebGLShaderTest = () => {
  const vertexShaders = [
    "void main() { gl_Position = vec4(0.0); }",
    "precision mediump float; void main() { gl_Position = vec4(1.0); }",
    "void main() { gl_Position = vec4(0.0); error here }",
  ];

  const fragmentShaders = [
    "void main() { gl_FragColor = vec4(1.0); }",
    "precision mediump float; void main() { gl_FragColor = vec4(0.0); }",
    "void main() { gl_FragColor = vec4(0.0); error here }",
  ];

  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl");
  if (!gl) {
    runValidationWithScore({
      key: "webgl-shader",
      condition: true,
      error: "Error: WebGL not supported",
      scoreIfError: 0.7,
    });
    return;
  }

  let vertexPassCount = 0;

  for (let i = 0; i < vertexShaders.length; i++) {
    const res = testShader(gl, vertexShaders[i], gl.VERTEX_SHADER);
    result.webglShaderTest.push({
      type: "vertex",
      index: i,
      ...res,
    });

    if (i < 2 && res.compiled && !res.log) {
      vertexPassCount++;
    }
  }

  let fragmentPassCount = 0;
  for (let i = 0; i < fragmentShaders.length; i++) {
    const res = testShader(gl, fragmentShaders[i], gl.FRAGMENT_SHADER);
    result.webglShaderTest.push({
      type: "fragment",
      index: i,
      ...res,
    });
    if (i < 2 && res.compiled && !res.log) {
      fragmentPassCount++;
    }
  }

  const totalPass = vertexPassCount + fragmentPassCount;
  const totalTests = vertexShaders.length + fragmentShaders.length;

  runValidationWithScore({
    key: "webgl-shader",
    condition: totalPass !== totalTests,
    error:
      totalPass === 0
        ? "Suspicious shader behavior"
        : "Partial match in shader compilation",
    okMsg: "OK",
    scoreIfOk: 1,
    scoreIfError: totalPass / totalTests,
  });
};

const createWebGLCanvasHash = async () => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const gl = canvas.getContext("webgl");

  if (!gl) {
    return null;
  }
  gl.clearColor(0.2, 0.3, 0.4, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const dataURL = canvas.toDataURL();
  const hash = await digestSHA256FromBase64(dataURL);

  return {
    canvas,
    gl,
    hash,
  };
};

const testWebGLCanvasHash = async () => {
  const values = await createWebGLCanvasHash();

  if (!values) {
    runValidationWithScore({
      key: "webgl-canvas-hash",
      condition: true,
      error: "WebGL not supported",
      scoreIfError: 0.7,
    });
    return;
  }

  result.webgl.canvasHash = values.hash;

  const knownBadFingerprints = [
    "3c8f84d1e0c57c8c7e0ec3502138e993a69d0a51a55b32a3a7c38d795f63212e", // Puppeteer - SwiftShader
    "5b7351b82c5ae403e8fa446417064aef75b64f3f5f2d3f18c4288dfe5c7689a5", // Headless Chrome - ANGLE
    "2f6f2e317a78974f7c6e370726df0ad658f5dc4a515391accb3c2634a8d7a99c", // Linux Mesa
    "de3b003219589535e3ad4b0ae490671d9db357b83e7fcbe6e465548f73d5b419", // VMware guest renderer
    "a1836bfa67e2635cfd1f04d89d7ed1df1c27e92c2a4438d2cf1cb4fc12abf087", // Google Cloud virtual GPU
  ];

  const isSuspicious = knownBadFingerprints.includes(values.hash);

  runValidationWithScore({
    key: "webgl-canvas-hash",
    condition: isSuspicious,
    error: isSuspicious ? "Known suspicious canvas fingerprint" : null,
    okMsg: "OK",
    scoreIfOk: 2,
    scoreIfError: 0.7,
  });
};

// done
const checkCanvasConsistency = async () => {
  const width = 300;
  const height = 100;
  const canvas1 = document.createElement("canvas");
  const canvas2 = document.createElement("canvas");
  canvas1.width = canvas2.width = width;
  canvas1.height = canvas2.height = height;
  const ctx1 = canvas1.getContext("2d");
  const ctx2 = canvas2.getContext("2d");

  const drawVariations = (ctx) => {
    ctx.clearRect(0, 0, width, height);
    ctx.textBaseline = "top";

    ctx.font = "20px Arial";
    ctx.fillStyle = "#000";
    ctx.fillText("Same input!", 10, 10);

    ctx.font = "20px 'Segoe UI Emoji', 'Apple Color Emoji'";
    ctx.fillText("🎯🔥💯", 10, 30);

    ctx.font = "20px Tahoma";
    ctx.direction = "rtl";
    ctx.fillText("مرحبا", 290, 50);

    ctx.font = "20px Georgia";
    ctx.shadowColor = "rgba(0,0,0,0.3)";
    ctx.shadowBlur = 2;
    ctx.strokeText("Stroke+Shadow", 10, 70);
  };

  const pixelDiff = (imgData1, imgData2) => {
    let diffCount = 0;
    for (let i = 0; i < imgData1.data.length; i += 4) {
      const r1 = imgData1.data[i];
      const g1 = imgData1.data[i + 1];
      const b1 = imgData1.data[i + 2];
      const a1 = imgData1.data[i + 3];

      const r2 = imgData2.data[i];
      const g2 = imgData2.data[i + 1];
      const b2 = imgData2.data[i + 2];
      const a2 = imgData2.data[i + 3];

      const dist =
        Math.abs(r1 - r2) +
        Math.abs(g1 - g2) +
        Math.abs(b1 - b2) +
        Math.abs(a1 - a2);

      if (dist > 10) diffCount++;
    }
    return diffCount;
  };

  try {
    drawVariations(ctx1);
    drawVariations(ctx2);

    const d1 = canvas1.toDataURL("image/png");
    const d2 = canvas2.toDataURL("image/png");
    const hash1 = await digestSHA256FromBase64(d1);
    const hash2 = await digestSHA256FromBase64(d2);

    const imgData1 = ctx1.getImageData(0, 0, width, height);
    const imgData2 = ctx2.getImageData(0, 0, width, height);
    const diff = pixelDiff(imgData1, imgData2);
    const totalPixels = width * height;
    const diffPercent = (diff / totalPixels) * 100;

    const pass = hash1 === hash2 && diffPercent < 0.5;

    result.canvasConsistency = {
      hash1,
      hash2,
      pixelDiffCount: diff,
      pixelDiffPercent: diffPercent.toFixed(2),
      match: pass,
    };

    runValidationWithScore({
      key: "canvas-advanced",
      condition: !pass,
      error: !pass ? "Pixel or renderer mismatch" : null,
      okMsg: "Match",
      scoreIfOk: 2,
      scoreIfError: 0.5,
    });
  } catch (e) {
    result.canvasConsistency = { error: e.message };
    runValidationWithScore({
      key: "canvas-advanced",
      condition: true,
      error: e,
      scoreIfError: 0.5,
    });
  }
};

// done
const checkOffscreenCanvasStability = async (chromeVersion) => {
  const offscreenCanvasFeature = isFeatureValid(
    chromeVersion,
    "OffscreenCanvas"
  );
  const offscreenCtxFeature = isFeatureValid(
    chromeVersion,
    "OffscreenCanvasRenderingContext2D"
  );
  const imageBitmapFeature = isFeatureValid(chromeVersion, "createImageBitmap");

  if (
    !offscreenCanvasFeature.canCheckFeature &&
    !offscreenCtxFeature.canCheckFeature &&
    !imageBitmapFeature.canCheckFeature
  ) {
    return;
  }

  const key = "offscreen-vs-onscreen";
  const fonts = ["Arial", "Courier New", "Times New Roman"];
  const languages = ["ar", "en", "ja"];
  const texts = ["مرحبا", "Hello", "こんにちは"];
  const width = 300;
  const height = 80;

  const totalWeightScore =
    (offscreenCanvasFeature.featureWeight ?? 0) +
    (offscreenCtxFeature.featureWeight ?? 0) +
    (imageBitmapFeature.featureWeight ?? 0);

  let matchCount = 0;
  let errorCount = 0;

  result.offscreenCanvas ||= { comparisons: [] };

  for (let i = 0; i < fonts.length; i++) {
    const font = `20px ${fonts[i]}`;
    const text = texts[i];
    const lang = languages[i];

    try {
      // 2d OffscreenCanvas vs OnscreenCanvas
      const offscreen = new OffscreenCanvas(width, height);
      const octx = offscreen.getContext("2d");
      octx.textBaseline = "top";
      octx.font = font;
      octx.fillStyle = "black";
      octx.fillText(text, 10, 10);

      const blob = await offscreen.convertToBlob();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        await blob.arrayBuffer()
      );
      const offscreenHash = [...new Uint8Array(hashBuffer)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = font;
      ctx.fillStyle = "black";
      ctx.fillText(text, 10, 10);
      const onscreenHash = await digestSHA256FromBase64(canvas.toDataURL());

      const match = offscreenHash === onscreenHash;
      if (match) matchCount++;

      result.offscreenCanvas.comparisons.push({
        type: "2d vs 2d",
        font,
        lang,
        text,
        match,
        offscreenHash,
        onscreenHash,
      });
    } catch (e) {
      errorCount++;
      result.offscreenCanvas.comparisons.push({
        type: "2d vs 2d",
        font,
        lang,
        text,
        error: e.message,
      });
    }

    try {
      // 2d OffscreenCanvas vs bitmaprenderer
      const offscreen = new OffscreenCanvas(width, height);
      const octx = offscreen.getContext("2d");
      octx.textBaseline = "top";
      octx.font = font;
      octx.fillStyle = "black";
      octx.fillText(text, 10, 10);

      const imageBitmap = await createImageBitmap(offscreen);
      const onscreen = document.createElement("canvas");
      onscreen.width = width;
      onscreen.height = height;
      const bctx = onscreen.getContext("bitmaprenderer");
      bctx.transferFromImageBitmap(imageBitmap);

      const hash = await digestSHA256FromBase64(onscreen.toDataURL());

      const blob = await offscreen.convertToBlob();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        await blob.arrayBuffer()
      );
      const offscreenHash = [...new Uint8Array(hashBuffer)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const match = hash === offscreenHash;
      if (match) matchCount++;

      result.offscreenCanvas.comparisons.push({
        type: "2d vs bitmaprenderer",
        font,
        lang,
        text,
        match,
        offscreenHash,
        onscreenHash: hash,
      });
    } catch (e) {
      errorCount++;
      result.offscreenCanvas.comparisons.push({
        type: "2d vs bitmaprenderer",
        font,
        lang,
        text,
        error: e.message,
      });
    }
  }

  const totalComparisons = result.offscreenCanvas.comparisons.length;
  const matchRatio = totalComparisons > 0 ? matchCount / totalComparisons : 0;
  const finalScore = Math.max(matchRatio * totalWeightScore - errorCount, 0);

  runValidationWithScore({
    key,
    condition: matchCount !== totalComparisons,
    error:
      matchCount === 0
        ? "Mismatch in OffscreenCanvas vs OnscreenCanvas comparisons"
        : "Partial match in OffscreenCanvas comparisons",
    okMsg: "OK",
    scoreIfOk: totalWeightScore,
    scoreIfError: finalScore,
  });
};

const checkImageBitmapRenderingContextStability = async () => {
  const HTMLCanvasElementFeature = isFeatureValid(
    chromeVersion,
    "HTMLCanvasElement"
  );
  const createImageBitmapFeature = isFeatureValid(
    chromeVersion,
    "createImageBitmap"
  );

  if (
    !HTMLCanvasElementFeature.canCheckFeature &&
    !createImageBitmapFeature.canCheckFeature
  ) {
    return;
  }

  const key = "canvas-vs-bitmaprenderer";
  const fonts = ["Arial", "Courier New", "Times New Roman"];
  const languages = ["ar", "en", "ja"];
  const texts = ["مرحبا", "Hello", "こんにちは"];
  const width = 300;
  const height = 80;

  result.stepsScore += fonts.length;

  const totalWeightedScore =
    (HTMLCanvasElementFeature.weightedScore || 0) +
    (createImageBitmapFeature.weightedScore || 0);

  let errorCount = 0;
  let matchCount = 0;

  result.bitmapRendererStability = { comparisons: [] };

  for (let i = 0; i < fonts.length; i++) {
    const font = `20px ${fonts[i]}`;
    const text = texts[i];
    const lang = languages[i];

    try {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.textBaseline = "top";
      ctx.font = font;
      ctx.fillStyle = "black";
      ctx.fillText(text, 10, 10);

      const originalHash = await digestSHA256FromBase64(canvas.toDataURL());

      const imageBitmap = await createImageBitmap(canvas);

      const target = document.createElement("canvas");
      target.width = width;
      target.height = height;

      const brender = target.getContext("bitmaprenderer");
      if (!brender) {
        runValidationWithScore({
          key,
          condition: true,
          error: "Error: bitmaprenderer context not supported",
        });
        return;
      }

      brender.transferFromImageBitmap(imageBitmap);

      const finalHash = await digestSHA256FromBase64(target.toDataURL());

      const match = finalHash === originalHash;
      if (match) matchCount++;

      result.bitmapRendererStability.comparisons.push({
        font,
        lang,
        text,
        type: "canvas vs bitmaprenderer",
        match,
        originalHash,
        finalHash,
      });
    } catch (e) {
      errorCount++;
      result.bitmapRendererStability.comparisons.push({
        font,
        lang,
        text,
        type: "canvas vs bitmaprenderer",
        error: e.message,
      });
    }
  }

  const totalComparisons = result.bitmapRendererStability.comparisons.length;
  const matchRatio = totalComparisons > 0 ? matchCount / totalComparisons : 0;
  const finalScore = Math.max(matchRatio * totalWeightedScore - errorCount, 0);

  runValidationWithScore({
    key,
    condition: matchCount !== totalComparisons,
    error:
      matchCount === 0
        ? "Mismatch in canvas vs bitmaprenderer comparisons"
        : "Partial match in canvas vs bitmaprenderer",
    okMsg: "OK",
    scoreIfOk: totalWeightedScore,
    scoreIfError: finalScore,
  });
};
