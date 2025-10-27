/*
 *
 * Index
 *
 */
import dotenv from "dotenv";
dotenv.config();

import fs from "node:fs";
import { unlink, readFile } from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import express from "express";
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
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";

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
  HOME_PAGE_URL,
} from "./constants.mjs";
import speakText from "./speakText.mjs";
import waitUntilCanTakeActionByWindow from "./waitUntilCanTakeActionByWindow.mjs";
import closePageSafely from "./closePageSafely.mjs";

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
    CLIENT_WHATSAPP_NUMBER,
    SUMMARY_REPORT_GENERATED_AT,
    EXECLUDE_WHATSAPP_MSG_FOOTER,
    FIRST_SUMMARY_REPORT_STARTS_AT,
    CERT_PATH,
    KEY_PATH,
    HOST,
    PORT,
  } = process.env;

  let server;
  let wss;
  let browser;
  let pingInterval;

  async function shutdown(sig) {
    console.log(`\n${sig} received. Shutting down...`);

    try {
      clearInterval(pingInterval);
    } catch {}

    try {
      await shutdownAllClients();
    } catch (e) {
      console.error("shutdownAllClients failed:", e?.message || e);
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

  async function pdfToBase64(filePath) {
    const buf = await readFile(filePath);
    return buf.toString("base64");
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
    ]);

    // Launch browser with a fixed profile
    const profilePath = `${USER_PROFILE_PATH}/${currentProfile}`;
    console.log("Using profile", profilePath);

    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: CHROME_EXECUTABLE_PATH,
      userDataDir: profilePath,
      protocolTimeout: 120000,
      ignoreDefaultArgs: ["--enable-automation"],
      args: ["--start-maximized"],
    });

    // Restore collected patients, bootstrap store
    const collectedPatients = await readJsonFile(
      COLLECTD_PATIENTS_FULL_FILE_PATH,
      true
    );

    const patientsStore = new PatientStore(
      collectedPatients || [],
      pauseFetchingPatients
    );

    await patientsStore.scheduleAllInitialPatients();

    // WhatsApp client + outbound integration
    await initializeClient(CLIENT_WHATSAPP_NUMBER, patientsStore);
    const sendWhatsappMessage = sendMessageUsingWhatsapp(patientsStore);

    patientsStore.on(
      "patientsAdded",
      processSendCollectedPatientsToWhatsapp(
        sendWhatsappMessage,
        EXECLUDE_WHATSAPP_MSG_FOOTER === "Y"
      )
    );

    // Background collector
    (async () =>
      await waitForWaitingCountWithInterval({
        collectionTabType: TABS_COLLECTION_TYPES.WAITING,
        browser,
        patientsStore,
        sendWhatsappMessage,
      }))();

    // Summary cron
    cron.schedule(
      SUMMARY_REPORT_GENERATED_AT,
      async () => {
        console.log("[CRON] Summary job at", new Date().toISOString());
        try {
          await processCollectReferralSummary(
            browser,
            sendWhatsappMessage,
            FIRST_SUMMARY_REPORT_STARTS_AT
          );
          console.log("[CRON] Summary job done.");
        } catch (err) {
          console.error("[CRON] Summary job failed:", err.message);
        }
      },
      { timezone: "Asia/Riyadh" }
    );

    // ---------- HTTPS + Express (DELETE only) ----------
    const app = express();
    app.use(express.json());
    // app.disable("x-powered-by");
    app.set("trust proxy", 1);

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
          `${USER_ACTION_TYPES.ACCEPT}-${referralId}.pdf`
        );
        const rejectionFilePath = path.join(
          generatedPdfsPathForRejection,
          `${USER_ACTION_TYPES.REJECT}-${referralId}.pdf`
        );

        await Promise.allSettled([
          checkPathExists(acceptanceFilePath).then(
            (exists) => exists && unlink(acceptanceFilePath)
          ),
          checkPathExists(rejectionFilePath).then(
            (exists) => exists && unlink(rejectionFilePath)
          ),
        ]);

        const result = await patientsStore.removePatientByReferralId(
          referralId
        );

        continueFetchingPatientsIfPaused();
        return res.status(result.success ? 200 : 404).json(result);
      } catch (err) {
        console.error("DELETE /patients/:referralId error", err);
        return res
          .status(500)
          .json({ success: false, message: "Internal error." });
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

    // Broadcast only when timers fire
    patientsStore.on("patientAccepted", async (patient) => {
      try {
        const { referralId, referralEndTimestamp } = patient;
        const acceptanceFilePath = path.join(
          generatedPdfsPathForAcceptance,
          `${USER_ACTION_TYPES.ACCEPT}-${referralId}.pdf`
        );

        try {
          const filebase64 = await pdfToBase64(acceptanceFilePath);
          broadcast({
            type: "accept",
            data: {
              referralId,
              attachmentTypeOptionText: "Acceptance",
              acceptanceFileBase64: filebase64,
              referralEndTimestamp,
            },
          });
        } catch (error) {
          console.log(
            `patientAccepted broadcast failed referralId=${referralId}:`,
            error
          );
        }

        console.log(`patientAccepted broadcast done referralId=${referralId}`);

        const [page] = await makeUserLoggedInOrOpenHomePage({
          browser,
          sendWhatsappMessage,
          startingPageUrl: HOME_PAGE_URL,
          noCursor: true,
        });

        const remainingMs = referralEndTimestamp - Date.now();

        const isOk = await waitUntilCanTakeActionByWindow({
          page,
          idReferral: referralId,
          remainingMs,
        });

        if (isOk) {
          speakText({
            text: `ACCEPT ACCEPT`,
            delayMs: 0,
            times: 1,
            rate: 2,
            useMaleVoice: true,
            volume: 100,
          });
          await closePageSafely(page);
          continueFetchingPatientsIfPaused();
        }
      } catch (err) {
        console.error("patientAccepted broadcast failed:", err?.message || err);
      }
    });

    // patientsStore.on("patientRejected", (patient) => {
    //   broadcast({ type: "reject", data: patient });
    // });

    // ---------- Start ----------
    server.listen(Number(PORT), HOST, () => {
      console.log(`HTTPS listening on https://${HOST}:${PORT}`);
      console.log(`DELETE: https://${HOST}:${PORT}/patients/:referralId`);
    });

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });
    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });

    // Optional: catch fatals and shut down cleanly
    process.on("unhandledRejection", (e) => {
      console.error("unhandledRejection:", e);
      void shutdown("SIGINT");
    });
    process.on("uncaughtException", (e) => {
      console.error("uncaughtException:", e);
      void shutdown("SIGINT");
    });
  } catch (error) {
    console.error("❌ index.mjs crashed:", error);
    await shutdown("SIGINT");
  }
})();

