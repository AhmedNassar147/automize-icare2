/*
 *
 * Index
 *
 */
import dotenv from "dotenv";
dotenv.config();

import puppeteer from "puppeteer";
// import pkg from "ghost-cursor";
import cron from "node-cron";
// import twilio from "twilio";
import PatientStore from "./PatientStore.mjs";
import waitForWaitingCountWithInterval, {
  continueFetchingPatientsIfPaused,
  pauseFetchingPatients,
} from "./waitForWaitingCountWithInterval.mjs";
import generateFolderIfNotExisting from "./generateFolderIfNotExisting.mjs";
import readJsonFile from "./readJsonFile.mjs";
import sendMessageUsingWhatsapp, {
  shutdownAllClients,
  initializeClient,
} from "./sendMessageUsingWhatsapp.mjs";
import processSendCollectedPatientsToWhatsapp from "./processSendCollectedPatientsToWhatsapp.mjs";
import processClientActionOnPatient from "./processClientActionOnPatient.mjs";
import processCollectReferralSummary from "./processCollectReferralSummary.mjs";
import increaseDetailsPageScore from "./increaseDetailsPageScore.mjs";
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

// import sleep from "./sleep.mjs";
// import fuckThem from "./fuckThem.mjs";

// const { createCursor, installMouseHelper } = pkg;

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

// puppeteer.use(StealthPlugin());

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

// "--disable-accelerated-2d-canvas", // Stabilizes canvas fingerprint
// "--disable-background-timer-throttling", // Accurate JS timers (bot checks use this)
// "--disable-renderer-backgrounding", // Avoid throttling of background tabs
// "--disable-backgrounding-occluded-windows", // Same as above
// "--restore-last-session=false",
// "--renderer-process-limit=1",
// "--disable-prompt-on-repost",

(async () => {
  try {
    await Promise.all([
      generateFolderIfNotExisting(screenshotsFolderDirectory),
      generateFolderIfNotExisting(waitingPatientsFolderDirectory),
      generateFolderIfNotExisting(generatedPdfsPathForAcceptance),
      generateFolderIfNotExisting(generatedPdfsPathForRejection),
      generateFolderIfNotExisting(htmlFilesPath),
      generateFolderIfNotExisting(generatedSummaryFolderPath),
    ]);

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: process.env.CHROME_EXECUTABLE_PATH,
      userDataDir: process.env.USER_PROFILE_PATH,
      protocolTimeout: 120000,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--start-maximized", // Open full screen like real users
        "--disable-blink-features=AutomationControlled", // Prevent `navigator.webdriver = true`
        "--disable-infobars", // Hides “Chrome is being controlled”
        "--disable-extensions", // Prevents loading suspicious default extensions
        "--disable-default-apps", // Avoids noise from Chrome's default apps
        "--no-first-run", // Skips Chrome welcome screen
        // "--no-service-autorun", // Prevents autorun background tasks
        "--disable-dev-shm-usage", // Stability; safe even if not needed
        "--disable-sync",
        "--no-default-browser-check",
        "--font-cache-shared", // More consistent font rendering (Windows only)
        "--enable-gpu",
        "--use-gl=desktop",
        "--enable-webgl", // WebGL is often checked
        "--enable-webgl2",
        "--lang=en-US,en",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
        "--disable-backgrounding-occluded-windows",
      ],
    });

    const collectedPatients = await readJsonFile(
      COLLECTD_PATIENTS_FULL_FILE_PATH,
      true
    );

    const patientsStore = new PatientStore(
      collectedPatients || [],
      pauseFetchingPatients
    );
    await patientsStore.scheduleAllInitialPatients();

    await initializeClient(process.env.CLIENT_WHATSAPP_NUMBER, patientsStore);

    const sendWhatsappMessage = sendMessageUsingWhatsapp(patientsStore);

    (async () =>
      await waitForWaitingCountWithInterval({
        collectionTabType: TABS_COLLECTION_TYPES.WAITING,
        browser,
        patientsStore,
        sendWhatsappMessage,
      }))();

    cron.schedule(
      // "59 23 * * 1",
      process.env.SUMMARY_REPORT_GENERATED_AT,
      async () => {
        console.log(
          "[CRON] Starting referral summary job at",
          new Date().toISOString()
        );
        try {
          await processCollectReferralSummary(browser, sendWhatsappMessage);
          console.log("[CRON] Referral summary job completed successfully.");
        } catch (err) {
          console.error("[CRON] Referral summary job failed:", err.message);
        }
      },
      {
        timezone: "Asia/Riyadh",
      }
    );

    patientsStore.on(
      "scoreTourStarted",
      async () =>
        await increaseDetailsPageScore(
          browser,
          pauseFetchingPatients,
          continueFetchingPatientsIfPaused,
          () => patientsStore.endScoreTour()
        )
    );

    patientsStore.on(
      "patientsAdded",
      processSendCollectedPatientsToWhatsapp(sendWhatsappMessage)
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

    patientsStore.on("patientRejected", async (patient) =>
      processClientActionOnPatient({
        browser,
        actionType: USER_ACTION_TYPES.REJECT,
        patient,
        patientsStore,
        sendWhatsappMessage,
        continueFetchingPatientsIfPaused,
      })
    );
  } catch (error) {
    console.log("❌ An error occurred in Index.mjs:", error.message);
    console.log("Stack trace in Index.mjs:", error.stack);
    await shutdownAllClients();
  }
})();

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
