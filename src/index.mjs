/*
 *
 * Index
 *
 */
import dotenv from "dotenv";
dotenv.config();

import puppeteer from "puppeteer";
// import puppeteer from "puppeteer-extra";
// import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { createCursor } from "ghost-cursor";
import fs from "fs/promises";
import path from "path";
import PatientStore from "./PatientStore.mjs";
import waitForWaitingCountWithInterval from "./waitForWaitingCountWithInterval.mjs";
import generateFolderIfNotExisting from "./generateFolderIfNotExisting.mjs";
import readJsonFile from "./readJsonFile.mjs";
import sendMessageUsingWhatsapp, {
  shutdownAllClients,
} from "./sendMessageUsingWhatsapp.mjs";
import processSendCollectedPatientsToWhatsapp from "./processSendCollectedPatientsToWhatsapp.mjs";
// import processPatientAcceptanceOrRejection from "./processPatientAcceptanceOrRejection.mjs";
import {
  waitingPatientsFolderDirectory,
  generatedPdfsPath,
  COLLECTD_PATIENTS_FULL_FILE_PATH,
  USER_ACTION_TYPES,
  htmlFilesPath,
} from "./constants.mjs";

const collectConfimrdPatient = true;
// puppeteer.use(StealthPlugin());

function runSafe(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      err.stack = err.stack
        .split("\n")
        .filter(
          (line) =>
            !line.includes("puppeteer") &&
            !line.includes("node_modules") &&
            !line.includes("internal")
        )
        .join("\n");
      throw err;
    }
  };
}

const sleep = async (ms) =>
  await new Promise((resolve) => setTimeout(resolve, ms));

