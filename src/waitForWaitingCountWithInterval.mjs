import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import processCollectingPatients from "./processCollectingPatients.mjs";
import closePageSafely from "./closePageSafely.mjs";
import sleep from "./sleep.mjs";
import {
  pauseController,
  pause,
  continueIfPaused,
} from "./PauseController.mjs";
import {
  globMedHeaders,
  PATIENT_SECTIONS_STATUS,
  TABS_COLLECTION_TYPES,
  baseGlobMedAPiUrl,
} from "./constants.mjs";

const INTERVAL = 70_000;
const NOT_LOGGED_SLEEP_TIME = 25_000;
const LOCKED_OUT_SLEEP_TIME = 4 * 10 * 60_000;

const pausableSleep = async (ms) => {
  await pauseController.waitIfPaused();
  await sleep(ms);
};

const apiUrl = `${baseGlobMedAPiUrl}/listing`;

const reloadAndCheckIfShouldCreateNewPage = async (page, logString = "") => {
  try {
    const intervalTime = INTERVAL + Math.random() * 9000;

    await pauseController.waitIfPaused();

    if (!page || !page?.reload) {
      await pausableSleep(intervalTime);

      console.log(
        `[${new Date().toLocaleTimeString()}] Will recreate page on next loop iteration, refreshing in ${
          intervalTime / 1000
        }s...`
      );
      return true;
    }

    console.log(
      `[${new Date().toLocaleTimeString()}] ${logString} refreshing in ${
        intervalTime / 1000
      }s...`
    );
    await pausableSleep(intervalTime);

    await pauseController.waitIfPaused();
    await page.reload({ waitUntil: "domcontentloaded" });
  } catch (err) {
    const intervalTime = INTERVAL + Math.random() * 11_000;
    await pausableSleep(intervalTime);

    console.log(
      `[${new Date().toLocaleTimeString()}] Will recreate page on next loop iteration, refreshing in ${
        intervalTime / 1000
      }s...`,
      err.message
    );
    return true;
  }
};

const fetchPatientsFromAPI = async (page, requestBody) => {
  try {
    const result = await page.evaluate(
      async ({ globMedHeaders, requestBody, apiUrl }) => {
        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: globMedHeaders,
            body: requestBody,
          });

          let data,
            message = null;

          try {
            data = await response.json();
          } catch {
            data = await response.text();
            message = "Response was not valid JSON";
            return { success: false, data, message };
          }

          return { success: true, data, message };
        } catch (err) {
          return { success: false, data: null, message: err.message };
        }
      },
      { globMedHeaders, requestBody, apiUrl }
    );

    const { success, data, message } = result;

    const isDataString = typeof data === "string";

    if (isDataString || !success || message) {
      return {
        success: false,
        patients: [],
        data,
        message: isDataString ? data : message || "API fetch failed",
      };
    }

    if (data?.statusCode !== "Success") {
      return {
        success: false,
        patients: [],
        data,
        message: `API returned non-success status: ${
          isDataString ? data : data?.statusCode
        }`,
      };
    }

    return {
      success: true,
      patients: data?.data?.result || [],
      data,
      message: null,
    };
  } catch (err) {
    return { success: false, patients: [], data: null, message: err.message };
  }
};

