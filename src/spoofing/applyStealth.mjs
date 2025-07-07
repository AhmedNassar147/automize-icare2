/**
 * Apply stealth and anti-detection patches to a Puppeteer `page` instance.
 * Designed for Saudi Arabia-based environments.
 * Handles advanced anti-bot systems including reCAPTCHA detection evasion.
 *
 * Dependencies:
 * - Puppeteer
 * - Designed to work with `fingerprint-injector` (if in use)
 */
import randomMouseJitter from "../randomMouseJitter.mjs";
import randomIdleDelay from "../randomIdleDelay.mjs";
import readJsonFile from "../readJsonFile.mjs";

// const fakeBrands = shuffle([
//   { brand: "Google Chrome", version: "137" },
//   { brand: "Chromium", version: "137" },
//   { brand: "Not/A)Brand", version: "24" },
// ]);

// const fakeUAData = {
//   platform: "Windows",
//   uaFullVersion: "137.0.7151.120",
//   brands: fakeBrands,
//   platformVersion: "19.0.0",
//   architecture: "x86",
// };

// const fakePlugins = {
//   pdfPlugin: {
//     name: "Chrome PDF Plugin",
//     description: "Portable Document Format",
//     filename: "internal-pdf-viewer",
//     length: 1,
//     0: {
//       type: "application/pdf",
//       suffixes: "pdf",
//       description: "Portable Document Format",
//     },
//   },
//   viewerPlugin: {
//     name: "Chrome PDF Viewer",
//     description: "",
//     filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
//     length: 1,
//     0: {
//       type: "application/x-google-chrome-pdf",
//       suffixes: "pdf",
//       description: "",
//     },
//   },
// };

// const pluginsArray = {
//   0: fakePlugins.pdfPlugin,
//   1: fakePlugins.viewerPlugin,
//   length: 2,
//   item(index) {
//     return this[index] || null;
//   },
//   namedItem(name) {
//     for (let i = 0; i < this.length; i++) {
//       if (this[i].name === name) return this[i];
//     }
//     return null;
//   },
//   refresh() {
//     // موجود فقط لتطابق واجهة المتصفح الحقيقي
//   },
//   [Symbol.iterator]: function* () {
//     for (let i = 0; i < this.length; i++) yield this[i];
//   },
// };

// const mimeTypesArray = {
//   0: {
//     type: "application/pdf",
//     suffixes: "pdf",
//     description: "Portable Document Format",
//     enabledPlugin: fakePlugins.pdfPlugin,
//   },
//   1: {
//     type: "application/x-google-chrome-pdf",
//     suffixes: "pdf",
//     description: "",
//     enabledPlugin: fakePlugins.viewerPlugin,
//   },
//   length: 2,
//   item(index) {
//     return this[index] || null;
//   },
//   namedItem(name) {
//     for (let i = 0; i < this.length; i++) {
//       if (this[i].type === name) return this[i];
//     }
//     return null;
//   },
//   [Symbol.iterator]: function* () {
//     for (let i = 0; i < this.length; i++) yield this[i];
//   },
// };

