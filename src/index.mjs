/*
 *
 * Index
 *
 */
import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import https from "node:https";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

import puppeteer from "puppeteer";
import cron from "node-cron";

import PatientStore from "./PatientStore.mjs";
import readJsonFile from "./readJsonFile.mjs";

import waitForWaitingCountWithInterval, {
  continueFetchingPatientsIfPaused,
  pauseFetchingPatients,
} from "./waitForWaitingCountWithInterval.mjs";

import generateFolderIfNotExisting from "./generateFolderIfNotExisting.mjs";

import processSendPatientsToClient from "./processSendPatientsToClient.mjs";
import createAndSendWeeklyReport from "./createAndSendWeeklyReport.mjs";
import handleCaseAcceptanceOrRejection from "./handleCaseAcceptanceOrRejection.mjs";

import {
  waitingPatientsFolderDirectory,
  COLLECTD_PATIENTS_FULL_FILE_PATH,
  USER_ACTION_TYPES,
  htmlFilesPath,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
  screenshotsFolderDirectory,
  generatedSummaryFolderPath,
  TABS_COLLECTION_TYPES,
  APP_URL,
  FAKE_REJECT_PROBE,
} from "./constants.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import checkSiteCodeConfig from "./checkSiteCodeConfig.mjs";
import sleep from "./sleep.mjs";
import installTelegramBotApi from "./installTelegramBotApi.mjs";
import { getCasesWithEmptyClaimStatus } from "./summarizeLogsAfterAcceptance.mjs";
import ensureCaseTimingLogsFile from "./ensureCaseTimingLogsFile.mjs";
import handleSetCaseOutcome from "./handleSetCaseOutcome.mjs";
import { deleteOldCaseFiles } from "./db.mjs";
import startCloudflareTunnel from "./startCloudflareTunnel.mjs";

// import generateAcceptancePdfLetters from "./generatePdfs.mjs";

// https://github.com/FiloSottile/mkcert/releases
// Download mkcert-vX.X.X-windows-amd64.exe
// Rename it to just mkcert.exe.
// mvoed it to C:\Windows\System32
// in powershell as admin i tried mkcert -version
// 1- mkcert -install
// 2- mkdir certs
// 3-  mkcert -key-file certs/key.pem -cert-file certs/cert.pem localhost
// 4- mkcert -key-file certs/referral.key.pem -cert-file certs/referral.cert.pem referralprogram.globemedsaudi.com
// Edit C:\Windows\System32\drivers\etc\hosts as Administrator and add a line:
// notepad opent as admin => file => open => C:\Windows\System32\drivers\etc\ =>
// 127.0.0.1   referralprogram.globemedsaudi.com
// ::1         referralprogram.globemedsaudi.com   # (optional IPv6)

// in power shell as admin => ipconfig /flushdns
// to verify ping referralprogram.globemedsaudi.com // we see 127.0.0.1

// to install clouldflar on windows
// open powershell as admin => winget install Cloudflare.cloudflared

