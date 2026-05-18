/*
 *
 * Index
 *
 */
import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";

import puppeteer from "puppeteer";
import cron from "node-cron";

import PatientStore from "./PatientStore.mjs";
import readJsonFile from "./readJsonFile.mjs";
import checkPathExists from "./checkPathExists.mjs";

import waitForWaitingCountWithInterval, {
  continueFetchingPatientsIfPaused,
  pauseFetchingPatients,
} from "./waitForWaitingCountWithInterval.mjs";

import generateFolderIfNotExisting from "./generateFolderIfNotExisting.mjs";

import sendMessageUsingWhatsapp, {
  shutdownAllClients,
  initializeClient,
} from "./sendMessageUsingWhatsapp.mjs";
import processSendCollectedPatientsToWhatsapp from "./processSendCollectedPatientsToWhatsapp.mjs";
import processCollectReferralSummary from "./processCollectReferralSummary.mjs";
import processCollectReferralWeeklySummary from "./processCollectReferralWeeklySummary.mjs";
import processCollectRefferalMonthlySummary from "./processCollectRefferalMonthlySummary.mjs";
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
  casesTimingLogsFolderPath,
  TABS_COLLECTION_TYPES,
  APP_URL,
} from "./constants.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import checkSiteCodeConfig from "./checkSiteCodeConfig.mjs";
import sleep from "./sleep.mjs";
import updateEnvFile from "./updateEnvFile.mjs";
import sendRefferalsToWhatsAppAsExcel from "./sendRefferalsToWhatsAppAsExcel.mjs";
import installTelegramBotApi from "./installTelegramBotApi.mjs";
import { updateCaseInLog } from "./summarizeLogsAfterAcceptance.mjs";
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

const currentProfile = "Profile 1";