const waitForWaitingCountWithInterval = async ({
  collectionTabType,
  browser,
  patientsStore,
  sendWhatsappMessage,
}) => {
  let page, cursor;

  let apiHadData = false;

  const { targetText, categoryReference } =
    PATIENT_SECTIONS_STATUS[collectionTabType];

  const isPending = collectionTabType === TABS_COLLECTION_TYPES.WAITING;

  const requestBody = JSON.stringify({
    pageSize: isPending ? 100 : 5,
    pageNumber: 1,
    categoryReference,
    providerZone: [],
    providerName: [],
    specialtyCode: [],
    referralTypeCode: [],
    referralReasonCode: [],
    genericSearch: "",
    sortOrder: "asc",
  });

  if (!patientsStore.hasReloadListener()) {
    patientsStore.on("forceReloadHomePage", async () => {
      console.log(
        `[${new Date().toLocaleTimeString()}] 📢 Received forceReloadHomePage event`
      );
      if (page) {
        try {
          await pauseController.waitIfPaused();
          await page.reload({ waitUntil: "domcontentloaded" });
          console.log(
            `[${new Date().toLocaleTimeString()}] 🔄 Page reloaded successfully from event.`
          );
        } catch (err) {
          console.log(
            `[${new Date().toLocaleTimeString()}] ❌ Error during manual homepage reload:`,
            err.message
          );
        }
      } else {
        console.log(
          `[${new Date().toLocaleTimeString()}] ⚠️ forceReloadHomePage event fired but page is null`
        );
      }
    });
  }

  while (true) {
    try {
      await pauseController.waitIfPaused();

      // 🔹 Login check
      const [newPage, newCursor, isLoggedIn, isErrorAboutLockedOut] =
        await makeUserLoggedInOrOpenHomePage({
          browser,
          cursor,
          currentPage: page,
          sendWhatsappMessage,
        });

      page = newPage;
      cursor = newCursor;

      if (isErrorAboutLockedOut) {
        await closePageSafely(page);
        await pausableSleep(LOCKED_OUT_SLEEP_TIME);
        page = null;
        cursor = null;
        continue;
      }

      if (!isLoggedIn) {
        await pausableSleep(NOT_LOGGED_SLEEP_TIME);
        continue;
      }

      console.log(
        `[${new Date().toLocaleTimeString()}] 🌀 Fetching ${targetText} collection ...`
      );
      const { patients, message, success } = await fetchPatientsFromAPI(
        page,
        requestBody
      );

      if (!success || message) {
        const shouldCreateNewPage = await reloadAndCheckIfShouldCreateNewPage(
          page,
          `success=${success} message=${message}`
        );
        if (shouldCreateNewPage) {
          page = null;
          cursor = null;
        }
        continue;
      }

      const patientsLength = patients.length ?? 0;

      if (!patientsLength) {
        console.log(
          `[${new Date().toLocaleTimeString()}] ⏳ No patients found in API response, exiting...`
        );

        if (apiHadData && patientsStore.size()) {
          apiHadData = false;
          console.log(
            `[${new Date().toLocaleTimeString()}] ✅ checking for store patients with files to clear`
          );

          try {
            await patientsStore.clear();
            console.log(
              `[${new Date().toLocaleTimeString()}] ✅ Patient store with files cleared`
            );
          } catch (error) {
            console.error(
              `[${new Date().toLocaleTimeString()}] Error clearing patients store:`,
              error
            );
          }

          const shouldCreateNewPage = await reloadAndCheckIfShouldCreateNewPage(
            page,
            "cleared patients store and files"
          );
          if (shouldCreateNewPage) {
            page = null;
            cursor = null;
          }
          continue;
        }

        await pausableSleep(INTERVAL + Math.random() * 5000);
        continue;
      }

      console.log(
        `[${new Date().toLocaleTimeString()}] 📋 Found ${patientsLength} patients from API to process`
      );

      apiHadData = true;

      const newPatientAdded = await processCollectingPatients({
        browser,
        page,
        patientsStore,
        patients,
      });

      const patientsInStore = patientsStore.getAllPatients();
      const patientsIds = patients.map(({ idReferral }) => String(idReferral));

      let hasPatientsRemoved = false;

      if (patientsInStore.length) {
        const storePatientsNotInTheApi = patientsInStore.filter(
          ({ referralId }) => !patientsIds.includes(referralId)
        );

        if (storePatientsNotInTheApi?.length) {
          try {
            console.log(
              `[${new Date().toLocaleTimeString()}] ✅ removing unsynced patients from store`
            );
            await Promise.allSettled(
              storePatientsNotInTheApi.map(({ referralId }) =>
                patientsStore.removePatientByReferralId(referralId)
              )
            );
            hasPatientsRemoved = true;
          } catch (error) {
            console.log(
              `[${new Date().toLocaleTimeString()}] 🛑 Failed removing unsynced patients from store`
            );
          }
        }
      }

      if (newPatientAdded || hasPatientsRemoved) {
        await sleep(2000 + Math.random() * 3000);
        const shouldCreateNewPage = await reloadAndCheckIfShouldCreateNewPage(
          page,
          "showing patients"
        );
        if (shouldCreateNewPage) {
          page = null;
          cursor = null;
        }
      } else {
        await pausableSleep(INTERVAL + Math.random() * 5000);
      }
    } catch (err) {
      console.log(
        `[${new Date().toLocaleTimeString()}] 🛑 Unexpected error during loop:`,
        err.message
      );
      await pausableSleep(INTERVAL + Math.random() * 3000);
    }
  }
};

export default waitForWaitingCountWithInterval;
export {
  pause as pauseFetchingPatients,
  continueIfPaused as continueFetchingPatientsIfPaused,
};