(async () => {
  const {
    CERT_PATH,
    KEY_PATH,
    HOST,
    PORT,
    WEEKLY_REPORT_GENERATED_AT,
    TG_TOKEN,
    CHROME_EXECUTABLE_PATH,
    USER_PROFILE_PATH,
  } = process.env;

  let server;
  let wss;
  let browser;
  let pingInterval;

  let isShuttingDown = false;

  let sendTelegramMessage = null;

  const notifyCrash = async (crashType) => {
    try {
      if (sendTelegramMessage) {
        await sendTelegramMessage(
          `❌ *App crashed* ❌\n` +
            `*crashType:* \`${crashType}\`\n\n` +
            `Please check the app immediately.\n` +
            `Close Unreal browser if running.\n` +
            `Restart the app/server.`,
        );
      }
    } catch (error) {}
  };

  async function shutdown(sig) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    createConsoleMessage(`\n${sig} received. Shutting down...`, "error");

    try {
      clearInterval(pingInterval);
    } catch {}

    // try {
    //   await shutdownAllClients();
    // } catch (e) {
    //   createConsoleMessage(e, "error", "shutdownAllClients failed:");
    // }

    try {
      if (wss) {
        for (const c of wss.clients) {
          try {
            c.terminate();
          } catch {}
        }
        await new Promise((res) => {
          try {
            wss.close(() => res());
          } catch {
            res();
          }
        });
      }
    } catch {}

    try {
      if (browser) await browser.close();
    } catch {}

    try {
      if (server) {
        await new Promise((res) => {
          try {
            server.close(() => res());
          } catch {
            res();
          }
        });
      }
    } catch {}

    const isFatal =
      sig === "unhandledRejection" ||
      sig === "uncaughtException" ||
      sig === "startupCrash";

    process.exit(isFatal ? 1 : 0);
  }

  try {
    // Ensure folders exist
    await Promise.all([
      generateFolderIfNotExisting(screenshotsFolderDirectory),
      generateFolderIfNotExisting(waitingPatientsFolderDirectory),
      generateFolderIfNotExisting(generatedPdfsPathForAcceptance),
      generateFolderIfNotExisting(generatedPdfsPathForRejection),
      generateFolderIfNotExisting(htmlFilesPath),
      generateFolderIfNotExisting(generatedSummaryFolderPath),
      ensureCaseTimingLogsFile(),
      checkSiteCodeConfig(),
    ]);

    const profilePath = `${USER_PROFILE_PATH}/Profile 1`;

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: CHROME_EXECUTABLE_PATH,
      userDataDir: profilePath,
      protocolTimeout: 190_000,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--start-maximized",
        "--disable-background-timer-throttling", // ← don't slow down background tabs
        "--disable-backgrounding-occluded-windows", // ← don't suspend hidden windows
        "--disable-renderer-backgrounding", // ← keep renderer active in background
      ],
    });

    // Restore collected patients, bootstrap store
    const collectedPatients = await readJsonFile(
      COLLECTD_PATIENTS_FULL_FILE_PATH,
      true,
    );

    const nonClaimableCases = await getCasesWithEmptyClaimStatus();

    const patientsStore = new PatientStore(
      collectedPatients || [],
      nonClaimableCases,
    );

    await patientsStore.scheduleAllInitialPatients();

    // sendTelegramMessage = await installTelegramBotApi(
    //   TG_TOKEN,
    //   patientsStore,
    //   browser,
    // );

    sendTelegramMessage = () => Promise.resolve();

    // if (typeof sendTelegramMessage === "function") {
    //   patientsStore.setTelegramMessageSender(sendTelegramMessage);
    // }

    patientsStore.on(
      "patientsAdded",
      processSendPatientsToClient(patientsStore, sendTelegramMessage, false),
    );

    // Background collector
    (async () =>
      await waitForWaitingCountWithInterval({
        collectionTabType: TABS_COLLECTION_TYPES.CONFIRMED,
        browser,
        patientsStore,
        sendTelegramMessage,
      }))();

    // cleanup old case letter files from db
    cron.schedule(
      "0 3 * * *",
      async () => {
        createConsoleMessage("✅ cases letters files cleanup", "info");

        try {
          const result = deleteOldCaseFiles();

          createConsoleMessage(
            `✅ cases letters files cleanup done, ${result.changes} files deleted.`,
            "info",
          );
        } catch (err) {
          createConsoleMessage(
            err.message || err,
            "error",
            "cases letters files cleanup",
          );
        }
      },
      { timezone: "Asia/Riyadh" },
    );

    // weekly Summary cron
    cron.schedule(
      WEEKLY_REPORT_GENERATED_AT,
      async () => {
        createConsoleMessage("✅ Starting weekly report job", "info");
        try {
          await createAndSendWeeklyReport(browser, sendTelegramMessage);
          createConsoleMessage("✅ weekly report job done.", "info");
        } catch (err) {
          createConsoleMessage(
            err.message || err,
            "error",
            "weekly report job Failure",
          );
        }
      },
      { timezone: "Asia/Riyadh" },
    );

    const app = express();
    app.use(express.json());
    app.disable("x-powered-by");
    app.set("trust proxy", 1);
    app.use(
      cors({
        origin: APP_URL,
        methods: ["GET", "POST", "DELETE"],
        allowedHeaders: ["Content-Type"],
      }),
    );

    app.get("/action", async (req, res) => {
      const { referralId, action, token } = req.query;

      console.log({
        referralId,
        action,
        token,
      });

      // if (token !== process.env.ACTION_TOKEN) {
      //   return res.status(403).send("Invalid token");
      // }

      // call your extracted Telegram callback logic here
      // await handleReferralAction({ referralId, action, fromName: "ntfy" });

      res.send(`✅ ${action} received for referral ${referralId}`);
    });

    app.get("/settings", async (req, res) => {
      try {
        return res.status(200).json({
          whatsAppWait: process.env.WAIT_FOR_ACCEPT_MS,
          waitBeforeReady: undefined,
        });
      } catch (err) {
        createConsoleMessage(err, "error", "GET /settings error");
        return res.status(500).json({
          success: false,
          message: "Internal error when getting settings.",
        });
      }
    });

    app.post("/settings", async (req, res) => {
      return res.status(200).json({ success: true });
    });

    app.post("/setCaseOutcome", async (req, res) => {
      try {
        const { success, reason } = await handleSetCaseOutcome({
          ...req.body,
          sendTelegramMessage,
          patientsStore,
        });

        return res.status(200).json({ success: success, reason });
      } catch (err) {
        return res.status(500).json({ success: false });
      }
    });

    // Create HTTPS server
    const cert = fs.readFileSync(CERT_PATH);
    const key = fs.readFileSync(KEY_PATH);
    server = https.createServer({ cert, key }, app);

    // ---------- WebSocket (event-only, no auto-kill) ----------
    wss = new WebSocketServer({ server, perMessageDeflate: false });

    const broadcast = (obj) => {
      const data = JSON.stringify(obj);
      for (const client of wss.clients) {
        if (client.readyState === 1) {
          try {
            client.send(data);
          } catch {}
        }
      }
    };

    wss.on("connection", (ws) => {
      try {
        ws._socket.setKeepAlive(true, 60_000);
      } catch {}

      ws.on("pong", () => {
        /* passive heartbeat; no enforcement */
      });

      ws.on("message", () => {
        /* event-only; no inbound commands */
      });
    });

    // Passive heartbeat to keep intermediaries from idling out
    const HEARTBEAT_MS = 30_000;
    pingInterval = setInterval(() => {
      for (const ws of wss.clients) {
        if (ws.readyState === 1) {
          try {
            ws.ping();
          } catch {}
        }
      }
    }, HEARTBEAT_MS);

    wss.on("close", () => clearInterval(pingInterval));

    patientsStore.on(
      "patientAccepted",
      handleCaseAcceptanceOrRejection({
        browser,
        actionType: USER_ACTION_TYPES.ACCEPT,
        broadcast,
        sendTelegramMessage,
        continueFetchingPatientsIfPaused,
        patientStore: patientsStore,
      }),
    );

    patientsStore.on(
      "patientRejected",
      handleCaseAcceptanceOrRejection({
        browser,
        actionType: USER_ACTION_TYPES.REJECT,
        broadcast,
        sendTelegramMessage,
        continueFetchingPatientsIfPaused,
        patientStore: patientsStore,
      }),
    );

    patientsStore.on(
      FAKE_REJECT_PROBE,
      handleCaseAcceptanceOrRejection({
        browser,
        actionType: FAKE_REJECT_PROBE,
        broadcast,
        sendTelegramMessage,
        continueFetchingPatientsIfPaused,
        patientStore: patientsStore,
      }),
    );

    // ---------- Start ----------
    server.listen(Number(PORT), HOST, () => {
      createConsoleMessage(`HTTPS listening on https://${HOST}:${PORT}`);
      startCloudflareTunnel();
    });

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    // Optional: catch fatals and shut down cleanly
    process.on("unhandledRejection", async (e) => {
      createConsoleMessage(e, "error", "unhandledRejection:");
      await notifyCrash("unhandledRejection");
      await shutdown("unhandledRejection");
    });
    process.on("uncaughtException", async (e) => {
      createConsoleMessage(e, "error", "uncaughtException:");
      await notifyCrash("uncaughtException");
      await shutdown("uncaughtException");
    });
  } catch (error) {
    createConsoleMessage(error, "error", "❌ index.mjs crashed:");
    await notifyCrash("startupCrash");
    await shutdown("startupCrash");
  }
})();

