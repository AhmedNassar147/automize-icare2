/*
 *
 * Index
 *
 */
import dotenv from "dotenv";
dotenv.config();

// import puppeteer from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
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

puppeteer.use(StealthPlugin());

const profiles = [
  "Profile 4",
  "Profile 5",
  "Profile 6",
  "Profile 7",
  "Profile 8",
  "Profile 9",
];

// Rotate randomly
const currentProfile = profiles[Math.floor(Math.random() * profiles.length)];

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

(async () => {
  const {
    CHROME_EXECUTABLE_PATH,
    USER_PROFILE_PATH,
    CLIENT_WHATSAPP_NUMBER,
    SUMMARY_REPORT_GENERATED_AT,
    EXECLUDE_WHATSAPP_MSG_FOOTER,
    FIRST_SUMMARY_REPORT_STARTS_AT,
  } = process.env;

  try {
    await Promise.all([
      generateFolderIfNotExisting(screenshotsFolderDirectory),
      generateFolderIfNotExisting(waitingPatientsFolderDirectory),
      generateFolderIfNotExisting(generatedPdfsPathForAcceptance),
      generateFolderIfNotExisting(generatedPdfsPathForRejection),
      generateFolderIfNotExisting(htmlFilesPath),
      generateFolderIfNotExisting(generatedSummaryFolderPath),
    ]);

    const profilePath = `${USER_PROFILE_PATH}/${currentProfile}`;

    console.log("Using profile", profilePath);

    const browser = await puppeteer.launch({
      headless: false,
      defaultViewport: null,
      executablePath: CHROME_EXECUTABLE_PATH,
      userDataDir: profilePath,
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

        // Enhanced stealth args
        "--disable-features=TranslateUI",
        "--disable-ipc-flooding-protection",
        "--no-zygote",
        "--disable-site-isolation-trials",
        "--disable-back-forward-cache",
        "--disable-component-extensions-with-background-pages",
        "--disable-prerender-local-predictor",
        "--disable-translate",
      ],
    });

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

    const collectedPatients = await readJsonFile(
      COLLECTD_PATIENTS_FULL_FILE_PATH,
      true
    );

    const patientsStore = new PatientStore(
      collectedPatients || [],
      pauseFetchingPatients
    );
    await patientsStore.scheduleAllInitialPatients();

    await initializeClient(CLIENT_WHATSAPP_NUMBER, patientsStore);

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
      SUMMARY_REPORT_GENERATED_AT,
      async () => {
        console.log(
          "[CRON] Starting referral summary job at",
          new Date().toISOString()
        );
        try {
          await processCollectReferralSummary(
            browser,
            sendWhatsappMessage,
            FIRST_SUMMARY_REPORT_STARTS_AT
          );
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
      processSendCollectedPatientsToWhatsapp(
        sendWhatsappMessage,
        EXECLUDE_WHATSAPP_MSG_FOOTER === "Y"
      )
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