async function collectFingerprint() {
  const getBrands = () => navigator.userAgentData?.brands || [];

  const getValuesOfObject = (obj) => {
    const keys = Object.getOwnPropertyNames(Object.getPrototypeOf(obj));

    return keys.reduce((acc, key) => {
      const value = obj[key];
      const type = typeof value;
      if (
        type === "string" ||
        type === "number" ||
        type === "boolean" ||
        type === "undefined"
      ) {
        acc[key] = value;
      }
      return acc;
    }, {});
  };

  const getChrome = () => {
    try {
      return {
        runtime: window.chrome?.runtime,
        loadTimes: !!window.chrome?.loadTimes,
        csi: !!window.chrome?.csi,
        app: window.chrome?.app,
      };
    } catch {
      return null;
    }
  };

  const getPlugins = () =>
    navigator.plugins
      ? Array.from(navigator.plugins).map((p) => ({
          name: p.name,
          filename: p.filename,
          description: p.description,
          mimeTypes: Array.from(p).map((m) => ({
            type: m.type,
            description: m.description,
            suffixes: m.suffixes,
          })),
        }))
      : [];

  const getMimeTypes = () =>
    navigator.mimeTypes
      ? Array.from(navigator.mimeTypes).map((m) => ({
          type: m.type,
          description: m.description,
          suffixes: m.suffixes,
        }))
      : [];

  const highEntropyWithEmptyArrayParam =
    await navigator.userAgentData?.getHighEntropyValues([]);

  const highEntropyWithAllParamsInArray =
    await navigator.userAgentData?.getHighEntropyValues([
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
    ]);

  return {
    oscpu: navigator.oscpu || null,
    buildID: navigator.buildID || null,
    webDriver: navigator.webdriver,
    userAgent: navigator.userAgent,
    "navigator.userAgentData.brands": getBrands(),
    "navigator.userAgentData.platform":
      navigator.userAgentData?.platform || null,
    "navigator.userAgentData.mobile": navigator.userAgentData?.mobile ?? null,
    highEntropyWithEmptyArrayParam,
    highEntropyWithAllParamsInArray,
    language: navigator.language,
    languages: navigator.languages,
    platform: navigator.platform,
    vendor: navigator.vendor,
    plugins: getPlugins(),
    plugins_length: navigator.plugins?.length || 0,
    mimeTypes: getMimeTypes(),
    mimeTypes_length: navigator.mimeTypes?.length || 0,
    appCodeName: navigator.appCodeName,
    appName: navigator.appName,
    appVersion: navigator.appVersion,
    product: navigator.product,
    productSub: navigator.productSub,
    doNotTrack: navigator.doNotTrack,
    maxTouchPoints: navigator.maxTouchPoints,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
    keyboardSupport: typeof navigator.keyboard !== "undefined",
    intl: {
      locale: Intl.DateTimeFormat().resolvedOptions().locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hourCycle: Intl.DateTimeFormat().resolvedOptions().hourCycle,
    },
    documentFeatures: {
      hasHidden: "hidden" in document,
      hasVisibilityState: "visibilityState" in document,
      hasDocumentElement: !!document.documentElement,
      characterSet: document.characterSet,
    },
    permissionsStates: await Promise.all(
      [
        "geolocation",
        "notifications",
        "camera",
        "microphone",
        "clipboard-read",
        "clipboard-write",
        "background-sync",
        "persistent-storage",
      ].map(async (name) => {
        try {
          const status = await navigator.permissions.query({ name });
          return { name, state: status.state, statusName: status.name };
        } catch {
          return { name, state: "unsupported" };
        }
      })
    ),
    clipboardSupport: typeof navigator.clipboard !== "undefined",
    geolocationSupport: typeof navigator.geolocation !== "undefined",
    visibilityState: document.visibilityState,
    width: window.innerWidth,
    height: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    devicePixelRatio: window.devicePixelRatio,
    widthDiff: window.outerWidth - window.innerWidth,
    heightDiff: window.outerHeight - window.innerHeight,
    screen: {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      availTop: screen.availTop,
      availLeft: screen.availLeft,
      colorDepth: screen.colorDepth,
      pixelDepth: screen.pixelDepth,
      "screen.orientation": {
        type: screen.orientation.type,
        angle: screen.orientation.angle,
        lockIsFunction: typeof screen.orientation.lock === "function",
      },
    },
    visualViewport: {
      width: window.visualViewport?.width || null,
      height: window.visualViewport?.height || null,
      scale: window.visualViewport?.scale || null,
    },
    "window.chrome": getChrome(),
    // errorStackTrace: (() => {
    //   try {
    //     throw new Error("test");
    //   } catch (e) {
    //     console.log(`ERROR`, e);
    //     return e.stack?.split("\n");
    //   }
    // })(),
    popupBlocked: (() => {
      try {
        const popup = window.open("", "", "width=100,height=100");
        const blocked =
          !popup || popup.closed || typeof popup.closed === "undefined";
        if (popup && !popup.closed) popup.close();
        return blocked ? "likely_blocked" : "allowed";
      } catch {
        return "error";
      }
    })(),
    audioFingerprint: (() => {
      try {
        const context = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyser = context.createAnalyser();
        const buffer = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(buffer);
        return buffer.slice(0, 10);
      } catch (e) {
        return `Error: ${e.message}`;
      }
    })(),
    canvasFingerprint: (() => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = "#069";
        ctx.fillText("Hello, world!", 2, 2);
        return canvas.toDataURL();
      } catch (e) {
        return null;
      }
    })(),

    canvasFingerprintHash: (() => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = "#069";
        ctx.fillText("Hello, world!", 2, 2);
        const dataUrl = canvas.toDataURL();
        let hash = 0;
        for (let i = 0; i < dataUrl.length; i++) {
          hash = (hash << 5) - hash + dataUrl.charCodeAt(i);
          hash |= 0;
        }
        return hash;
      } catch (e) {
        return null;
      }
    })(),

    offscreenCanvasSupported: typeof OffscreenCanvas !== "undefined",
    offscreenCanvasFingerprint: await (async () => {
      try {
        const offscreen = new OffscreenCanvas(200, 50);
        const ctx = offscreen.getContext("2d");
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = "#069";
        ctx.fillText("Hello, world!", 2, 2);
        const blob = await offscreen.convertToBlob();
        const reader = new FileReader();
        return await new Promise((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        return null;
      }
    })(),
    canvasVsOffscreenCanvasComparison: await (async () => {
      try {
        const draw = (ctx) => {
          ctx.textBaseline = "top";
          ctx.font = "14px Arial";
          ctx.fillStyle = "#f60";
          ctx.fillRect(0, 0, 100, 100);
          ctx.fillStyle = "#069";
          ctx.fillText("Hello, world!", 2, 2);
        };

        // CanvasRenderingContext2D
        const canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 50;
        draw(canvas.getContext("2d"));
        const canvasDataUrl = canvas.toDataURL();

        // OffscreenCanvasRenderingContext2D
        const offscreen = new OffscreenCanvas(200, 50);
        draw(offscreen.getContext("2d"));
        const blob = await offscreen.convertToBlob();
        const offscreenDataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        return {
          canvasDataUrl,
          offscreenDataUrl,
          match: canvasDataUrl === offscreenDataUrl,
        };
      } catch (e) {
        return { error: e.message };
      }
    })(),
    renderingTests: (() => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext("2d");
        ctx.font = "12px Arial";
        ctx.fillStyle = "#000";
        ctx.fillText("x", 10.5, 10.5); // subpixel rendering
        const data = ctx.getImageData(10, 10, 1, 1).data;
        return {
          pixelAtCenter: Array.from(data),
          alphaUsed: data[3] !== 255, // transparency = possible anti-aliasing
          likelyAntiAliased: data[0] !== 0 || data[1] !== 0 || data[2] !== 0,
        };
      } catch {
        return null;
      }
    })(),

    webgl: (() => {
      try {
        const canvas = document.createElement("canvas");
        const gl =
          canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        const dbg = gl.getExtension("WEBGL_debug_renderer_info");
        return {
          VENDOR: gl.getParameter(gl.VENDOR),
          RENDERER: gl.getParameter(gl.RENDERER),
          UNMASKED_VENDOR_WEBGL: dbg
            ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)
            : null,
          UNMASKED_RENDERER_WEBGL: dbg
            ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
            : null,
          supportedExtensions: gl.getSupportedExtensions(),
          shaderPrecision: {
            vertex: {
              high: getValuesOfObject(
                gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.HIGH_FLOAT)
              ),
              medium: getValuesOfObject(
                gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.MEDIUM_FLOAT)
              ),
              low: getValuesOfObject(
                gl.getShaderPrecisionFormat(gl.VERTEX_SHADER, gl.LOW_FLOAT)
              ),
            },
            fragment: {
              high: getValuesOfObject(
                gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
              ),
              medium: getValuesOfObject(
                gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT)
              ),
              low: getValuesOfObject(
                gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.LOW_FLOAT)
              ),
            },
          },
        };
      } catch (e) {
        return null;
      }
    })(),
    connection: (() => {
      try {
        const conn =
          navigator.connection ||
          navigator.mozConnection ||
          navigator.webkitConnection;
        return conn
          ? {
              downlink: conn.downlink,
              effectiveType: conn.effectiveType,
              rtt: conn.rtt,
              saveData: conn.saveData,
            }
          : null;
      } catch (e) {
        return null;
      }
    })(),

    mediaQueries: {
      prefersColorScheme: window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light",
      forcedColors: window.matchMedia("(forced-colors: active)").matches,
      colorGamut: ["srgb", "p3", "rec2020"].find(
        (gamut) => window.matchMedia(`(color-gamut: ${gamut})`).matches
      ),
    },

    mediaDevices: await navigator.mediaDevices
      ?.enumerateDevices?.()
      .then((devices) => devices.map((d) => ({ kind: d.kind, label: d.label })))
      .catch(() => null),

    battery: await navigator
      .getBattery?.()
      .then((b) => ({
        charging: b.charging,
        chargingTime: b.chargingTime,
        level: b.level,
        dischargingTime: b.dischargingTime,
      }))
      .catch(() => null),

    storageEstimate: await navigator.storage
      ?.estimate?.()
      .then((d) => ({
        quota: d.quota,
        usage: d.usage,
      }))
      .catch(() => null),

    rtcFingerprint: await (async () => {
      try {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel("test");
        const offer = await pc.createOffer();
        pc.close();
        return {
          sdp: offer.sdp?.split("\n").filter((l) => l.includes("candidate")),
        };
      } catch {
        return null;
      }
    })(),
  };
}

