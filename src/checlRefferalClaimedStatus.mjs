/**
 *
 * Helper: `checlRefferalClaimedStatus`.
 *
 */
import pLimit from "p-limit";
import os from "os";
import createConsoleMessage from "./createConsoleMessage.mjs";
import getSummaryFromTabs from "./getSummaryFromTabs.mjs";
import closePageSafely from "./closePageSafely.mjs";
import makeUserLoggedInOrOpenHomePage from "./makeUserLoggedInOrOpenHomePage.mjs";
import {
  HOME_PAGE_URL,
  PATIENT_SECTIONS_STATUS,
  TABS_COLLECTION_TYPES,
} from "./constants.mjs";

const { ACCEPTED, ADMITTED, CONFIRMED } = TABS_COLLECTION_TYPES;

const checkTabType = (tabName, type) =>
  tabName === PATIENT_SECTIONS_STATUS[type].categoryReference;

const fetchCase = async (page, refferalId, referralEndTimestamp) => {
  const { patients: apisPatients, errors } = await getSummaryFromTabs({
    page,
    includeAccepted: true,
    includeConfirmed: true,
    includeAdmitted: true,
    noDates: true,
    noDischarged: true,
    extraParams: {
      genericSearch: refferalId,
    },
  });

  // const isAccepted = checkTabType(tabName, ACCEPTED);
  // const isAccepted = checkTabType(tabName, CONFIRMED);
  // const isAdmitted = checkTabType(tabName, ADMITTED);

  return { referralEndTimestamp, refferalId, apisPatients, errors };
};

const checlRefferalClaimedStatus = async (
  browser,
  patientsStore,
  sendTelegramMessage,
) => {
  const {
    newPage: page,
    isLoggedIn,
    isErrorAboutLockedOut,
    shouldCloseApp,
  } = await makeUserLoggedInOrOpenHomePage({
    browser,
    startingPageUrl: HOME_PAGE_URL,
    noBundleCheck: true,
    noCursor: true,
  });

  if (!isLoggedIn || isErrorAboutLockedOut || shouldCloseApp) {
    createConsoleMessage(
      "User is not logged in, when calling checlRefferalClaimedStatus.",
      "error",
    );
    return;
  }

  let cases = patientsStore.getAllNonClaimableCases();

  if (!cases?.length) {
    await closePageSafely(page);
    return;
  }

  cases = cases.map((_, index) => index < 3);

  const cpuCount = os.cpus().length; // Get the number of CPU cores
  const limit = pLimit(Math.min(4, cpuCount));

  const results = await Promise.all(
    cases.map(({ referralId, referralEndTimestamp }) =>
      limit(
        async () => await fetchCase(page, referralId, referralEndTimestamp),
      ),
    ),
  );

  console.log("results", JSON.stringify(results, null, 2));
  await closePageSafely(page);

  // tabName

  // if (errors.length) {
  //   errors.forEach((error) =>
  //     createConsoleMessage(error, "error", "checlRefferalClaimedStatus"),
  //   );
  //   await closePageSafely(page);
  //   return;
  // }

  // for (const { referralId, referralEndTimestamp } of cases) {
  //   try {
  //     const result = await page.evaluate(
  //       async ({ baseGlobMedAPiUrl, globMedHeaders, referralId }) => {
  //         const res = await fetch(`${baseGlobMedAPiUrl}/referrals/listing`, {
  //           method: "POST",
  //           headers: globMedHeaders,
  //           body: JSON.stringify({
  //             pageSize: 1,
  //             pageNumber: 1,
  //             categoryReference: "accepted",
  //             genericSearch: referralId,
  //           }),
  //         });
  //         const data = await res.json();
  //         return data?.data?.referrals || [];
  //       },
  //       { baseGlobMedAPiUrl, globMedHeaders, referralId },
  //     );

  //     const stillAccepted = result.some(
  //       (r) => String(r.idReferral) === String(referralId),
  //     );

  //     if (!stillAccepted) {
  //       // Case moved out of accepted → confirmed or admitted
  //       createConsoleMessage(
  //         `🎉 Case ${referralId} moved out of accepted`,
  //         "info",
  //       );

  //       await updateCaseInLog(referralId, referralEndTimestamp, {
  //         claimed: "confirmed",
  //       });

  //       patientsStore.removeNonClaimableCase(referralId);

  //       await sendTelegramMessage(
  //         `🎉 Case \`${referralId}\` has been *confirmed/admitted*!`,
  //       );
  //     }
  //   } catch (err) {
  //     createConsoleMessage(
  //       err,
  //       "error",
  //       `❌ checlRefferalClaimedStatus failed for ${referralId}:`,
  //     );
  //   }
  // }
};

export default checlRefferalClaimedStatus;
