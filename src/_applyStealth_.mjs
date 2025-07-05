import spoofStorage from "./spoofing/spoofStorage.mjs";
import spoofUSB from "./spoofing/spoofUSB.mjs";
import spoofGamepads from "./spoofing/spoofGamepads.mjs";
import spoofBattery from "./spoofing/spoofBattery.mjs";
import spoofCanvas from "./spoofing/spoofCanvas.mjs";
import spoofVideoAndAudio from "./spoofing/spoofVideoAndAudio.mjs";
import spoofPlugins from "./spoofing/spoofPlugins.mjs";
import spoofoOrientation from "./spoofing/spoofoOrientation.mjs";

(() => {
  const fp = JSON.parse(`__FINGERPRINT_JSON__`);

  const {
    baseNavigatorOptions = {},
    userActivation,
    dimensionsData = {},
    documentVisiblity = {},
    performanceMemory = {},
    webrtcCandidates,
    numberFormatOptions,
    dateTimeOptions,
    touchSupport,
    windowName,
    windowChrome,
    chromeFunctionsValues,
    plugins,
    permissions,
    mediaQueries,
    cssSupports,
    orientationInfo,
    gamepads,
    storage,
    mediaCapabilities,
    webglFP,
    videoFP,
    canvasFP,
    audioFP,
    fontsData,
    usbDevices,
  } = fp;

  function define(obj, key, value, enumerable = true) {
    Object.defineProperty(obj, key, {
      value,
      configurable: true,
      enumerable,
    });
  }

  // Helper to mimic native function string
  const spoofNative = (fn, name) => {
    const nativeStr = `function ${name}() { [native code] }`;
    const fakeToString = () => nativeStr;

    Object.defineProperty(fn, "name", {
      value: name,
      writable: false,
      enumerable: false,
      configurable: true, // configurable lets you patch it again if needed
    });

    Object.defineProperty(fn, "toString", {
      value: fakeToString,
      writable: false,
      configurable: true,
      enumerable: false,
    });

    return fn;
  };

  // --- Timing & Entropy Fingerprint Spoofing ---
  const jitter = () => Math.floor(Math.random() * 5 - 2); // -2 to +2 ms

  // Slight noise to Math.random to break statistical fingerprinting
  const origRand = Math.random;
  Math.random = function () {
    const noise = (origRand() - 0.5) * 0.0001;
    return origRand() + noise;
  };

  const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);

  // Patch performance.now()
  const originalNow = performance.now.bind(performance);
  performance.now = new Proxy(originalNow, {
    apply: (target, thisArg, args) =>
      Reflect.apply(target, thisArg, args) + jitter(),
  });

  // Patch Date.now()
  Date.now = new Proxy(Date.now, {
    apply: (target, thisArg, args) =>
      Reflect.apply(target, thisArg, args) + jitter(),
  });

  // Patch +new Date / new Date().getTime() via Date.prototype.valueOf
  const originalValueOf = Date.prototype.valueOf;
  Date.prototype.valueOf = new Proxy(originalValueOf, {
    apply: (target, thisArg, args) =>
      Reflect.apply(target, thisArg, args) + jitter(),
  });

  // Optional: Patch Date.prototype.getTime() (used explicitly by some bots)
  const originalGetTime = Date.prototype.getTime;
  Date.prototype.getTime = new Proxy(originalGetTime, {
    apply: (target, thisArg, args) =>
      Reflect.apply(target, thisArg, args) + jitter(),
  });

  // Patch Date.parse (optional)
  const originalParse = Date.parse;
  Date.parse = new Proxy(originalParse, {
    apply: (target, thisArg, args) =>
      Reflect.apply(target, thisArg, args) + jitter(),
  });

  // Patch Date.UTC (optional)
  const originalUTC = Date.UTC;
  Date.UTC = new Proxy(originalUTC, {
    apply: (target, thisArg, args) =>
      Reflect.apply(target, thisArg, args) + jitter(),
  });

  // Patch toISOString (optional)
  const originalToISOString = Date.prototype.toISOString;
  Date.prototype.toISOString = new Proxy(originalToISOString, {
    apply: (target, thisArg, args) => {
      const real = Reflect.apply(target, thisArg, args);
      const date = new Date(real);
      date.setMilliseconds(date.getMilliseconds() + jitter());
      return date.toISOString();
    },
  });

  if ("memory" in performance && typeof performance.memory === "object") {
    const { jsHeapSizeLimit, totalJSHeapSize, usedJSHeapSize } =
      performanceMemory;

    Object.defineProperty(performance, "memory", {
      value: {
        get jsHeapSizeLimit() {
          return jsHeapSizeLimit;
        },
        get totalJSHeapSize() {
          return totalJSHeapSize;
        },
        get usedJSHeapSize() {
          return usedJSHeapSize;
        },
        [Symbol.toStringTag]: "MemoryInfo",
      },
      configurable: true,
    });
  }

  // Apply to all patched functions
  spoofNative(Math.random, "random");
  spoofNative(performance.now, "now");
  spoofNative(Date.now, "now");
  spoofNative(Date.prototype.valueOf, "valueOf");
  spoofNative(Date.prototype.getTime, "getTime");
  spoofNative(Date.parse, "parse");
  spoofNative(Date.UTC, "UTC");
  spoofNative(Date.prototype.toISOString, "toISOString");

  // --------------- start spoofing Date and Intl --------------- //
  const originalDateTime = Intl.DateTimeFormat.prototype.resolvedOptions;
  Intl.DateTimeFormat.prototype.resolvedOptions = function () {
    return {
      ...originalDateTime.call(this),
      ...dateTimeOptions,
    };
  };

  const originalNumberFormat = Intl.NumberFormat.prototype.resolvedOptions;
  Intl.NumberFormat.prototype.resolvedOptions = function () {
    return {
      ...originalNumberFormat.call(this),
      ...numberFormatOptions,
    };
  };

  const windowPrototype = Object.getPrototypeOf(window);
  const screenPrototype = Object.getPrototypeOf(screen);
  const visualViewportPrototype = Object.getPrototypeOf(
    window.visualViewport || {}
  );

  // ----------------- start of navigator properties spoofing ----------------- //
  const { languages, ...othernavigatorData } = baseNavigatorOptions;
  const navigatorPrototype = Object.getPrototypeOf(navigator);

  Object.entries(othernavigatorData).forEach(([k, v]) =>
    define(navigatorPrototype, k, v)
  );

  // don't use navigatorPrototype directly, as it may not be the same as navigator.__proto__
  const freezedUserActivateion = Object.freeze(userActivation);
  Object.defineProperty(navigator, "userActivation", {
    get: () => freezedUserActivateion,
    configurable: true,
    enumerable: true,
  });

  const spoofLanguages = [...(languages || [])];

  if (languages) {
    Object.defineProperty(spoofLanguages, "toString", {
      value: () => spoofLanguages.join(","),
      configurable: true,
      writable: false,
    });

    Object.defineProperty(spoofLanguages, "length", {
      value: spoofLanguages.length,
      configurable: true,
      writable: false,
    });

    define(navigatorPrototype, "languages", Object.freeze(spoofLanguages));

    Object.defineProperty(navigatorPrototype, "hasOwnProperty", {
      value: function (key) {
        if (key === "languages") return true;
        return Object.prototype.hasOwnProperty.call(this, key);
      },
      configurable: true,
    });
  }

  // ----------------- start of dimensions spoofing ----------------- //

  Object.entries(dimensionsData).forEach(([section, props]) => {
    Object.entries(props).forEach(([k, v]) => {
      define(
        section === "documentElement"
          ? document.documentElement
          : section === "visualViewport"
          ? visualViewportPrototype
          : section === "screen"
          ? screenPrototype
          : windowPrototype,
        k,
        v
      );

      if (section === "window") {
        Object.defineProperty(window, k, { value: v, configurable: true });
      }
    });
  });

  // ----------------- start of visibility spoofing ----------------- //
  define(document, "visibilityState", documentVisiblity.visibilityState);
  define(document, "hidden", documentVisiblity.hidden);

  // ----------------- start of window properties spoofing ----------------- //
  const windowEventsDataMap = [
    {
      events: [
        "onpointerup",
        "onpointerdown",
        "onpointermove",
        "onpointerout",
        "onpointerover",
        "onpointerenter",
        "onpointerleave",
        "onpointercancel",
        "onpointerlockchange",
      ],
      found: touchSupport.pointerEventInWindow,
      mainEvent: PointerEvent,
      name: "PointerEvent",
    },
    {
      events: ["ontouchstart", "ontouchend", "ontouchmove", "ontouchcancel"],
      found: touchSupport.touchEventInWindow,
      mainEvent: TouchEvent,
      name: "TouchEvent",
    },
    {
      events: ["ondevicemotion", "ondeviceorientation", "ondevicelight"],
      found: touchSupport.deviceMotionEventInWindow,
      mainEvent: DeviceMotionEvent,
      name: "DeviceMotionEvent",
    },
  ];

  windowEventsDataMap.forEach(({ events, found, mainEvent, name }) => {
    events.forEach((event) => {
      const options = {
        value: found ? () => {} : undefined,
        writable: false,
        configurable: true,
        enumerable: true,
      };

      Object.defineProperty(windowPrototype, event, options);
      Object.defineProperty(window, event, options);
    });

    if (mainEvent && found && typeof mainEvent === "function") {
      const options = {
        value: mainEvent,
        writable: false,
        configurable: false,
        enumerable: false,
      };
      Object.defineProperty(windowPrototype, name, options);
      Object.defineProperty(window, name, options);
    }
  });

  Object.defineProperty(windowPrototype, "name", {
    get: () => windowName || "",
    set: () => {},
    configurable: true,
  });

  Object.defineProperty(window, "name", {
    get: () => windowName || "",
    set: () => {},
    configurable: true,
  });

  window.chrome = {
    ...(windowChrome || {}),
    runtime: {
      ...window.chrome?.runtime,
      getPlatformInfo: () =>
        new Promise((resolve) => {
          resolve(chromeFunctionsValues?.platformInfo || {});
        }),
      getPackageDirectoryEntry: () => {
        return new Promise((resolve) => {
          resolve(chromeFunctionsValues?.packageDirectoryEntry || {});
        });
      },
    },
    loadTimes: function () {
      const baseTime = performance.timeOrigin / 1000; // convert ms to s
      const loadOffset = 0.2; // Simulate 200ms load

      return {
        requestTime: baseTime,
        startLoadTime: baseTime,
        commitLoadTime: baseTime + 0.003,
        finishDocumentLoadTime: baseTime + loadOffset * 0.9,
        finishLoadTime: baseTime + loadOffset,
        firstPaintTime: baseTime + 0.05,
        firstPaintAfterLoadTime: 0,
        navigationType: "Other", // could be 'Reload' or 'Other'
        wasFetchedViaSpdy: true,
        wasNpnNegotiated: true,
        npnNegotiatedProtocol: "h2", // or "quic", "http/2"
        wasAlternateProtocolAvailable: false,
        connectionInfo: "h2", // realistic value: "h2", "http/2", "quic", "http/1.1"
      };
    },
    csi: function () {
      const baseTime = performance.timing.navigationStart;
      const now = Date.now();
      const pageTime = now - baseTime;

      return {
        onloadT: now,
        startE: baseTime,
        pageT: pageTime,
        tran: 15, // constant across Chrome versions
      };
    },
  };

  Object.defineProperty(window, "chrome", {
    value: window.chrome,
    configurable: false,
    enumerable: true,
    writable: false,
  });

  // ----------------- Plugin & MimeType Spoofing ----------------- //
  spoofPlugins(plugins);

  // ----------------- start of getGamepads spoofing ----------------- //
  spoofGamepads(gamepads);

  // ----------------- start of permissions spoofing ----------------- //
  function PermissionStatus() {
    this._listeners = new Set();
  }

  PermissionStatus.prototype = {
    constructor: PermissionStatus,

    addEventListener(type, listener) {
      if (type === "change") this._listeners.add(listener);
    },

    removeEventListener(type, listener) {
      if (type === "change") this._listeners.delete(listener);
    },

    dispatchEvent(event) {
      if (event?.type === "change") {
        this._listeners.forEach((fn) => fn.call(this, event));
        if (typeof this.onchange === "function") {
          this.onchange.call(this, event);
        }
      }
    },

    then(onFulfilled, onRejected) {
      return Promise.resolve(this).then(onFulfilled, onRejected);
    },

    catch(onRejected) {
      return Promise.resolve(this).catch(onRejected);
    },

    finally(onFinally) {
      return Promise.resolve(this).finally(onFinally);
    },
  };

  PermissionStatus.prototype.onchange = null;
  PermissionStatus.prototype.__proto__ = EventTarget.prototype;

  PermissionStatus.prototype.toJSON = function () {
    return {
      state: this.state,
      name: this.name,
    };
  };

  Object.defineProperty(PermissionStatus.prototype, Symbol.toStringTag, {
    value: "PermissionStatus",
    writable: false,
    enumerable: false,
    configurable: true,
  });

  [
    "addEventListener",
    "removeEventListener",
    "dispatchEvent",
    "toJSON",
  ].forEach((fn) => {
    spoofNative(PermissionStatus.prototype[fn], fn);
  });

  spoofNative(PermissionStatus, "PermissionStatus");

  const __permissionsSessionState = {};

  const getSessionPermissionState = (name) => {
    if (!(name in __permissionsSessionState)) {
      try {
        const saved = sessionStorage.getItem("__perm_" + name);
        if (saved === "granted" || saved === "denied") {
          __permissionsSessionState[name] = saved;
        } else {
          let randomState =
            name === "notifications"
              ? Math.random() < 0.2
                ? "granted"
                : "denied"
              : Math.random() < 0.6
              ? "granted"
              : "denied";
          __permissionsSessionState[name] = randomState;
          sessionStorage.setItem("__perm_" + name, randomState);
        }
      } catch {
        __permissionsSessionState[name] =
          Math.random() < 0.6 ? "granted" : "denied";
      }
    }
    return __permissionsSessionState[name];
  };

  const customQuery = (descriptor) => {
    if (!descriptor || typeof descriptor !== "object") {
      return Promise.reject(
        new TypeError(
          "Failed to execute 'query' on 'Permissions': 1 argument required, but only 0 present."
        )
      );
    }

    const name = descriptor.name;
    const conf = permissions[name];

    if (!conf) {
      return Promise.reject(
        new TypeError(
          `Failed to execute 'query' on 'Permissions': The provided value '${name}' is not a valid enum value of type PermissionName.`
        )
      );
    }

    if (conf.state === "unsupported") {
      const errorType = conf.errorType || "Error";
      const errorClass =
        errorType === "TypeError"
          ? TypeError
          : errorType === "DOMException"
          ? DOMException
          : Error;
      return Promise.reject(new errorClass(conf.error));
    }

    const status = Object.create(PermissionStatus.prototype);
    status._internalState = getSessionPermissionState(name);

    Object.defineProperty(status, "state", {
      get() {
        return this._internalState;
      },
      set(v) {
        this._internalState = v;
      },
      configurable: true,
      enumerable: true,
    });

    status.name = conf.name || name;
    status._listeners = new Set();
    status.onchange = conf.onchangeExists ? () => {} : null;

    Object.defineProperty(status, Symbol.toStringTag, {
      value: "PermissionStatus",
      writable: false,
      enumerable: false,
      configurable: true,
    });

    if (conf.onchangeExists) {
      const randomDelay = 500 + Math.random() * 1500;
      setTimeout(() => {
        status.state = status.state === "granted" ? "denied" : "granted";

        const event = new Event("change");
        Object.defineProperty(event, "constructor", {
          value: {
            name: "Event",
            toString: () => "function Event() { [native code] }",
          },
          configurable: true,
        });

        status.dispatchEvent(event);
      }, randomDelay);
    }

    // Uncomment for testing/debugging:
    // console.debug("[spoof] navigator.permissions.query:", name, "=>", status.state);

    return new Promise((resolve) =>
      setTimeout(() => resolve(status), 10 + Math.floor(Math.random() * 10))
    );
  };

  const customRequest = (descriptor) => customQuery(descriptor);

  const customRevoke = (descriptor) =>
    Promise.reject(
      new DOMException(
        "Failed to execute 'revoke' on 'Permissions': This feature is not implemented.",
        "NotSupportedError"
      )
    );

  spoofNative(customQuery, "query");
  spoofNative(customRequest, "request");
  spoofNative(customRevoke, "revoke");

  const fakePermissionsToString = function permissions() {};
  spoofNative(fakePermissionsToString, "permissions");

  Object.defineProperty(navigator, "permissions", {
    value: new Proxy(
      {
        query: customQuery,
        request: customRequest,
        revoke: customRevoke,
      },
      {
        get(target, prop) {
          if (prop === "toString") return fakePermissionsToString;
          if (prop === Symbol.toStringTag) return "Permissions";
          if (prop in target) return target[prop];
          return Reflect.get(navigator.permissions, prop);
        },
        has(target, prop) {
          return prop in target;
        },
        ownKeys(target) {
          return Reflect.ownKeys(target);
        },
        getPrototypeOf() {
          return Permissions?.prototype ?? Object.prototype;
        },
      }
    ),
    enumerable: false,
    configurable: false,
    writable: false,
  });

  Object.freeze(navigator.permissions);

  // ----------------- end of Battery API spoofing ----------------- //
  spoofBattery();

  // ----------------- Orientation spoofing ----------------- //
  spoofoOrientation();

  // ----------------- CSS Media Queries spoofing ----------------- //
  const realMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query) => {
    const mq = realMatchMedia(query);
    if (mediaQueries.hasOwnProperty(query)) {
      Object.defineProperties(mq, {
        matches: { value: mediaQueries[query], configurable: true },
        media: { value: query, configurable: true },
      });
      mq.addListener = mq.addListener || (() => {});
      mq.removeListener = mq.removeListener || (() => {});
      mq.onchange = mq.onchange || null;
      ["addListener", "removeListener"].forEach((fn) => {
        mq[fn].toString = () => `function ${fn}() { [native code] }`;
      });
      mq.toString = () => "[object MediaQueryList]";
    }
    return mq;
  };

  const realCssSupports = CSS.supports.bind(CSS);
  CSS.supports = (prop, val) => {
    const key = typeof val === "undefined" ? prop : `${prop}: ${val}`;
    if (cssSupports.hasOwnProperty(key)) {
      return cssSupports[key];
    }
    return realCssSupports(prop, val);
  };

  // ----------------- USB Devices spoofing ----------------- //
  spoofUSB(usbDevices);

  //------------------ Storage API spoofing ----------------- //
  spoofStorage(storage);

  // ----------------- Canvas spoofing ----------------- //
  spoofCanvas(canvasFP);

  // ----------------- Audio spoofing ----------------- //
  spoofVideoAndAudio();

  // ----------------- start of RTCPeerConnection spoofing ----------------- //
  const candidateMap = new Map(webrtcCandidates.map((c) => [c.candidate, c]));

  const patchCandidate = (candidate) => {
    const spoof = candidateMap.get(candidate.candidate);
    if (!spoof) return;

    for (const key of [
      "address",
      "port",
      "relatedAddress",
      "relatedPort",
      "foundation",
      "protocol",
      "priority",
      "type",
      "component",
    ]) {
      if (spoof[key] !== undefined) {
        try {
          Object.defineProperty(candidate, key, {
            get: () => spoof[key],
            configurable: true,
          });
        } catch (e) {}
      }
    }

    // Mimic native toString
    Object.defineProperty(candidate, "toString", {
      value: () => `function RTCIceCandidate() { [native code] }`,
      configurable: true,
    });
  };

  const NativeRTCPeerConnection = window.RTCPeerConnection;
  if (!NativeRTCPeerConnection) return;

  function PatchedRTCPeerConnection(...args) {
    const pc = new NativeRTCPeerConnection(...args);

    let _onice = null;
    Object.defineProperty(pc, "onicecandidate", {
      configurable: true,
      get: () => _onice,
      set: (fn) => {
        _onice = (event) => {
          if (event && event.candidate) {
            patchCandidate(event.candidate);
          }
          return fn?.(event);
        };
      },
    });

    // Optional: Patch addIceCandidate if reCAPTCHA probes it
    const nativeAddIceCandidate = pc.addIceCandidate.bind(pc);
    pc.addIceCandidate = async function (candidate) {
      patchCandidate(candidate);
      return nativeAddIceCandidate(candidate);
    };

    return pc;
  }

  window.RTCPeerConnection = PatchedRTCPeerConnection;
  PatchedRTCPeerConnection.prototype = NativeRTCPeerConnection.prototype;
  Object.freeze(window.RTCPeerConnection);

  //----------- Mimic native future toString -----------------//
  const originalToString = Function.prototype.toString;
  Function.prototype.toString = new Proxy(originalToString, {
    apply: (target, thisArg, args) => {
      // If the function has its own custom toString (like mimicNativeToString did)
      const ownToString = thisArg.toString;
      if (
        typeof thisArg === "function" &&
        ownToString &&
        ownToString !== originalToString &&
        ownToString.toString().includes("[native code]")
      ) {
        return `function ${thisArg.name || ""}() { [native code] }`;
      }
      return Reflect.apply(target, thisArg, args);
    },
  });

  // Avoid freezing to allow future patching by stealth plugins
  // Only freeze or define properties that are 100% final
  Object.defineProperty(Function.prototype, "toString", {
    configurable: true, // ✅ safer for inspection and Keep true to avoid breakage
    writable: false,
    enumerable: false,
  });

  Object.freeze(window.chrome.loadTimes);
  Object.freeze(window.chrome.csi);
  // Object.freeze(window.chrome.runtime.getPlatformInfo);
  // Object.freeze(window.chrome.runtime.getPackageDirectoryEntry);
})();
