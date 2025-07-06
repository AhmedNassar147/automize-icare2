/*
 *
 * helper: `openDetailsPageAndDoUserAction`.
 *
 */
import { USER_ACTION_TYPES } from "./constants.mjs";
// import clickButtonForReferralId from "./clickRowButtonForReferralIdViewer.mjs";
// import openUserMenuAndClickHome from "./openUserMenuAndClickHome.mjs";
// import closePageSafely from "./closePageSafely.mjs";
// import getWhenCaseStarted from "./getWhenCaseStarted.mjs";
import { SECTIONS_IN_DETAILS_PAGE } from "./constants.mjs";
import extractDetailsSectionsByTitle from "./extractDetailsSectionsByTitle.mjs";
import downloadFilesFromFileUploadSection from "./downloadFilesFromFileUploadSection.mjs";

const MAX_UPLOAD_RETRIES = 6;
const MAX_VISIT_RETRIES = 3;

const openDetailsPageAndDoUserAction = async (options) => {
  const {
    browser,
    page,
    patient,
    letterFile,
    actionType,
    retryCount = 0,
    visitRetryCount = 0,
    goBackFinally,
  } = options;

  const isAcceptType = actionType === USER_ACTION_TYPES.ACCEPT;
  const isRejectType = actionType === USER_ACTION_TYPES.REJECT;
  const isCollectType = actionType === USER_ACTION_TYPES.COLLECT;

  let patientDetails = patient;
  const { patientName, referralId } = patient;

  console.log(
    `👨‍⚕️ Collecting patient=${patientName} referralId=${referralId} details ...`
  );

  try {
    // const areWeInDetailsPage = await clickButtonForReferralId(page, referralId);

    // if (!areWeInDetailsPage && visitRetryCount >= MAX_VISIT_RETRIES) {
    //   return {
    //     success: false,
    //     message: `❌ patient=${patientName} referralId=${referralId} not found in table, tried ${MAX_VISIT_RETRIES} times.`,
    //     patientDetails,
    //   };
    // }

    // if (!areWeInDetailsPage) {
    //   return await openDetailsPageAndDoUserAction({
    //     ...options,
    //     visitRetryCount: visitRetryCount + 1,
    //   });
    // }

    return;

    // ----------------------- we are in details page --------------------------
    if (isCollectType) {
      const { patientInformation, caseDetails, icd, procedure } =
        await extractDetailsSectionsByTitle(page, SECTIONS_IN_DETAILS_PAGE);

      const { mainSpecialty, subSpecialty } = caseDetails || {};

      const specialty = mainSpecialty || subSpecialty;

      const files = await downloadFilesFromFileUploadSection(
        page,
        referralId,
        specialty
      );

      patientDetails = {
        ...patientDetails,
        ...(patientInformation || null),
        ...(caseDetails || null),
        icd,
        procedure,
        files,
      };

      return {
        success: true,
        message: `✅ patient=${patientName} referralId=${referralId} collected successfully.`,
        patientDetails,
      };
    }
  } catch (error) {
    return {
      success: false,
      message: `❌ Error collecting patient=${patientName} referralId=${referralId}, ${error.message}`,
      patientDetails,
    };
  } finally {
    if (goBackFinally) {
      await page.goBack();
    }
  }
};

export default openDetailsPageAndDoUserAction;