// "--no-sandbox", // avoid sandbox restrictions (detectable, but sometimes needed)
// "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
// "--disable-setuid-sandbox", // avoid sandboxing
// "--disable-dev-shm-usage", // use /tmp instead of /dev/shm
// "--disable-blink-features=AutomationControlled", // remove automation-controlled flag
// "--disable-popup-blocking", // allows popups (some CAPTCHAs rely on this)
// "--start-maximized", // mimics real user screen
// "--enable-features=UserAgentClientHint",
// "--no-zygote", // disables forking process (less traceable)
// "--enable-webgl",

(async () => {
  try {
    await Promise.all([
      generateFolderIfNotExisting(waitingPatientsFolderDirectory),
      generateFolderIfNotExisting(generatedPdfsPath),
      generateFolderIfNotExisting(htmlFilesPath),
    ]);

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      userDataDir: process.env.USER_PROFILE_PATH,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--start-maximized", // Open full screen like real users
        "--disable-blink-features=AutomationControlled", // Prevent `navigator.webdriver = true`
        "--disable-infobars", // Hides “Chrome is being controlled”
        "--disable-extensions", // Prevents loading suspicious default extensions
        "--disable-default-apps", // Avoids noise from Chrome's default apps
        "--no-first-run", // Skips Chrome welcome screen
        "--no-service-autorun", // Prevents autorun background tasks
        "--disable-accelerated-2d-canvas", // Stabilizes canvas fingerprint
        "--disable-background-timer-throttling", // Accurate JS timers (bot checks use this)
        "--disable-renderer-backgrounding", // Avoid throttling of background tabs
        "--disable-backgrounding-occluded-windows", // Same as above
        "--disable-dev-shm-usage", // Stability; safe even if not needed
        "--enable-webgl", // WebGL is often checked
      ],
    });

    const collectedPatients = await readJsonFile(
      COLLECTD_PATIENTS_FULL_FILE_PATH,
      true
    );

    const patientsStore = new PatientStore(collectedPatients || []);
    await patientsStore.scheduleAllInitialPatients();

    (async () =>
      await waitForWaitingCountWithInterval({
        collectConfimrdPatient,
        browser,
        patientsStore,
      }))();

    const sendWhatsappMessage = sendMessageUsingWhatsapp(patientsStore);

    patientsStore.on(
      "patientsAdded",
      processSendCollectedPatientsToWhatsapp(sendWhatsappMessage)
    );

    // patientsStore.on("patientAccepted", async (patient) =>
    //   processPatientAcceptanceOrRejection({
    //     browser,
    //     actionType: USER_ACTION_TYPES.ACCEPT,
    //     patient,
    //     patientsStore,
    //     sendWhatsappMessage,
    //   })
    // );

    // patientsStore.on("patientRejected", async (patient) =>
    //   processPatientAcceptanceOrRejection({
    //     browser,
    //     actionType: USER_ACTION_TYPES.REJECT,
    //     patient,
    //     patientsStore,
    //     sendWhatsappMessage,
    //   })
    // );
  } catch (error) {
    console.log("❌ An error occurred in Index.mjs:", error.message);
    console.log("Stack trace in Index.mjs:", error.stack);
    await shutdownAllClients();
  }
})();

