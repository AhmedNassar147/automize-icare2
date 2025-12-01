/*
 *
 * Index
 *
 */
import dotenv from "dotenv";
dotenv.config();

import puppeteer from "puppeteer";
import cron from "node-cron";

import PatientStore from "./PatientStore.mjs";
import readJsonFile from "./readJsonFile.mjs";

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
import processClientActionOnPatient from "./processClientActionOnPatient.mjs";

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
} from "./constants.mjs";
// import waitUntilCanTakeActionByWindow from "./waitUntilCanTakeActionByWindow.mjs";
// import closePageSafely from "./closePageSafely.mjs";
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
    CLIENT_WHATSAPP_NUMBER,
    SUMMARY_REPORT_GENERATED_AT,
    EXECLUDE_WHATSAPP_MSG_FOOTER,
    FIRST_SUMMARY_REPORT_STARTS_AT,
    SUMMARY_REPORT_ENDS_AT,
    HOST,
    PORT,
  } = process.env;

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
      if (browser) await browser.close();
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
      args: [
        "--start-maximized", // Open full screen like real users
        "--disable-blink-features=AutomationControlled", // Prevent `navigator.webdriver = true`
        "--disable-extensions", // Prevents loading suspicious default extensions
        "--disable-dev-shm-usage", // Stability; safe even if not needed
        "--enable-gpu",
        "--use-gl=desktop",
        "--enable-webgl", // WebGL is often checked
        "--enable-webgl2",
        "--disable-backgrounding-occluded-windows",
        "--no-default-browser-check",
        "--disable-infobars",
        "--no-first-run",
        "--disable-default-apps",
        "--font-cache-shared",
        "--disable-sync",
      ],
    });

    // Restore collected patients, bootstrap store
    const collectedPatients = await readJsonFile(
      COLLECTD_PATIENTS_FULL_FILE_PATH,
      true
    );

    //     const _collectedPatients = collectedPatients.map((item, index) => {
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
            FIRST_SUMMARY_REPORT_STARTS_AT,
            SUMMARY_REPORT_ENDS_AT
          );
          console.log("[CRON] Summary job done.");
        } catch (err) {
          console.error("[CRON] Summary job failed:", err.message);
        }
      },
      { timezone: "Asia/Riyadh" }
    );

    patientsStore.on("patientAccepted", async (patient) =>
      processClientActionOnPatient({
        browser,
        actionType: USER_ACTION_TYPES.ACCEPT,
        patient,
        patientsStore,
        sendWhatsappMessage,
        continueFetchingPatientsIfPaused,
      })
    );

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