(async () => {
  const {
    CHROME_EXECUTABLE_PATH,
    USER_PROFILE_PATH,
    SUMMARY_REPORT_GENERATED_AT,
    EXECLUDE_WHATSAPP_MSG_FOOTER,
    FIRST_SUMMARY_REPORT_STARTS_AT,
    SUMMARY_REPORT_ENDS_AT,
    CERT_PATH,
    KEY_PATH,
    HOST,
    PORT,
    WEEKLY_REPORT_GENERATED_AT,
    MONTHLY_REPORT_GENERATED_AT,
    DETAILED_REPORT_GENERATED_AT,
    RESEND_PATIENT_SUMMARY_FILE_PATH,
    TG_TOKEN,
  } = process.env;

  let server;
  let wss;
  let browser;
  let pingInterval;

  async function shutdown(sig) {
    createConsoleMessage(`\n${sig} received. Shutting down...`, "info");

    try {
      clearInterval(pingInterval);
    } catch {}

    try {
      await shutdownAllClients();
    } catch (e) {
      createConsoleMessage(e, "error", "shutdownAllClients failed:");
    }

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

    process.exit(0);
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
      generateFolderIfNotExisting(casesTimingLogsFolderPath),
      checkSiteCodeConfig(),
    ]);

    // Launch browser with a fixed profile
    const profilePath = `${USER_PROFILE_PATH}/${currentProfile}`;

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: CHROME_EXECUTABLE_PATH,
      userDataDir: profilePath,
      protocolTimeout: 180000,
      ignoreDefaultArgs: ["--enable-automation"],
      args: ["--start-maximized"],
    });

    // Restore collected patients, bootstrap store
    const collectedPatients = await readJsonFile(
      COLLECTD_PATIENTS_FULL_FILE_PATH,
      true,
    );

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

    const patientsStore = new PatientStore(
      collectedPatients || [],
      pauseFetchingPatients,
    );

    await patientsStore.scheduleAllInitialPatients();

    const sendTelegramMessage = await installTelegramBotApi(
      TG_TOKEN,
      patientsStore,
    );

    // WhatsApp client + outbound integration
    await initializeClient(patientsStore);

    const sendWhatsappMessage = sendMessageUsingWhatsapp(patientsStore);

    patientsStore.on(
      "patientsAdded",
      processSendCollectedPatientsToWhatsapp(
        sendWhatsappMessage,
        sendTelegramMessage,
        EXECLUDE_WHATSAPP_MSG_FOOTER === "Y",
      ),
    );

    // Background collector
    (async () =>
      await waitForWaitingCountWithInterval({
        collectionTabType: TABS_COLLECTION_TYPES.WAITING,
        browser,
        patientsStore,
        sendWhatsappMessage,
        sendTelegramMessage,
      }))();

    if (RESEND_PATIENT_SUMMARY_FILE_PATH) {
      await sleep(10_000); // delay to ensure everything is up before sending
      await sendRefferalsToWhatsAppAsExcel(
        sendWhatsappMessage,
        sendTelegramMessage,
        RESEND_PATIENT_SUMMARY_FILE_PATH,
      );
    }

    // Summary cron
    cron.schedule(
      SUMMARY_REPORT_GENERATED_AT,
      async () => {
        createConsoleMessage("✅ Starting [CRON] Summary job", "info");
        try {
          await processCollectReferralSummary(
            browser,
            sendWhatsappMessage,
            sendTelegramMessage,
            FIRST_SUMMARY_REPORT_STARTS_AT,
            SUMMARY_REPORT_ENDS_AT,
          );
          createConsoleMessage("✅ [CRON] Summary job done.", "info");
        } catch (err) {
          createConsoleMessage(
            err.message || err,
            "error",
            "[CRON] Summary job Failure",
          );
        }
      },
      { timezone: "Asia/Riyadh" },
    );

    // Summary cron
    cron.schedule(
      WEEKLY_REPORT_GENERATED_AT,
      async () => {
        createConsoleMessage("✅ Starting weekly report job", "info");
        try {
          await processCollectReferralWeeklySummary(
            browser,
            sendWhatsappMessage,
            sendTelegramMessage,
          );
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

    if (DETAILED_REPORT_GENERATED_AT) {
      cron.schedule(
        DETAILED_REPORT_GENERATED_AT,
        async () => {
          createConsoleMessage(
            "✅ Starting monthly detailed report job",
            "info",
          );
          try {
            await processCollectReferralWeeklySummary(
              browser,
              sendWhatsappMessage,
              sendTelegramMessage,
              true,
            );
            createConsoleMessage(
              "✅ monthly detailed report job done.",
              "info",
            );
          } catch (err) {
            createConsoleMessage(
              err.message || err,
              "error",
              "monthly detailed report job Failure",
            );
          }
        },
        { timezone: "Asia/Riyadh" },
      );
    }

    // Summary cron
    if (MONTHLY_REPORT_GENERATED_AT) {
      cron.schedule(
        MONTHLY_REPORT_GENERATED_AT,
        async () => {
          createConsoleMessage("✅ Starting monthly report job", "info");
          try {
            await processCollectRefferalMonthlySummary(
              browser,
              sendWhatsappMessage,
              sendTelegramMessage,
            );
            createConsoleMessage("✅ monthly report job done.", "info");
          } catch (err) {
            createConsoleMessage(
              err.message || err,
              "error",
              "monthly report job Failure",
            );
          }
        },
        { timezone: "Asia/Riyadh" },
      );
    }

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

    app.delete("/patients/:referralId", async (req, res) => {
      try {
        const { referralId } = req.params || {};
        if (!referralId) {
          return res
            .status(400)
            .json({ success: false, message: "Missing referralId." });
        }

        // Delete generated PDFs if present
        const acceptanceFilePath = path.join(
          generatedPdfsPathForAcceptance,
          `${USER_ACTION_TYPES.ACCEPT}-${referralId}.pdf`,
        );
        const rejectionFilePath = path.join(
          generatedPdfsPathForRejection,
          `${USER_ACTION_TYPES.REJECT}-${referralId}.pdf`,
        );

        await Promise.allSettled([
          checkPathExists(acceptanceFilePath).then(
            (exists) => exists && unlink(acceptanceFilePath),
          ),
          checkPathExists(rejectionFilePath).then(
            (exists) => exists && unlink(rejectionFilePath),
          ),
        ]);

        const result =
          await patientsStore.removePatientByReferralId(referralId);

        continueFetchingPatientsIfPaused();
        return res.status(result.success ? 200 : 404).json(result);
      } catch (err) {
        createConsoleMessage(
          err,
          "error",
          "DELETE /patients/:referralId error",
        );
        return res
          .status(500)
          .json({ success: false, message: "Internal error." });
      }
    });

    app.get("/settings", async (req, res) => {
      try {
        const [timeMsString] = (
          process.env.NEW_WAITING_TIME_FOR_PATIENT || ""
        ).split(",");

        const waitBeforeReady = timeMsString || 0;

        const result = {
          whatsAppWait: process.env.WAIT_FOR_ACCEPT_MS,
          waitBeforeReady: waitBeforeReady ? waitBeforeReady : undefined,
        };

        return res.status(200).json(result);
      } catch (err) {
        createConsoleMessage(err, "error", "GET /settings error");
        return res.status(500).json({
          success: false,
          message: "Internal error when getting settings.",
        });
      }
    });

    app.post("/settings", async (req, res) => {
      try {
        const { whatsAppWait, waitBeforeReady } = req.body;

        const updates = {};

        if (whatsAppWait) {
          updates.WAIT_FOR_ACCEPT_MS = whatsAppWait ? +whatsAppWait : 2000;
        }

        if (waitBeforeReady) {
          updates.NEW_WAITING_TIME_FOR_PATIENT = String(waitBeforeReady);
        }

        updateEnvFile(updates);

        return res.status(200).json({ success: true });
      } catch (err) {
        return res.status(500).json({ success: false });
      }
    });

    app.post("/setCaseOutcome", async (req, res) => {
      try {
        const { elapsedMs, clickedAt } = req.body;

        const outcome =
          elapsedMs <= 780
            ? "need-less-wait"
            : elapsedMs <= 850
              ? "moderate-waiting"
              : elapsedMs <= 950
                ? "good-waiting"
                : elapsedMs <= 1100
                  ? "need-more-wait"
                  : elapsedMs < Number(process.env.BLOCK_TIME_MS) - 1
                    ? "near-to-block"
                    : "blocked";

        const firstGoindToAccept = patientsStore.getFirstGoingToAccept();

        const {
          referralId,
          referralEndTimestamp,
          readySeenAtLocalMs,
          waitTime,
        } = firstGoindToAccept || {};

        createConsoleMessage(
          `caseId=${referralId} case-outcome=${outcome} clickedAt=${clickedAt} elapsed=${elapsedMs}ms readySeenAtLocalMs=${readySeenAtLocalMs} waitTime=${waitTime}ms`,
          "info",
        );

        if (firstGoindToAccept) {
          await updateCaseInLog(referralId, referralEndTimestamp, {
            status: `${outcome}_${elapsedMs}`,
            clickedAt,
            tookMS: clickedAt - readySeenAtLocalMs - (waitTime || 0),
          });
        }

        return res.status(200).json({ success: true });
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
        sendWhatsappMessage,
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
        sendWhatsappMessage,
        sendTelegramMessage,
        continueFetchingPatientsIfPaused,
        patientStore: patientsStore,
      }),
    );

    // ---------- Start ----------
    server.listen(Number(PORT), HOST, () => {
      createConsoleMessage(`HTTPS listening on https://${HOST}:${PORT}`);
    });

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    // Optional: catch fatals and shut down cleanly
    process.on("unhandledRejection", (e) => {
      createConsoleMessage(e, "error", "unhandledRejection:");
      void shutdown("SIGINT");
    });
    process.on("uncaughtException", (e) => {
      createConsoleMessage(e, "error", "uncaughtException:");
      void shutdown("SIGINT");
    });
  } catch (error) {
    createConsoleMessage(error, "error", "❌ index.mjs crashed:");
    await shutdown("SIGINT");
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

// import searchForItemCountAndClickItIfFound from "./searchForItemCountAndClickItIfFound.mjs";
// await searchForItemCountAndClickItIfFound(
//   page,
//   "Confirmed Referrals",
//   true
// );

// const minReferralEndTimestamp = referralEndTimestamp - 120;
// const delay = Math.max(0, minReferralEndTimestamp - Date.now());

// if (delay > 0) {
//   await sleep(delay);
// }

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

// return;

// https://referralprogram.globemedsaudi.com/referrals/attachment-types?languageCode=1
//     {
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