// await page.goto(
//   "https://szchenghuang.github.io/react-google-invisible-recaptcha",
//   {
//     waitUntil: "domcontentloaded",
//   }
// );

// Request URL
// https://referralprogram.globemedsaudi.com/referrals/listing
// Request Method
// POST
// Status Code
// {
//     "data": {
//         "pageNumber": 1,
//         "pageSize": 100,
//         "totalNumberOfPages": 1,
//         "totalNumberOfRecords": 1,
//         "hasNext": false,
//         "tableHeaders": [
//             {
//                 "id": "referralDate",
//                 "label": "Referral Date",
//                 "sortingId": "Referraldate"
//             },
//             {
//                 "id": "idReferral",
//                 "label": "GMS Referral Id",
//                 "sortingId": "Id"
//             },
//             {
//                 "id": "ihalatyReference",
//                 "label": "MOH Referral Nb",
//                 "sortingId": "Idihalaty"
//             },
//             {
//                 "id": "adherentName",
//                 "label": "Patient Name",
//                 "sortingId": "IdpatientNavigation.Firstname"
//             },
//             {
//                 "id": "adherentNationalId",
//                 "label": "National ID",
//                 "sortingId": "IdpatientNavigation.Nationalid"
//             },
//             {
//                 "id": "referralType",
//                 "label": "Referral Type",
//                 "sortingId": "IdreferraltypeNavigation.Description"
//             },
//             {
//                 "id": "referralReason",
//                 "label": "Referral Reason",
//                 "sortingId": "IdreferralreasonNavigation.Description"
//             },
//             {
//                 "id": "sourceZone",
//                 "label": "Source Zone",
//                 "sortingId": "SourceproviderNavigation.Providerzone"
//             }
//         ],
//         "result": [
//             {
//                 "idReferral": 350844,
//                 "ihalatyReference": "31950880",
//                 "adherentId": "40562736",
//                 "adherentName": " THANIYAH  ALQAHTANI",
//                 "adherentNationalId": "1060650619",
//                 "referralDate": "2025-06-23T22:28:06",
//                 "referralType": "Emergency",
//                 "referralReason": "Bed Unavailable",
//                 "sourceZone": "Asir",
//                 "sourceProvider": "",
//                 "assignedProvider": "",
//                 "disease": "",
//                 "status": null
//             }
//         ]
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }

// Listen to console logs before any navigation
// page.on("console", (msg) => {
//   for (let i = 0; i < msg.args().length; ++i)
//     msg
//       .args()
//       [i].jsonValue()
//       .then((val) => console.log(`PAGE LOG[${i}]:`, val));
// });

// await page.evaluateOnNewDocument(() => {
//   const suspiciousKeywords = [
//     "puppeteer",
//     "pptr",
//     "pptr:evaluate",
//     "puppeteer_evaluation_script",
//     "_puppeteer_evaluation_script_",
//     "__puppeteer_evaluation_script__",
//     "evaluate",
//     "evaluateHandle",
//     "ExecutionContext",
//     "JSHandle",
//     "DOMWorld",
//     "debugger eval code",
//     "file://",
//     "node_modules",
//     "at Object.eval",
//     "at eval",
//     "internal/process",
//     "internal/modules",
//     "index.mjs",
//     "anonymous",
//     "evaluateOnNewDocument",
//     "waitFor",
//     "processTicksAndRejections",
//     "at Page",
//     "cdp",
//     "callFunctionOn",
//     "sessionId",
//     "async",
//   ];

//   const cleanStack = (stack) =>
//     stack
//       .split("\n")
//       .filter(
//         (line) =>
//           !suspiciousKeywords.some((keyword) =>
//             line.toLowerCase().includes(keyword.toLowerCase())
//           )
//       )
//       .slice(0, 5)
//       .join("\n");

//   // ✨ Patch Error.stack getter
//   const origStack = Object.getOwnPropertyDescriptor(
//     Error.prototype,
//     "stack"
//   );
//   Object.defineProperty(Error.prototype, "stack", {
//     get: function () {
//       try {
//         const raw = origStack?.get?.call(this);
//         return typeof raw === "string" ? cleanStack(raw) : raw;
//       } catch (e) {
//         return origStack?.get?.call(this);
//       }
//     },
//     configurable: true,
//   });

//   function trace() {
//     try {
//       throw new Error("trace");
//     } catch (e) {
//       console.log("Sanitized trace:\n" + cleanStack(e.stack || ""));
//     }
//   }

//   Object.defineProperty(console, "trace", {
//     value: trace,
//     writable: false,
//     configurable: true,
//   });