// const profiles = [
//   "Profile 4",
//   "Profile 5",
//   "Profile 6",
//   "Profile 7",
//   "Profile 8",
//   "Profile 9",
//   "Profile 10",
//   "Profile 11",
//   "Profile 12",
// ];

// Rotate randomly
// const currentProfile = profiles[Math.floor(Math.random() * profiles.length)];
// console.log("Using profile", profilePath);

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
// console.time("search");
// await searchForItemCountAndClickItIfFound(
//   page,
//   "Confirmed Referrals",
//   true
// );
// console.timeEnd("search");

// const minReferralEndTimestamp = referralEndTimestamp - 120;
// const delay = Math.max(0, minReferralEndTimestamp - Date.now());

// if (delay > 0) {
//   await sleep(delay);
// }

// import generateAcceptancePdfLetters from "./generatePdfs.mjs";

// const patientsArray = [
//   {
//     nationalId: "123456789",
//     nationality: "SAUDI",
//     patientName: "John Doe",
//     requestDate: "2023-01-01T00:00:00.000Z",
//     referralId: "ADC12521",
//     specialty: "ICDS",
//     subSpecialty: "ICDS",
//     sourceProvider: "Al-Zahraa Hospital",
//     mobileNumber: "1234567890",
//     requestedBedType: "Ward",
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

// const twilioClient = twilio(
//   process.env.TWILIO_ACCOUNT_SID,
//   process.env.TWILIO_AUTH_TOKEN
// );

// const numbers = await twilioClient.incomingPhoneNumbers.list();
// console.log("numbers", numbers);

// const createCall = async () => {
//   const call = await twilioClient.calls.create({
//     from: "+15076775062",
//     to: "+966569157706", // Saudi number in international format
//     url: "https://twimlets.com/message?Message%5B0%5D=A%20new%20patient%20has%20been%20received.%20Please%20check%20WhatsApp.",
//   });

//   console.log("Call initiated:", call.sid);
// };

// import processClientActionOnPatient from "./processClientActionOnPatient.mjs";
// patientsStore.on("patientAccepted", async (patient) =>
//   processClientActionOnPatient({
//     browser,
//     actionType: USER_ACTION_TYPES.ACCEPT,
//     patient,
//     patientsStore,
//     sendWhatsappMessage,
//     continueFetchingPatientsIfPaused,
//   })
// );

// patientsStore.on("patientRejected", async (patient) =>
//   processClientActionOnPatient({
//     browser,
//     actionType: USER_ACTION_TYPES.REJECT,
//     patient,
//     patientsStore,
//     sendWhatsappMessage,
//     continueFetchingPatientsIfPaused,
//   })
// );