// const browser = await puppeteer.launch({
//   headless: false,
//   defaultViewport: null,
//   executablePath: CHROME_EXECUTABLE_PATH,
//   userDataDir: profilePath,
//   protocolTimeout: 120000,
//   ignoreDefaultArgs: ["--enable-automation"],
//   args: [
//     "--start-maximized", // Open full screen like real users
//     // "--disable-blink-features=AutomationControlled", // Prevent `navigator.webdriver = true`
//     // "--disable-extensions", // Prevents loading suspicious default extensions
//     // "--disable-dev-shm-usage", // Stability; safe even if not needed
//     // "--enable-gpu",
//     // "--use-gl=desktop",
//     // "--enable-webgl", // WebGL is often checked
//     // "--enable-webgl2",

//     // Enhanced stealth args
//     // "--lang=en-US,en",
//     // "--disable-background-timer-throttling",
//     // "--disable-renderer-backgrounding",
//     // "--disable-backgrounding-occluded-windows",
//     // "--no-default-browser-check",
//     // "--disable-infobars", // Hides “Chrome is being controlled”
//     // "--no-first-run", // Skips Chrome welcome screen
//     // "--disable-default-apps", // Avoids noise from Chrome's default apps
//     // "--font-cache-shared", // More consistent font rendering (Windows only)
//     // "--disable-sync",
//     // "--disable-features=TranslateUI",
//     // "--disable-ipc-flooding-protection",
//     // "--no-zygote",
//     // "--disable-site-isolation-trials",
//     // "--disable-back-forward-cache",
//     // "--disable-component-extensions-with-background-pages",
//     // "--disable-prerender-local-predictor",
//     // "--disable-translate",
//   ],
// });

// const _collectedPatients = collectedPatients.map((item, index) => {
//   if (!index) {
//     const _referralEndTimestamp = Date.now() + 1 * 60_000;

//     return {
//       ...item,
//       referralEndTimestamp: _referralEndTimestamp,
//       referralEndDateActionableAtMS: _referralEndTimestamp - 10_000,
//     };
//   }

//   return item;
// });

// import generateAcceptancePdfLetters from "./generatePdfs.mjs";

// const patientsArray = [
//   {
//     nationalId: "1071035784",
//     nationality: "SAUDI",
//     patientName: "اسماء الشاعري",
//     requestDate: "2026-05-22:24:00.000Z",
//     referralId: "377331",
//     specialty: "Radiology Diagnostic",
//     subSpecialty: "Radiology Diagnostic",
//     sourceProvider: "Asir Central Hospital",
//     mobileNumber: "+966552041449",
//     requestedBedType: "Intensive Care Unit (ICU)",
//     __reasonName__: "device unavailable"
//   },
// ];

// await generateAcceptancePdfLetters(browser, patientsArray, true);
// await generateAcceptancePdfLetters(browser, patientsArray, false);