//   //       Object.defineProperty(console.trace, "toString", {
//   //   value: () => "function trace() { [native code] }",
//   //   writable: false,
//   //   configurable: true,
//   // });

//   Object.defineProperty(console.trace, "toString", {
//     value: Function.prototype.toString.bind(function trace() {}),
//     configurable: true,
//   });

//   Object.defineProperty(console.trace, "name", {
//     value: "trace",
//     configurable: true,
//   });
//   Object.defineProperty(console.trace, "length", {
//     value: 0,
//     configurable: true,
//   });

//   // ✨ Universal toString patcher with WeakSet
//   const origToString = Function.prototype.toString;
//   const maskedFns = new WeakSet();

//   Function.prototype.toString = new Proxy(origToString, {
//     apply(target, thisArg, args) {
//       if (maskedFns.has(thisArg)) {
//         return `function ${thisArg.name || ""}() { [native code] }`;
//       }
//       return Reflect.apply(target, thisArg, args);
//     },
//   });
// });

// await page.emulateTimezone("Africa/Cairo");
// await page.setExtraHTTPHeaders({
//   "Accept-Language": "en-US,en;q=0.9",
// });

// const result = await page.evaluate(collectFingerprint);
// console.log("nromal page checks: ", JSON.stringify(result, null, 2));

// ابحث عن iframe الذي يحتوي على reCAPTCHA
// const frame = page
//   .frames()
//   .find((f) =>
//     f
//       .url()
//       .includes(
//         "https://szchenghuang.github.io/react-google-invisible-recaptcha"
//       )
//   );

// const results = await frame?.evaluate(collectFingerprint);

// console.log(
//   "🔍 reCAPTCHA iframe checks:",
//   JSON.stringify(results, null, 2)
// );

// await page.goto(
//   "https://szchenghuang.github.io/react-google-invisible-recaptcha",
//   {
//     waitUntil: "domcontentloaded",
//   }
// );

// const result = await page.evaluate(collectFingerprint);
// console.log("nromal page checks: ", JSON.stringify(result, null, 2));

// ابحث عن iframe الذي يحتوي على reCAPTCHA
// const frame = page
//   .frames()
//   .find((f) =>
//     f
//       .url()
//       .includes(
//         "https://szchenghuang.github.io/react-google-invisible-recaptcha"
//       )
//   );

// const results = await frame?.evaluate(collectFingerprint);

// console.log(
//   "🔍 reCAPTCHA iframe checks:",
//   JSON.stringify(results, null, 2)
// );

// const formWrappers = await page.$$("#container > div");

// const [first] = formWrappers;

// for (const form of [first]) {
//   const input = await form.$("input");
//   const submit = await form.$("button");

//   if (!input || !submit) continue;

//   cursor.moveTo(
//     [
//       { x: Math.random() * 150, y: Math.random() * 100 },
//       { x: Math.random() * 120, y: Math.random() * 150 },
//       { x: Math.random() * 190, y: Math.random() * 300 },
//       { x: Math.random() * 250, y: Math.random() * 70 },
//     ],
// {
//   moveDelay: 60,
//   randomizeMoveDelay: 10,
// }
//   );

//   // Scroll and wait

//   await sleep(600 + Math.random() * 200);

//   const inputBox = await input.boundingBox();
//   const submitBox = await submit.boundingBox();

//   // Estimate speed: pixels/ms
//   const speed = 0.6; // human range: 0.3–1.2 px/ms

//   const estimatedMoveDelay = Math.max(
//     10,
//     Math.floor(1000 / (speed * distance))
//   );

//   // Random text typing
//   await page.keyboard.type("hello", { delay: 70 });

// await sleep(250 + Math.random());

//   await sleep(1000 + Math.random() * 1000);
// }

// page.on("frameattached", async (frame) => {
//   try {
//     await frame?.evaluateOnNewDocument?.(() => {
//       // // Define chrome object
//       // if (!window.chrome) {
//       //   Object.defineProperty(window, "chrome", {
//       //     value: {},
//       //     configurable: false,
//       //     enumerable: true,
//       //     writable: false,
//       //   });
//       // }

//       // Fake chrome.app
//       const fakeApp = { isInstalled: false };
//       Object.defineProperty(window.chrome, "app", {
//         get: () => fakeApp,
//         configurable: true,
//       });

//       // // Hide chrome.runtime
//       // Object.defineProperty(window.chrome, "runtime", {
//       //   get: () => undefined,
//       //   configurable: true,
//       // });

//       // Spoof utility
//       const spoofNative = (fn, name) => {
//         const nativeStr = `function ${name}() { [native code] }`;

//         Object.defineProperty(fn, "toString", {
//           value: () => nativeStr,
//           writable: false,
//           configurable: true,
//         });

//         Object.defineProperty(fn, "name", {
//           value: name,
//           writable: false,
//           configurable: true,
//         });

//         // Object.defineProperty(fn, "prototype", {
//         //   value: undefined,
//         //   writable: false,
//         //   configurable: true,
//         // });