const applyStealth = async (page) => {
  const fingerprint = readJsonFile("./fingerprint.json", true);

  await page.evaluateOnNewDocument((fingerprint) => {
    const {
      baseNavigatorOptions,
      dimensionsData,
      userAgent,
      mediaDevices,
      dateTimeOptions,
      numberFormatOptions,
      userAgentData,
      userAgentFullBrands,
      storage,
      connection,
      orientation,
      windowChrome,
      permissions,
      usbDevices,
      isBluetoothAvailable,
      plugins,
      mimeTypes,
      webglInfo,
      webrtcPrivateIP,
      devicePixelRatio,
    } = fingerprint;

    const patchIframe = (iframe) => {
      try {
        const win = iframe.contentWindow;

        const sameOrigin =
          win && win.location && win.location.origin === window.origin;

        if (!sameOrigin) return;

        Object.defineProperty(win.navigator, "webdriver", {
          get: () => undefined,
          configurable: true,
        });

        Object.defineProperty(iframe, "contentWindow", {
          get: () => win, // أكثر دقة من window
        });
      } catch (e) {
        // Cross-origin iframe, skip it
      }
    };

    function override(obj, prop, value) {
      Object.defineProperty(obj, prop, {
        get: () => value,
        configurable: true,
      });
    }

    const shuffleArray = (arr) =>
      arr.map((v) => ({ ...v })).sort(() => Math.random() - 0.5);

    // Disable debug logs
    console.debug = () => {};

    // Add time jitter to reduce fingerprint accuracy
    const jitter = () => Math.floor(Math.random() * 10 - 5); // -5 to +4 ms;

    // Patch Math.random slightly to introduce noise
    const origRand = Math.random;
    Math.random = function () {
      return origRand() + (origRand() - 0.5) * 0.0001;
    };

    Math.random.toString = () => "function random() { [native code] }";

    // Patch performance.now()
    const originalNow = performance.now.bind(performance);
    performance.now = new Proxy(originalNow, {
      apply: (target, thisArg, args) =>
        Reflect.apply(target, thisArg, args) + jitter(),
    });

    performance.now.toString = () => "function now() { [native code] }";

    // Patch Date.now()
    const originalDateNow = Date.now.bind(Date);
    Date.now = new Proxy(originalDateNow, {
      apply: (target, thisArg, args) =>
        Reflect.apply(target, thisArg, args) + jitter(),
    });

    // const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
    // Date.prototype.getTimezoneOffset = function () {
    //   return -180; // for UTC+3
    // };

    Date.now.toString = () => "function now() { [native code] }";

    // Patch performance.timeOrigin to remain consistent
    Object.defineProperty(performance, "timeOrigin", {
      get: () => originalDateNow() - originalNow(),
      configurable: true,
    });

    const {
      innerWidth,
      innerHeight,
      outerWidth,
      outerHeight,
      availWidth,
      availHeight,
      availTop,
      availLeft,
      colorDepth,
      pixelDepth,
      screenHeight,
      screenWidth,
    } = dimensionsData;

    // Optional patch (must be injected early)
    // const origFontFace = window.FontFace;
    // window.FontFace = function (...args) {
    //   return new origFontFace(...args);
    // };
    // window.FontFace.toString = () => "function FontFace() { [native code] }";

    // window dimensions
    override(window, "outerWidth", outerWidth);
    override(window, "outerHeight", outerHeight);
    override(window, "innerWidth", innerWidth);
    override(window, "innerHeight", innerHeight);

    // screen dimensions
    override(screen, "width", screenWidth);
    override(screen, "height", screenHeight);
    override(screen, "availWidth", availWidth);
    override(screen, "availHeight", availHeight);
    override(screen, "availTop", availTop);
    override(screen, "availLeft", availLeft);
    override(screen, "colorDepth", colorDepth);
    override(screen, "pixelDepth", pixelDepth);

    if (devicePixelRatio) {
      override(window, "devicePixelRatio", devicePixelRatio);
    }

    Object.defineProperty(Navigator.prototype, "webdriver", {
      get: () => baseNavigatorOptions.webdriver,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "languages", {
      get: () => Object.freeze(baseNavigatorOptions.languages),
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(Navigator.prototype, "language", {
      get: () => baseNavigatorOptions.language,
      configurable: true,
      enumerable: true,
    });

    Object.defineProperty(Navigator.prototype, "userAgent", {
      get: () => userAgent,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "appVersion", {
      get: () => baseNavigatorOptions.appVersion,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "appName", {
      get: () => baseNavigatorOptions.appName,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "appCodeName", {
      get: () => baseNavigatorOptions.appCodeName,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "product", {
      get: () => baseNavigatorOptions.product,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "productSub", {
      get: () => baseNavigatorOptions.productSub,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "pdfViewerEnabled", {
      get: () => baseNavigatorOptions.pdfViewerEnabled,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "platform", {
      get: () => baseNavigatorOptions.platform,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "vendor", {
      get: () => baseNavigatorOptions.vendor,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "brave", {
      get: () => undefined,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
      get: () => baseNavigatorOptions.hardwareConcurrency,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "maxTouchPoints", {
      get: () => baseNavigatorOptions.maxTouchPoints,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "doNotTrack", {
      get: () => baseNavigatorOptions.doNotTrack,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "deviceMemory", {
      get: () => baseNavigatorOptions.deviceMemory,
      configurable: true,
    });

    const spoofedFunctions = new Set([]);

    // --- Step 1: OfflineAudioContext spoofing ---
    if (window.webkitOfflineAudioContext && !window.OfflineAudioContext) {
      window.OfflineAudioContext = window.webkitOfflineAudioContext;
    }

    if (window.OfflineAudioContext) {
      const OrigOffline = window.OfflineAudioContext;
      window.OfflineAudioContext = function (channels, length, sampleRate) {
        const ctx = new OrigOffline(channels, length, sampleRate);
        const origRender = ctx.startRendering.bind(ctx);
        ctx.startRendering = function () {
          return origRender().then((buffer) => {
            // Slight noise injection: mimic Brave farbling
            for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
              const data = buffer.getChannelData(ch);
              for (let i = 0; i < data.length; i += 1000) {
                data[i] += (Math.random() - 0.5) * 1e-6;
              }
            }
            return buffer;
          });
        };
        spoofedFunctions.add(ctx.startRendering);
        return ctx;
      };
      window.OfflineAudioContext.prototype = OrigOffline.prototype;
      Object.setPrototypeOf(window.OfflineAudioContext, OrigOffline);
      spoofedFunctions.add(window.OfflineAudioContext);
    }

    // --- Step 2: AudioBuffer spoofing ---
    const origGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function () {
      const arr = origGetChannelData.apply(this, arguments);
      for (
        let i = 0;
        i < arr.length;
        i += 500 + Math.floor(Math.random() * 100)
      ) {
        arr[i] += (Math.random() - 0.5) * 1e-6;
      }

      return arr;
    };
    spoofedFunctions.add(AudioBuffer.prototype.getChannelData);

    // ---- Canvas fingerprint protection ----
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = originalGetContext.apply(this, args);

      if (args[0] === "2d") {
        const originalGetImageData = context.getImageData;

        context.getImageData = function (x, y, w, h) {
          const imageData = originalGetImageData.call(this, x, y, w, h);
          const data = imageData.data;

          for (let i = 0; i < data.length; i += 4) {
            data[i] = data[i] + (Math.random() - 0.5) * 1; // R
            data[i + 1] = data[i + 1] + (Math.random() - 0.5) * 1; // G
            data[i + 2] = data[i + 2] + (Math.random() - 0.5) * 1; // B
            // alpha untouched
          }

          return imageData;
        };

        Object.defineProperty(context.getImageData, "length", {
          value: 3,
          writable: false,
          enumerable: false,
          configurable: true,
        });

        spoofedFunctions.add(context.getImageData);
      }

      return context;
    };
    spoofedFunctions.add(HTMLCanvasElement.prototype.getContext);

    // ---- DOMRect manipulation ----
    const originalGetBoundingClientRect =
      Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const rect = originalGetBoundingClientRect.apply(this);
      const delta = (Math.random() - 0.5) * 0.2;
      return {
        ...rect,
        width: rect.width + delta,
        height: rect.height + delta,
        top: rect.top + delta,
        left: rect.left + delta,
        right: rect.right + delta,
        bottom: rect.bottom + delta,
        x: rect.x + delta,
        y: rect.y + delta,
        toJSON: () => ({
          width: rect.width + delta,
          height: rect.height + delta,
          top: rect.top + delta,
          left: rect.left + delta,
          right: rect.right + delta,
          bottom: rect.bottom + delta,
          x: rect.x + delta,
          y: rect.y + delta,
        }),
      };
    };
    spoofedFunctions.add(Element.prototype.getBoundingClientRect);

    const originalGetClientRects = Element.prototype.getClientRects;
    Element.prototype.getClientRects = function () {
      const rects = originalGetClientRects.apply(this);
      const output = Array.from(rects).map((rect) => {
        const delta = (Math.random() - 0.5) * 0.2;
        return {
          ...rect,
          width: rect.width + delta,
          height: rect.height + delta,
          top: rect.top + delta,
          left: rect.left + delta,
          right: rect.right + delta,
          bottom: rect.bottom + delta,
          x: rect.x + delta,
          y: rect.y + delta,
          toJSON: () => ({
            width: rect.width + delta,
            height: rect.height + delta,
            top: rect.top + delta,
            left: rect.left + delta,
            right: rect.right + delta,
            bottom: rect.bottom + delta,
            x: rect.x + delta,
            y: rect.y + delta,
          }),
        };
      });
      return output;
    };
    spoofedFunctions.add(Element.prototype.getClientRects);

    // --- Custom mediaDevices spoofing ---
    const MediaDevicesConstructor = navigator.mediaDevices.constructor;

    const customMediaDevices = Object.create(MediaDevicesConstructor.prototype);

    Object.assign(customMediaDevices, {
      enumerateDevices: () => Promise.resolve(mediaDevices.enumeratedDevices),
      getDisplayMedia: () =>
        Promise.reject(
          new DOMException("Permission denied", "NotAllowedError")
        ),
      getUserMedia: () =>
        Promise.reject(
          new TypeError(
            "Failed to execute 'getUserMedia' on 'MediaDevices': The provided value is not of type 'MediaStreamConstraints'."
          )
        ),
      getSupportedConstraints: () => mediaDevices.supportedConstraints,
      setCaptureHandleConfig: () => {},
      get ondevicechange() {
        return null;
      },
      set ondevicechange(_) {},
    });

    Object.defineProperty(customMediaDevices, "constructor", {
      value: MediaDevicesConstructor,
    });

    Object.defineProperty(Navigator.prototype, "mediaDevices", {
      get: () => customMediaDevices,
      configurable: true,
    });

    spoofedFunctions.add(customMediaDevices.getUserMedia);
    spoofedFunctions.add(customMediaDevices.getDisplayMedia);
    spoofedFunctions.add(customMediaDevices.enumerateDevices);
    spoofedFunctions.add(customMediaDevices.getSupportedConstraints);
    spoofedFunctions.add(customMediaDevices.setCaptureHandleConfig);

    const spoofedUserAgentData = Object.create(NavigatorUAData.prototype);

    Object.defineProperties(spoofedUserAgentData, {
      brands: {
        get: () => shuffleArray(userAgentData.brands),
      },
      mobile: {
        get: () => userAgentData.mobile,
      },
      platform: {
        get: () => userAgentData.platform,
      },
      getHighEntropyValues: {
        value: async function (hints) {
          if (!Array.isArray(hints)) {
            throw new TypeError(
              "Failed to execute 'getHighEntropyValues' on 'NavigatorUAData': 1 argument required, but only 0 present."
            );
          }

          const result = {
            brands: shuffleArray(userAgentData.brands),
            mobile: userAgentData.mobile,
            platform: userAgentData.platform,
          };

          for (const hint of hints) {
            if (hint in userAgentFullBrands) {
              const val = userAgentFullBrands[hint];
              result[hint] = Array.isArray(val) ? shuffleArray(val) : val;
            }
          }

          return result;
        },
        enumerable: false,
      },
      toJSON: {
        value: () => ({
          brands: shuffleArray(userAgentData.brands),
          mobile: userAgentData.mobile,
          platform: userAgentData.platform,
        }),

        enumerable: false,
      },
    });

    Object.defineProperty(Navigator.prototype, "userAgentData", {
      get: () => spoofedUserAgentData,
      configurable: true,
    });

    spoofedFunctions.add(spoofedUserAgentData.getHighEntropyValues);
    spoofedFunctions.add(spoofedUserAgentData.toJSON);

    // --- Bluetooth ---
    const spoofedBluetooth = Object.create(Bluetooth.prototype || {});

    // -- navigator.bluetooth --
    Object.defineProperties(spoofedBluetooth, {
      getAvailability: {
        value: function () {
          return Promise.resolve(isBluetoothAvailable);
        },
        configurable: true,
        enumerable: true,
        writable: true,
      },
      requestDevice: {
        value: function (options) {
          if (
            !options ||
            typeof options !== "object" ||
            (!options.acceptAllDevices && !options.filters)
          ) {
            return Promise.reject(
              new TypeError(
                "Failed to execute 'requestDevice' on 'Bluetooth': Either 'filters' should be present or 'acceptAllDevices' should be true."
              )
            );
          }
          return Promise.reject(
            new DOMException(
              "User cancelled the requestDevice() chooser.",
              "NotFoundError"
            )
          );
        },
        configurable: true,
        enumerable: true,
        writable: true,
      },
      onavailabilitychanged: {
        get: () => null,
        set: (_) => {},
        configurable: true,
      },
      addEventListener: {
        value: () => {},
        writable: true,
        configurable: true,
      },
      removeEventListener: {
        value: () => {},
        writable: true,
        configurable: true,
      },
      when: {
        value: () => {},
        writable: true,
        configurable: true,
      },
    });

    Object.defineProperty(Navigator.prototype, "bluetooth", {
      get: () => spoofedBluetooth,
      configurable: true,
    });

    spoofedFunctions.add(spoofedBluetooth.getAvailability);
    spoofedFunctions.add(spoofedBluetooth.requestDevice);
    spoofedFunctions.add(spoofedBluetooth.addEventListener);
    spoofedFunctions.add(spoofedBluetooth.removeEventListener);
    spoofedFunctions.add(spoofedBluetooth.when);

    // ------------------------- navigator.usb ---------------- //
    const spoofedUSB = Object.create(USB?.prototype ?? {});

    Object.defineProperties(spoofedUSB, {
      getDevices: {
        value: () => Promise.resolve(usbDevices),
        writable: true,
        configurable: true,
      },
      onconnect: {
        value: null,
        writable: true,
        configurable: true,
      },
      ondisconnect: {
        value: null,
        writable: true,
        configurable: true,
      },
      addEventListener: {
        value: () => {},
        writable: true,
        configurable: true,
      },
      removeEventListener: {
        value: () => {},
        writable: true,
        configurable: true,
      },
      when: {
        value: () => {},
        writable: true,
        configurable: true,
      },
    });

    Object.defineProperty(Navigator.prototype, "usb", {
      get: () => spoofedUSB,
      configurable: true,
    });

    spoofedFunctions.add(spoofedUSB.getDevices);
    spoofedFunctions.add(spoofedUSB.addEventListener);
    spoofedFunctions.add(spoofedUSB.removeEventListener);
    spoofedFunctions.add(spoofedUSB.when);

    // -- navigator.connection --
    const spoofedConnection = Object.create(
      NetworkInformation?.prototype ?? {}
    );

    Object.defineProperties(spoofedConnection, {
      effectiveType: {
        get: () => connection.effectiveType,
        configurable: true,
      },
      rtt: {
        get: () => connection.rtt + Math.floor(Math.random() * 15),
        configurable: true,
      },
      downlink: {
        get: () => connection.downlink + Math.random(),
        configurable: true,
      },
      saveData: {
        get: () => connection.saveData,
        configurable: true,
      },
      onchange: {
        value: null,
        writable: true,
        configurable: true,
      },
      addEventListener: {
        value: () => {},
        writable: true,
        configurable: true,
      },
      removeEventListener: {
        value: () => {},
        writable: true,
        configurable: true,
      },
      when: {
        value: () => {},
        writable: true,
        configurable: true,
      },
    });

    Object.defineProperty(Navigator.prototype, "connection", {
      get: () => spoofedConnection,
      configurable: true,
    });

    spoofedFunctions.add(spoofedConnection.addEventListener);
    spoofedFunctions.add(spoofedConnection.removeEventListener);
    spoofedFunctions.add(spoofedConnection.when);

    // ----------- PasswordCredential, PublicKeyCredential, AuthenticatorAttestationResponse, AuthenticatorAssertionResponse

    // --- Step 1: Create spoofed constructors if not available ---
    if (typeof window.PasswordCredential !== "function") {
      window.PasswordCredential = function (data) {
        return Object.assign(
          Object.create({
            [Symbol.toStringTag]: "PasswordCredential",
            toJSON() {
              return {
                id: this.id,
                type: this.type,
                name: this.name,
                iconURL: this.iconURL,
              };
            },
          }),
          data
        );
      };
      spoofedFunctions.add(window.PasswordCredential);
    }

    if (typeof window.PublicKeyCredential !== "function") {
      window.PublicKeyCredential = function (data) {
        return Object.assign(
          Object.create({
            [Symbol.toStringTag]: "PublicKeyCredential",
            toJSON() {
              return {
                id: this.id,
                type: this.type,
                authenticatorAttachment: this.authenticatorAttachment,
                userVerification: this.userVerification,
              };
            },
            getClientExtensionResults: () => ({}),
          }),
          data
        );
      };
      spoofedFunctions.add(window.PublicKeyCredential);
    }

    // --- Step 2: In-memory state for created credential ---
    let lastCreatedCredential = null;

    // --- Step 3: Define spoofed CredentialsContainer prototype ---
    const spoofedCredentialsPrototype = {
      get(options) {
        return new Promise((resolve, reject) => {
          if (!options || typeof options !== "object") {
            return reject(
              new TypeError(
                "Failed to execute 'get' on 'CredentialsContainer': 1 argument required, but only 0 present."
              )
            );
          }
          const types = ["password", "federated", "publicKey"];
          const presentTypes = types.filter((type) => type in options);
          if (presentTypes.length !== 1) {
            return reject(
              new DOMException(
                "Only exactly one of 'password', 'federated', and 'publicKey' credential types are currently supported.",
                "NotSupportedError"
              )
            );
          }
          if ("password" in options) {
            const cred = new window.PasswordCredential({
              id: "user@example.com",
              type: "password",
              password: "secret",
              name: "Test User",
              iconURL: "https://example.com/avatar.png",
            });
            spoofedFunctions.add(cred.toJSON);
            Object.preventExtensions(cred);
            return setTimeout(() => resolve(cred), 300); // Simulate device delay
          }
          return reject(
            new DOMException(
              "Credential type not implemented in this spoof.",
              "NotSupportedError"
            )
          );
        });
      },

      create(options) {
        return new Promise((resolve, reject) => {
          if (!options || typeof options !== "object") {
            return reject(
              new TypeError(
                "Failed to execute 'create' on 'CredentialsContainer': 1 argument required, but only 0 present."
              )
            );
          }
          const types = ["password", "federated", "publicKey"];
          const presentTypes = types.filter((type) => type in options);
          if (presentTypes.length !== 1) {
            return reject(
              new DOMException(
                "Only exactly one of 'password', 'federated', and 'publicKey' credential types are currently supported.",
                "NotSupportedError"
              )
            );
          }
          if ("publicKey" in options) {
            const response = {
              clientDataJSON: new Uint8Array([123, 34]).buffer,
              attestationObject: new Uint8Array([0x30, 0x82, 0x01, 0x0a])
                .buffer, // Fake DER-style cert
              [Symbol.toStringTag]: "AuthenticatorAttestationResponse",
              toJSON() {
                return {
                  clientDataJSON: Array.from(
                    new Uint8Array(this.clientDataJSON)
                  ),
                  attestationObject: Array.from(
                    new Uint8Array(this.attestationObject)
                  ),
                };
              },
            };

            const pubKeyCred = new window.PublicKeyCredential({
              id: "mock-credential-id",
              type: "public-key",
              rawId: new Uint8Array([1, 2, 3, 4]).buffer,
              response,
              authenticatorAttachment:
                options.publicKey.authenticatorSelection
                  ?.authenticatorAttachment || "platform",
              userVerification:
                options.publicKey.authenticatorSelection?.userVerification ||
                "preferred",
            });

            spoofedFunctions.add(response.toJSON);
            spoofedFunctions.add(pubKeyCred.toJSON);
            spoofedFunctions.add(pubKeyCred.getClientExtensionResults);

            Object.preventExtensions(response);
            Object.preventExtensions(pubKeyCred);

            // Store in memory for later `store()`
            lastCreatedCredential = pubKeyCred;

            return setTimeout(() => resolve(pubKeyCred), 300); // Simulate device delay
          }

          return reject(
            new DOMException(
              "Credential type not implemented in this spoof.",
              "NotSupportedError"
            )
          );
        });
      },

      store(cred) {
        if (!cred && lastCreatedCredential) {
          cred = lastCreatedCredential;
        }
        // Clear stored credential after storing
        const stored = cred;
        lastCreatedCredential = null;
        return new Promise((resolve) => setTimeout(() => resolve(stored), 300)); // Simulate device delay
      },

      preventSilentAccess() {
        return new Promise(() => {}); // unresolved
      },

      isConditionalMediationAvailable() {
        return Promise.resolve(true);
      },

      toJSON() {
        return {
          get: "[native code]",
          create: "[native code]",
          store: "[native code]",
          preventSilentAccess: "[native code]",
          isConditionalMediationAvailable: "[native code]",
        };
      },
      [Symbol.toStringTag]: "CredentialsContainer",
    };

    // --- Step 4: Patch the credentials object ---
    spoofedFunctions.add(spoofedCredentialsPrototype.get);
    spoofedFunctions.add(spoofedCredentialsPrototype.create);
    spoofedFunctions.add(spoofedCredentialsPrototype.store);
    spoofedFunctions.add(spoofedCredentialsPrototype.preventSilentAccess);
    spoofedFunctions.add(
      spoofedCredentialsPrototype.isConditionalMediationAvailable
    );
    spoofedFunctions.add(spoofedCredentialsPrototype.toJSON);

    const spoofedCredentials = Object.create(spoofedCredentialsPrototype);

    Object.defineProperty(Navigator.prototype, "credentials", {
      get: () => spoofedCredentials,
      configurable: true,
    });

    // ---------------------------- storage spoof ---------------------------- //

    // --- Step 1: Define spoofed functions (external) ---
    function estimateStorage() {
      return new Promise((resolve) => {
        const usage = storage.used + Math.floor(Math.random() * 1024);

        const usageDetails =
          usage > 0
            ? {
                indexedDB: Math.floor(usage * 0.5),
                serviceWorkerRegistrations: Math.floor(usage * 0.25),
                caches:
                  usage - Math.floor(usage * 0.5) - Math.floor(usage * 0.25), // Remainder
              }
            : {};

        resolve({
          quota: storage.quota,
          usage,
          usageDetails,
        });
      });
    }

    function isStoragePersisted() {
      return new Promise((resolve) => resolve(storage.persisted));
    }

    // --- Step 2: Add functions to spoofedFunctions ---
    spoofedFunctions.add(estimateStorage);
    spoofedFunctions.add(isStoragePersisted);

    // --- Step 3: Create the spoofed StorageManager prototype ---
    const spoofedStoragePrototype = {
      estimate: estimateStorage,
      persisted: isStoragePersisted,
      [Symbol.toStringTag]: "StorageManager",
    };

    // --- Step 4: Create the spoofed storage object ---
    const spoofedStorage = Object.create(spoofedStoragePrototype);

    // --- Step 6: Patch navigator.storage ---
    Object.defineProperty(Navigator.prototype, "storage", {
      get: () => spoofedStorage,
      configurable: true,
    });

    // --------------------- spoofed Orientation ----------------
    const orientationState = {
      ...orientation,
      listeners: new Set(),
    };

    // Step 1: Define native-like ScreenOrientation if missing
    if (typeof window.ScreenOrientation !== "function") {
      function ScreenOrientation() {
        throw new TypeError("Illegal constructor");
      }

      Object.defineProperties(ScreenOrientation.prototype, {
        angle: {
          get() {
            return orientationState.angle;
          },
          configurable: true,
          enumerable: true,
        },
        type: {
          get() {
            return orientationState.type;
          },
          configurable: true,
          enumerable: true,
        },
        onchange: {
          get() {
            return this._onchange || null;
          },
          set(fn) {
            this._onchange = typeof fn === "function" ? fn : null;
          },
          configurable: true,
          enumerable: false, // 💡 changed for realism
        },
        lock: {
          value() {
            return Promise.resolve();
          },
          configurable: true,
          enumerable: true,
          writable: true,
        },
        unlock: {
          value() {},
          configurable: true,
          enumerable: true,
          writable: true,
        },
        addEventListener: {
          value(type, fn) {
            if (type === "change" && typeof fn === "function")
              orientationState.listeners.add(fn);
          },
          configurable: true,
          enumerable: true,
          writable: true,
        },
        removeEventListener: {
          value(type, fn) {
            if (type === "change" && typeof fn === "function")
              orientationState.listeners.delete(fn);
          },
          configurable: true,
          enumerable: true,
          writable: true,
        },
        dispatchEvent: {
          // optional
          value() {},
          configurable: true,
          enumerable: true,
          writable: true,
        },
        [Symbol.toStringTag]: {
          value: "ScreenOrientation",
          configurable: true,
        },
      });

      Object.defineProperty(window, "ScreenOrientation", {
        value: ScreenOrientation,
        configurable: true,
        writable: true,
        enumerable: false,
      });
    }

    // Step 2: Attach spoofed instance if missing
    if (!("orientation" in screen)) {
      const instance = Object.create(ScreenOrientation.prototype);
      instance._onchange = null;

      Object.defineProperty(screen, "orientation", {
        get: () => instance,
        configurable: true,
        enumerable: true,
      });
    }

    // Step 3: Register spoofed functions
    spoofedFunctions.add(ScreenOrientation);
    spoofedFunctions.add(ScreenOrientation.prototype.lock);
    spoofedFunctions.add(ScreenOrientation.prototype.unlock);
    spoofedFunctions.add(ScreenOrientation.prototype.addEventListener);
    spoofedFunctions.add(ScreenOrientation.prototype.removeEventListener);
    spoofedFunctions.add(ScreenOrientation.prototype.dispatchEvent);

    // --------------- spoofed navigator plugins and mime types ---------------- //
    function createPlugin(pluginData) {
      const plugin = Object.create(Plugin.prototype);

      plugin.name = pluginData.name;
      plugin.filename = pluginData.filename;
      plugin.description = pluginData.description;

      const pluginMimeTypes = pluginData.mimeTypes.map((mtData) => {
        const mimeType = Object.create(MimeType.prototype);
        mimeType.type = mtData.type;
        mimeType.description = mtData.description;
        mimeType.suffixes = mtData.suffixes;

        Object.defineProperty(mimeType, "enabledPlugin", {
          get() {
            return plugin;
          },
          enumerable: true,
          configurable: true,
        });

        return mimeType;
      });

      pluginMimeTypes.forEach((mt, i) => {
        Object.defineProperty(plugin, i, {
          get: () => pluginMimeTypes[i],
          enumerable: true,
          configurable: false,
        });
      });

      pluginMimeTypes.forEach((mt) => {
        Object.defineProperty(plugin, mt.type, {
          get: () => pluginMimeTypes.find((m) => m.type === mt.type),
          enumerable: false,
          configurable: false,
        });
      });

      Object.defineProperty(plugin, "length", {
        value: pluginMimeTypes.length,
        writable: false,
        enumerable: false,
        configurable: false,
      });

      Object.defineProperty(plugin, "mimeTypes", {
        value: pluginMimeTypes,
        writable: false,
        enumerable: false,
        configurable: false,
      });

      return plugin;
    }

    function createMimeType(mtData, pluginsByName) {
      const mimeType = Object.create(MimeType.prototype);
      mimeType.type = mtData.type;
      mimeType.description = mtData.description;
      mimeType.suffixes = mtData.suffixes;

      Object.defineProperty(mimeType, "enabledPlugin", {
        get() {
          return pluginsByName[mtData.enabledPlugin.name];
        },
        enumerable: true,
        configurable: true,
      });

      return mimeType;
    }

    const pluginsByName = {};

    const pluginsArray = plugins.map((pd) => {
      const plugin = createPlugin(pd);
      pluginsByName[pd.name] = plugin;
      return plugin;
    });

    pluginsArray.forEach((plugin, i) => {
      Object.defineProperty(pluginsArray, i, {
        get: () => pluginsArray[i],
        enumerable: true,
        configurable: false,
      });
    });

    Object.defineProperty(pluginsArray, "length", {
      value: pluginsArray.length,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    if (!PluginArray.prototype.item) {
      PluginArray.prototype.item = function (index) {
        return this[index] || null;
      };
    }

    if (!PluginArray.prototype.namedItem) {
      PluginArray.prototype.namedItem = function (name) {
        for (let i = 0; i < this.length; i++) {
          if (this[i].name === name) return this[i];
        }
        return null;
      };
    }

    if (!PluginArray.prototype.refresh) {
      PluginArray.prototype.refresh = function () {
        return undefined;
      };
    }

    Object.setPrototypeOf(pluginsArray, PluginArray.prototype);

    const mimeTypesArray = mimeTypes.map((mtData) =>
      createMimeType(mtData, pluginsByName)
    );

    mimeTypesArray.forEach((mt, i) => {
      Object.defineProperty(mimeTypesArray, i, {
        get: () => mimeTypesArray[i],
        enumerable: true,
        configurable: false,
      });
    });

    Object.defineProperty(mimeTypesArray, "length", {
      value: mimeTypesArray.length,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    if (!MimeTypeArray.prototype.item) {
      MimeTypeArray.prototype.item = function (index) {
        return this[index] || null;
      };
    }

    if (!MimeTypeArray.prototype.namedItem) {
      MimeTypeArray.prototype.namedItem = function (type) {
        for (let i = 0; i < this.length; i++) {
          if (this[i].type === type) return this[i];
        }
        return null;
      };
    }

    Object.setPrototypeOf(mimeTypesArray, MimeTypeArray.prototype);

    Object.defineProperty(Navigator.prototype, "plugins", {
      get: () => pluginsArray,
      configurable: true,
    });

    Object.defineProperty(Navigator.prototype, "mimeTypes", {
      get: () => mimeTypesArray,
      configurable: true,
    });

    // --------------- Intl.DateTimeFormat Patch --------
    const OriginalDTF = Intl.DateTimeFormat;
    const OriginalDTFResolved = OriginalDTF.prototype.resolvedOptions;

    function CustomDateTimeFormat(locales, options) {
      const locale = locales || dateTimeOptions.locale;
      const opts = {
        ...options,
        timeZone: dateTimeOptions.timeZone,
      };
      return new OriginalDTF(locale, opts);
    }

    CustomDateTimeFormat.prototype = OriginalDTF.prototype;
    Object.setPrototypeOf(CustomDateTimeFormat, OriginalDTF);
    Intl.DateTimeFormat = CustomDateTimeFormat;

    Intl.DateTimeFormat.prototype.resolvedOptions = function () {
      const base = OriginalDTFResolved.call(this);
      return { ...base, ...dateTimeOptions };
    };

    // --------------- Intl.NumberFormat Patch --------
    const OriginalNF = Intl.NumberFormat;
    const OriginalNFResolved = OriginalNF.prototype.resolvedOptions;

    function CustomNumberFormat(locales, options) {
      const locale = locales || numberFormatOptions.locale;
      return new OriginalNF(locale, options);
    }

    CustomNumberFormat.prototype = OriginalNF.prototype;
    Object.setPrototypeOf(CustomNumberFormat, OriginalNF);
    Intl.NumberFormat = CustomNumberFormat;

    Intl.NumberFormat.prototype.resolvedOptions = function () {
      const base = OriginalNFResolved.call(this);
      return { ...base, ...numberFormatOptions };
    };

    // Collator spoof
    const OriginalCollator = Intl.Collator;
    Intl.Collator = function (locales, options) {
      return new OriginalCollator(
        fingerprint.dateTimeOptions.locale || locales,
        options
      );
    };
    Intl.Collator.prototype = OriginalCollator.prototype;

    // RelativeTimeFormat spoof
    const OriginalRTF = Intl.RelativeTimeFormat;
    Intl.RelativeTimeFormat = function (locales, options) {
      return new OriginalRTF(
        fingerprint.dateTimeOptions.locale || locales,
        options
      );
    };
    Intl.RelativeTimeFormat.prototype = OriginalRTF.prototype;

    // Optional: Mark as native (for toString spoofing setups)
    spoofedFunctions.add(Intl.DateTimeFormat);
    spoofedFunctions.add(Intl.DateTimeFormat.prototype.resolvedOptions);
    spoofedFunctions.add(Intl.NumberFormat);
    spoofedFunctions.add(Intl.NumberFormat.prototype.resolvedOptions);
    spoofedFunctions.add(Intl.RelativeTimeFormat);
    spoofedFunctions.add(Intl.Collator);

    // --------------------- spoofed window.chrome ---------------------
    const chromeObj = {
      ...windowChrome,
      loadTimes: function () {
        return {
          commitLoadTime: Date.now(),
          connectionInfo: "h2",
          finishDocumentLoadTime: Date.now(),
          finishLoadTime: Date.now(),
          firstPaintAfterLoadTime: 0,
          navigationType: "Other",
          npnNegotiatedProtocol: "h2",
          requestTime: Date.now(),
          startLoadTime: Date.now(),
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: true,
          wasNpnNegotiated: true,
          firstPaintTime: Date.now(),
        };
      },
      csi: function () {
        return { startE: Date.now() };
      },
    };

    // تزوير chrome.runtime === undefined
    Object.defineProperty(chromeObj, "runtime", {
      get: () => undefined,
      configurable: false,
      enumerable: false,
    });

    // تزوير loadTimes و csi كدوال غير قابلة للكتابة ولا التعداد
    Object.defineProperty(chromeObj, "loadTimes", {
      value: chromeObj.loadTimes,
      writable: false,
      configurable: true,
      enumerable: false,
    });

    Object.defineProperty(chromeObj, "csi", {
      value: chromeObj.csi,
      writable: false,
      configurable: true,
      enumerable: false,
    });

    // تزوير window.chrome بالكامل
    Object.defineProperty(window, "chrome", {
      get: () => chromeObj,
      configurable: true,
      enumerable: false,
    });

    // أضف الدوال المزورة إلى spoofedFunctions لتزوير toString
    spoofedFunctions.add(chromeObj.loadTimes);
    spoofedFunctions.add(chromeObj.csi);

    // ------------------- navigator.permissions ------------------- //
    // Create fake PermissionStatus object
    function createFakePermissionStatus(state, name) {
      const status = {
        name,
        state,
        onchange: null,
        get onchange() {
          return null;
        },
        set onchange(cb) {
          // Could be logged or ignored
        },
        addEventListener() {},
        removeEventListener() {},
        when() {
          return Promise.resolve(state);
        },
      };
      spoofedFunctions.add(status.addEventListener);
      spoofedFunctions.add(status.removeEventListener);
      spoofedFunctions.add(status.when);
      return status;
    }

    // Override query
    navigator.permissions.query = function (params) {
      const name = params.name;
      const userVisibleOnly = params.userVisibleOnly;

      if (!(name in permissions)) {
        return Promise.reject(
          new TypeError(
            `Failed to execute 'query' on 'Permissions': The provided value '${name}' is not a valid enum value of type PermissionName.`
          )
        );
      }

      const entry = permissions[name];

      if (name === "push" && userVisibleOnly !== true) {
        return Promise.reject(
          new DOMException(
            "Failed to execute 'query' on 'Permissions': Push Permission without userVisibleOnly:true isn't supported yet.",
            "NotSupportedError"
          )
        );
      }

      if (entry.state === "unsupported") {
        const errType = entry.errorType || "Error";
        const errorClass = globalThis[errType] || Error;
        return Promise.reject(new errorClass(entry.error));
      }

      return Promise.resolve(
        createFakePermissionStatus(entry.state, entry.name)
      );
    };

    // Implement has() — not in spec yet but safe to spoof
    navigator.permissions.has = function (params) {
      return Promise.resolve(params.name in permissions);
    };

    // Implement revoke() — just return same PermissionStatus
    navigator.permissions.revoke = function (params) {
      const name = params.name;
      if (!(name in permissions) || permissions[name].state === "unsupported") {
        return Promise.reject(
          new TypeError(
            `Cannot revoke unknown or unsupported permission: '${name}'`
          )
        );
      }

      const { state, name: permissionName } = permissions[name];

      return Promise.resolve(createFakePermissionStatus(state, permissionName));
    };

    spoofedFunctions.add(navigator.permissions.query);
    spoofedFunctions.add(navigator.permissions.revoke);
    spoofedFunctions.add(navigator.permissions.has);

    // ------- navigator.webdriver -------
    const isCharging = Math.random() > 0.3;
    const level = isCharging
      ? 0.3 + Math.random() * 0.6 // e.g., 30% to 90%
      : 0.2 + Math.random() * 0.5; // e.g., 20% to 70%

    const batteryMock = Object.setPrototypeOf(
      {
        charging: isCharging,
        chargingTime: isCharging ? Math.floor(Math.random() * 3000 + 600) : 0, // 10–60 min
        dischargingTime: isCharging
          ? Infinity
          : Math.floor(Math.random() * 6000 + 1200), // 20–120 min
        level: parseFloat(level.toFixed(2)), // round to 2 decimals
        onchargingchange: null,
        onchargingtimechange: null,
        ondischargingtimechange: null,
        onlevelchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
      },
      EventTarget.prototype
    );

    spoofedFunctions.add(batteryMock.addEventListener);
    spoofedFunctions.add(batteryMock.removeEventListener);
    spoofedFunctions.add(batteryMock.dispatchEvent);

    Object.defineProperty(Navigator.prototype, "getBattery", {
      value: () => Promise.resolve(batteryMock),
      configurable: true,
      enumerable: true,
      writable: true,
    });

    // ------------------- WebGL ------------------- //
    // === Helper to spoof ShaderPrecisionFormat ===
    function createPrecisionFormat({ rangeMin, rangeMax, precision }) {
      return {
        rangeMin,
        rangeMax,
        precision,
        constructor: WebGLShaderPrecisionFormat,
        __proto__: WebGLShaderPrecisionFormat.prototype,
        toString: () => "[object WebGLShaderPrecisionFormat]",
      };
    }

    // === Patch WebGLRenderingContext ===
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = new Proxy(
      originalGetParameter,
      {
        apply(target, thisArg, args) {
          const param = args[0];
          if (param === 0x9245) return webglInfo.vendor; // UNMASKED_VENDOR_WEBGL
          if (param === 0x9246) return webglInfo.renderer; // UNMASKED_RENDERER_WEBGL
          return Reflect.apply(target, thisArg, args);
        },
      }
    );
    spoofedFunctions.add(WebGLRenderingContext.prototype.getParameter);

    // Supported extensions
    WebGLRenderingContext.prototype.getSupportedExtensions = function () {
      return [...webglInfo.extensions];
    };
    spoofedFunctions.add(
      WebGLRenderingContext.prototype.getSupportedExtensions
    );

    // Patch getExtension
    const originalGetExtension = WebGLRenderingContext.prototype.getExtension;
    WebGLRenderingContext.prototype.getExtension = function (name) {
      if (name === "WEBGL_debug_renderer_info") {
        // Return real-looking object
        return {
          UNMASKED_VENDOR_WEBGL: 0x9245,
          UNMASKED_RENDERER_WEBGL: 0x9246,
          toString: () => "[object WEBGL_debug_renderer_info]",
        };
      }
      if (!webglInfo.extensions.includes(name)) return null;
      return originalGetExtension.call(this, name);
    };
    spoofedFunctions.add(WebGLRenderingContext.prototype.getExtension);

    // Patch getShaderPrecisionFormat
    WebGLRenderingContext.prototype.getShaderPrecisionFormat = function (
      shaderType,
      precisionType
    ) {
      const base =
        shaderType === this.VERTEX_SHADER
          ? webglInfo.vertexFloatPrecision
          : webglInfo.fragmentFloatPrecision;
      return createPrecisionFormat(base);
    };

    spoofedFunctions.add(
      WebGLRenderingContext.prototype.getShaderPrecisionFormat
    );

    Object.defineProperty(Error, "prepareStackTrace", {
      value: undefined,
      writable: false,
      configurable: false,
    });

    Object.defineProperty(Error, "stackTraceLimit", {
      value: 10,
      writable: false,
      configurable: false,
    });

    const rawCaptureStackTrace = Error.captureStackTrace;

    const getCleanStack = function () {
      const err = {};
      if (rawCaptureStackTrace) {
        rawCaptureStackTrace(err, getCleanStack);
        return err.stack;
      } else {
        return new Error().stack;
      }
    };

    Object.defineProperty(Error.prototype, "stack", {
      get: function () {
        let stack = getCleanStack();
        if (!stack) return stack;

        return stack
          .split("\n")
          .filter(
            (line) =>
              !line.includes("__puppeteer_evaluation_script__") &&
              !line.includes("puppeteer_evaluation_script") &&
              !line.includes("puppeteer") &&
              !line.includes("at Page.evaluate") &&
              !line.includes("at Page.") &&
              !line.includes("at eval") &&
              !line.includes("at Object.<anonymous>") &&
              !line.includes("at processTicksAndRejections")
          )
          .join("\n");
      },
      configurable: true,
    });

    // تعديل جميع الـ iframes الموجودة بالفعل
    for (const iframe of document.querySelectorAll("iframe")) {
      patchIframe(iframe);
    }

    // مراقبة iframes الجديدة
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === "IFRAME") {
            node.addEventListener("load", () => patchIframe(node));
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });

    Object.defineProperty(window, "RTCPeerConnection", {
      get: () => undefined,
      configurable: true,
      enumerable: false,
    });

    Object.defineProperty(window, "webkitRTCPeerConnection", {
      get: () => undefined,
      configurable: true,
      enumerable: false,
    });

    // -------- WebRTC Leak patch --------
    const origCreateOffer = RTCPeerConnection.prototype.createOffer;

    RTCPeerConnection.prototype.createOffer = function () {
      const pc = this;
      pc.addEventListener("icecandidate", (event) => {
        if (event.candidate && event.candidate.candidate) {
          Object.defineProperty(event.candidate, "candidate", {
            get: () =>
              event.candidate.candidate.replace(
                /(\d{1,3}\.){3}\d{1,3}/g,
                webrtcPrivateIP || null
              ),
          });
        }
      });
      return origCreateOffer.apply(this, arguments);
    };

    Object.getOwnPropertyDescriptors = function (obj) {
      if (obj === navigator) {
        const descriptors = originalGetOwnPropertyDescriptors(obj);

        for (const key of Object.keys(baseNavigatorOptions)) {
          const existingDescriptor = descriptors[key];

          if (existingDescriptor !== undefined) {
            descriptors[key] = {
              configurable: existingDescriptor.configurable !== false,
              enumerable: existingDescriptor.enumerable,
              get: () => baseNavigatorOptions[key],
            };
          } else {
            descriptors[key] = {
              configurable: true,
              enumerable: key !== "webdriver", // 'webdriver' غير معدودة لمنع الكشف
              get: () => baseNavigatorOptions[key],
            };
          }
        }
        return descriptors;
      }

      return originalGetOwnPropertyDescriptors(obj);
    };

    spoofedFunctions.add(Object.getOwnPropertyDescriptors);

    // --- Patch Function.prototype.toString ---
    const originalFunctionToString = Function.prototype.toString;

    const toStringProxy = new Proxy(originalFunctionToString, {
      apply(target, thisArg, args) {
        try {
          if (typeof thisArg === "function") {
            // Specific spoof for getter
            if (thisArg.name === "get") {
              return "function get() { [native code] }";
            }

            // Generic spoof
            if (spoofedFunctions.has(thisArg)) {
              return `function ${thisArg.name || ""}() { [native code] }`;
            }
          }
        } catch (e) {
          // fail silently
        }

        return Reflect.apply(target, thisArg, args);
      },
    });

    // Secure override of Function.prototype.toString
    Object.defineProperty(Function.prototype, "toString", {
      value: toStringProxy,
      writable: false,
      configurable: false,
      enumerable: false,
    });

    // Secure the toString of toString
    Object.defineProperty(Function.prototype.toString, "toString", {
      value: () => "function toString() { [native code] }",
      writable: false,
      configurable: false,
      enumerable: false,
    });

    // Lock Symbol.toStringTag on Function to prevent leaks
    Object.defineProperty(Function.prototype, Symbol.toStringTag, {
      value: "Function",
      writable: false,
      configurable: false,
      enumerable: false,
    });

    try {
      if (!Object.isFrozen(navigator.userAgentData)) {
        Object.freeze(navigator.userAgentData);
      }

      if (!Object.isFrozen(window.chrome)) {
        Object.freeze(window.chrome);
      }

      if (!Object.isFrozen(Object.getPrototypeOf(navigator))) {
        Object.freeze(Object.getPrototypeOf(navigator));
      }

      if (!Object.isSealed(customMediaDevices)) {
        Object.seal(customMediaDevices);
      }

      if (!Object.isSealed(spoofedUserAgentData)) {
        Object.seal(spoofedUserAgentData);
      }

      if (!Object.isSealed(spoofedBluetooth)) {
        Object.seal(spoofedBluetooth);
      }

      if (!Object.isSealed(spoofedUSB)) {
        Object.seal(spoofedUSB);
      }

      if (!Object.isSealed(spoofedConnection)) {
        Object.seal(spoofedConnection);
      }

      if (!Object.isSealed(spoofedCredentials)) {
        Object.seal(spoofedCredentials);
      }

      if (!Object.isSealed(spoofedStorage)) {
        Object.seal(spoofedStorage);
      }

      if (!Object.isSealed(spoofedStoragePrototype)) {
        Object.seal(spoofedStoragePrototype);
      }
    } catch (e) {
      // In some rare environments this might fail
    }
  }, fingerprint);

  const {
    userAgent,
    baseNavigatorOptions: { languages, language },
  } = fingerprint;

  await page.setUserAgent(userAgent);

  function generateAcceptLanguageHeader() {
    const headerParts = [];

    // أضف اللغة الأساسية أولاً
    if (language && languages.includes(language)) {
      headerParts.push(language);
    }

    // أضف باقي اللغات مع q-value تنازليًا
    let q = 0.9;
    for (const lang of languages) {
      if (lang !== language) {
        headerParts.push(`${lang};q=${q.toFixed(1)}`);
        q -= 0.1;
      }
    }

    return headerParts.join(",");
  }

  await page.setExtraHTTPHeaders({
    "Accept-Language": generateAcceptLanguageHeader(),
  });

  await page.emulateTimezone(timezone);

  await randomMouseJitter(page);
  await page.click("body");

  await randomIdleDelay();
  await page.keyboard.press("Tab");

  await randomIdleDelay();
};

export default applyStealth;