//         return fn;
//       };

//       // Spoofed WebGL data
//       const spoofed = {
//         webgl: {
//           VENDOR: "WebKit",
//           RENDERER: "WebKit WebGL",
//           UNMASKED_VENDOR_WEBGL: "Google Inc. (Intel)",
//           UNMASKED_RENDERER_WEBGL:
//             "ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x0000A7A0) Direct3D11 vs_5_0 ps_5_0, D3D11)",
//           extensions: [
//             "ANGLE_instanced_arrays",
//             "EXT_blend_minmax",
//             "EXT_clip_control",
//             "EXT_color_buffer_half_float",
//             "EXT_depth_clamp",
//             "EXT_disjoint_timer_query",
//             "EXT_float_blend",
//             "EXT_frag_depth",
//             "EXT_polygon_offset_clamp",
//             "EXT_shader_texture_lod",
//             "EXT_texture_compression_bptc",
//             "EXT_texture_compression_rgtc",
//             "EXT_texture_filter_anisotropic",
//             "EXT_texture_mirror_clamp_to_edge",
//             "EXT_sRGB",
//             "KHR_parallel_shader_compile",
//             "OES_element_index_uint",
//             "OES_fbo_render_mipmap",
//             "OES_standard_derivatives",
//             "OES_texture_float",
//             "OES_texture_float_linear",
//             "OES_texture_half_float",
//             "OES_texture_half_float_linear",
//             "OES_vertex_array_object",
//             "WEBGL_blend_func_extended",
//             "WEBGL_color_buffer_float",
//             "WEBGL_compressed_texture_s3tc",
//             "WEBGL_compressed_texture_s3tc_srgb",
//             "WEBGL_debug_renderer_info",
//             "WEBGL_debug_shaders",
//             "WEBGL_depth_texture",
//             "WEBGL_draw_buffers",
//             "WEBGL_lose_context",
//             "WEBGL_multi_draw",
//             "WEBGL_polygon_mode",
//           ],
//         },
//       };

//       // Patch getParameter
//       const patchGL = (proto) => {
//         const origGetParameter = proto.getParameter;

//         proto.getParameter = spoofNative(function getParameter(param) {
//           try {
//             const dbg = this.getExtension("WEBGL_debug_renderer_info");

//             if (dbg && param === dbg.UNMASKED_VENDOR_WEBGL)
//               return spoofed.webgl.UNMASKED_VENDOR_WEBGL;

//             if (dbg && param === dbg.UNMASKED_RENDERER_WEBGL)
//               return spoofed.webgl.UNMASKED_RENDERER_WEBGL;

//             if (param === this.VENDOR) return spoofed.webgl.VENDOR;
//             if (param === this.RENDERER) return spoofed.webgl.RENDERER;
//           } catch (_) {}

//           return origGetParameter.call(this, param);
//         }, "getParameter");
//       };

//       patchGL(WebGLRenderingContext.prototype);
//       if (typeof WebGL2RenderingContext !== "undefined") {
//         patchGL(WebGL2RenderingContext.prototype);
//       }

//       // Patch getSupportedExtensions
//       WebGLRenderingContext.prototype.getSupportedExtensions = spoofNative(
//         function getSupportedExtensions() {
//           return spoofed.webgl.extensions;
//         },
//         "getSupportedExtensions"
//       );

//       // Clean stack traces
//       const origStack = Object.getOwnPropertyDescriptor(
//         Error.prototype,
//         "stack"
//       );
//       Object.defineProperty(Error.prototype, "stack", {
//         get: function () {
//           return origStack.get
//             .call(this)
//             .split("\n")
//             .filter((l) => !/puppeteer|pptr|node_modules/.test(l))
//             .join("\n");
//         },
//       });
//     });
//   } catch (e) {
//     console.warn("Frame spoofing error:", e);
//   }
// });

// return;

// await page.goto("http://localhost:3000/");

// await page.goto("https://fingerprint.com/products/bot-detection");
// await thirdPage.goto("https://bot.sannysoft.com");

// await sleep(1000);

// 1- chrome://version/
// 2- get fingerprint from the console on new page using getRealBrowserData
// const stealth = StealthPlugin();

// recaptcha siteKey  6Lf-j3ErAAAAAJ1T6AVfBSLfdwweebKCnCoP4_gd
// recaptcha backend siteKey  6Lf-j3ErAAAAAMm0gieSgBwJbPPb4sMU4Vm7FokD

// const { x, y } = await page.evaluate(() => {
//   const rect = document.body.getBoundingClientRect();
//   return { x: rect.left + 10, y: rect.top + 10 };
// });

// const saveActions = runSafe(async () => {
//   await page.mouse.move(x - 20, y - 20, { steps: 10 });
//   await page.mouse.move(x, y, { steps: 10 });
//   await page.mouse.click(x, y);
// });

// await saveActions();
// await sleep(1000);
// return;

//     await page.evaluateOnNewDocument(
//   fs.readFileSync('./applyStealth.js', 'utf8').replace('__FINGERPRINT_JSON__', JSON.stringify(fingerprintData))
// );

// شغل صفحة فارغة أو أي موقع
// await page.goto("about:blank");

// return;

// Add automatic switching between multiple fingerprint profiles
// Add reCAPTCHA v3 score observation
// Add network layer spoofing (e.g., Accept headers, RTT delay, etc.)

// timing
// <div role="presentation" class="MuiSnackbar-root MuiSnackbar-anchorOriginBottomRight css-1ip16uo"><div class="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation6 MuiAlert-root MuiAlert-filledWarning MuiAlert-filled css-cb273i" role="alert" direction="up" style="opacity: 1; transform: none; transition: opacity 225ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms cubic-bezier(0.4, 0, 0.2, 1);"><div class="MuiAlert-icon css-1l54tgj"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeInherit css-1cw4hi4" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="ReportProblemOutlinedIcon"><path d="M12 5.99L19.53 19H4.47L12 5.99M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-6h-2v4h2v-4z"></path></svg></div><div class="MuiAlert-message css-1xsto0d">A waiting period of 15 minutes shall pass before an action can be performed. There is 6 minute(s) and 7 second(s) remaining.</div><div class="MuiAlert-action css-1mzcepu"><button class="MuiButtonBase-root MuiIconButton-root MuiIconButton-colorInherit MuiIconButton-sizeSmall css-q28n79" tabindex="0" type="button" aria-label="Close" title="Close"><svg class="MuiSvgIcon-root MuiSvgIcon-fontSizeSmall css-1k33q06" focusable="false" aria-hidden="true" viewBox="0 0 24 24" data-testid="CloseIcon"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg><span class="MuiTouchRipple-root css-w0pj6f"></span></button></div></div></div>

// for selecting acctepance and rejection
// div role="presentation" id="menu-" class="MuiPopover-root MuiMenu-root MuiModal-root css-1sucic7"><div aria-hidden="true" class="MuiBackdrop-root MuiBackdrop-invisible MuiModal-backdrop css-esi9ax" style="opacity: 1; transition: opacity 225ms cubic-bezier(0.4, 0, 0.2, 1);"></div><div tabindex="0" data-testid="sentinelStart"></div><div class="MuiPaper-root MuiPaper-elevation MuiPaper-rounded MuiPaper-elevation8 MuiPopover-paper MuiMenu-paper MuiMenu-paper css-4v31z5" tabindex="-1" style="opacity: 1; transform: none; min-width: 150px; transition: opacity 229ms cubic-bezier(0.4, 0, 0.2, 1), transform 153ms cubic-bezier(0.4, 0, 0.2, 1); top: 130px; left: 310px; transform-origin: 75px 0px;"><ul class="MuiList-root MuiList-padding MuiMenu-list css-r8u8y9" role="listbox" tabindex="-1" aria-labelledby=":r8:-label" id=":r9:"><li class="MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters MuiMenuItem-root MuiMenuItem-gutters css-i76njs" tabindex="0" role="option" aria-selected="false" data-value="[object Object]">Acceptance<span class="MuiTouchRipple-root css-w0pj6f"></span></li><li class="MuiButtonBase-root MuiMenuItem-root MuiMenuItem-gutters MuiMenuItem-root MuiMenuItem-gutters css-i76njs" tabindex="-1" role="option" aria-selected="false" data-value="[object Object]">Rejection<span class="MuiTouchRipple-root css-w0pj6f"></span></li></ul></div><div tabindex="0" data-testid="sentinelEnd"></div></div>

// called after accept
// Request URL
// {"data":{"isSuccessful":true},"statusCode":"Success","errorMessage":null}
// https://referralprogram.globemedsaudi.com/referrals/accept-referral
// Request Method
// POST
// Status Code
// 200 Ok

// ----------------------
// download attachment
// Request URL
// https://referralprogram.globemedsaudi.com/referrals/download-attachment/3090
// Request Method
// GET
// Status Code
// 200 Ok

// get attachment files
// https://referralprogram.globemedsaudi.com/referrals/attachments
// {
//     "data": [
//         {
//             "idProvider": null,
//             "canAttach": false,
//             "idAttachment": "3090",
//             "fileName": "1122766551.pdf",
//             "fileExtension": 0,
//             "attachmentType": "Medical Report",
//             "attachmentDate": "0001-01-01T00:00:00",
//             "content": null
//         },
//         {
//             "idProvider": null,
//             "canAttach": false,
//             "idAttachment": "3091",
//             "fileName": "__احالة بيبي امل حسن001_.pdf",
//             "fileExtension": 0,
//             "attachmentType": "Medical Report",
//             "attachmentDate": "0001-01-01T00:00:00",
//             "content": null
//         },
//         {
//             "idProvider": "H509821",
//             "canAttach": false,
//             "idAttachment": "3107",
//             "fileName": "350783.pdf",
//             "fileExtension": 0,
//             "attachmentType": "Acceptance",
//             "attachmentDate": "0001-01-01T00:00:00",
//             "content": null
//         }
//     ],
//     "statusCode": "Success",
//     "errorMessage": null
// }

// attachment types
// Request URL
// https://referralprogram.globemedsaudi.com/referrals/attachment-types?languageCode=1
// Request Method
// GET
// Status Code
// 200 OK

// returns
// {
//     "data": [
//         {
//             "id": 14,
//             "code": "14",
//             "languageCode": "1",
//             "description": "Acceptance"
//         },
//         {
//             "id": 21,
//             "code": "21",
//             "languageCode": "1",
//             "description": "Rejection"
//         }
//     ],
//     "statusCode": "Success",
//     "errorMessage": null
// }

// loginpage link https://identityserver.globemedsaudi.com
// https://referralprogram.globemedsaudi.com/referral/details
// after login

// Request URL
// https://referralprogram.globemedsaudi.com/referrals/dashboard-counter
// Request Method
// GET
// Status Code
// 200 OK

// {
//     "data": [
//         {
//             "categoryReference": "pending",
//             "category": "Pending Referrals",
//             "nbReferrals": 0,
//             "icon": "access_time"
//         },
//         {
//             "categoryReference": "accepted",
//             "category": "Accepted Referrals",
//             "nbReferrals": 0,
//             "icon": "done"
//         },
//         {
//             "categoryReference": "confirmed",
//             "category": "Confirmed Referrals",
//             "nbReferrals": 0,
//             "icon": "done_all"
//         },
//         {
//             "categoryReference": "admitted",
//             "category": "Admitted Requests",
//             "nbReferrals": 0,
//             "icon": "local_hospital"
//         },
//         {
//             "categoryReference": "discharged",
//             "category": "Discharged Requests",
//             "nbReferrals": 0,
//             "icon": "exit_to_app"
//         },
//         {
//             "categoryReference": "declined",
//             "category": "Declined Requests",
//             "nbReferrals": 0,
//             "icon": "block"
//         }
//     ],
//     "statusCode": "Success",
//     "errorMessage": null
// }

// Request URL
// https://referralprogram.globemedsaudi.com/referrals/listing
// Request Method
// POST
// Status Code

// {
//     "data": {
//         "pageNumber": 1,
//         "pageSize": 100,
//         "totalNumberOfPages": 0,
//         "totalNumberOfRecords": 0,
//         "hasNext": false,
//         "tableHeaders": [
//             {
//                 "id": "referralDate",
//                 "label": "Referral Date",
//                 "sortingId": "Referraldate"
//             },
//             {
//                 "id": "idReferral",
//                 "label": "GMS Referral Id",
//                 "sortingId": "Id"
//             },
//             {
//                 "id": "ihalatyReference",
//                 "label": "MOH Referral Nb",
//                 "sortingId": "Idihalaty"
//             },
//             {
//                 "id": "adherentName",
//                 "label": "Patient Name",
//                 "sortingId": "IdpatientNavigation.Firstname"
//             },
//             {
//                 "id": "adherentNationalId",
//                 "label": "National ID",
//                 "sortingId": "IdpatientNavigation.Nationalid"
//             },
//             {
//                 "id": "referralType",
//                 "label": "Referral Type",
//                 "sortingId": "IdreferraltypeNavigation.Description"
//             },
//             {
//                 "id": "referralReason",
//                 "label": "Referral Reason",
//                 "sortingId": "IdreferralreasonNavigation.Description"
//             },
//             {
//                 "id": "sourceZone",
//                 "label": "Source Zone",
//                 "sortingId": "SourceproviderNavigation.Providerzone"
//             }
//         ],
//         "result": []
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }

// https://referralprogram.globemedsaudi.com/referrals/listing

// {
//     "data": {
//         "pageNumber": 1,
//         "pageSize": 100,
//         "totalNumberOfPages": 0,
//         "totalNumberOfRecords": 0,
//         "hasNext": false,
//         "tableHeaders": [
//             {
//                 "id": "referralDate",
//                 "label": "Referral Date",
//                 "sortingId": "Referraldate"
//             },
//             {
//                 "id": "idReferral",
//                 "label": "GMS Referral Id",
//                 "sortingId": "Id"
//             },
//             {
//                 "id": "ihalatyReference",
//                 "label": "MOH Referral Nb",
//                 "sortingId": "Idihalaty"
//             },
//             {
//                 "id": "adherentName",
//                 "label": "Patient Name",
//                 "sortingId": "IdpatientNavigation.Firstname"
//             },
//             {
//                 "id": "adherentNationalId",
//                 "label": "National ID",
//                 "sortingId": "IdpatientNavigation.Nationalid"
//             },
//             {
//                 "id": "referralType",
//                 "label": "Referral Type",
//                 "sortingId": "IdreferraltypeNavigation.Description"
//             },
//             {
//                 "id": "referralReason",
//                 "label": "Referral Reason",
//                 "sortingId": "IdreferralreasonNavigation.Description"
//             },
//             {
//                 "id": "sourceZone",
//                 "label": "Source Zone",
//                 "sortingId": "SourceproviderNavigation.Providerzone"
//             }
//         ],
//         "result": []
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
