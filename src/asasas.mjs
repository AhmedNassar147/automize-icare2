// /*
//  *
//  * Helper: `openDetailsPageAndDoUserAction`.
//  *
//  */
// import navigateToPatientDetailsPage from "./navigateToPatientDetailsPage.mjs";

// import collectFilesFromPopupWindow from "./collectFilesFromPopupWindow.mjs";
// import getSelectedNationalityFromDropdwon from "./getSelectedNationalityFromDropdwon.mjs";
// import openPopupDocumentsViewer from "./openPopupDocumentsViewer.mjs";
// import uploadLetterFile from "./uploadLetterFile.mjs";
// import fillDetailsPageRejectionForm from "./fillDetailsPageRejectionForm.mjs";
// import { USER_ACTION_TYPES } from "./constants.mjs";
// import clickAppLogo from "./clickAppLogo.mjs";
// import closePageSafely from "./closePageSafely.mjs";
// import getWhenCaseStarted from "./getWhenCaseStarted.mjs";

// const MAX_UPLOAD_RETRIES = 6;

// const openDetailsPageAndDoUserAction = async (options) => {
//   const {
//     browser,
//     page,
//     patient,
//     letterFile,
//     actionType,
//     retryCount = 0,
//   } = options;

//   const isAcceptType = actionType === USER_ACTION_TYPES.ACCEPT;
//   const isRejectType = actionType === USER_ACTION_TYPES.REJECT;
//   const isCollectType = actionType === USER_ACTION_TYPES.COLLECT;

//   let patientDetails = patient;
//   const { adherentName, actionLinkRef, referralId, requiredSpecialty } =
//     patient;

//   try {
//     console.log(
//       `👨‍⚕️ visit details page for patient=${adherentName} referralId=${referralId} ...`
//     );

//     await navigateToPatientDetailsPage(page, actionLinkRef);
//     // await checkStopModalAndCloseIt(page);

//     const { popupPage, canUploadLetter } = await openPopupDocumentsViewer(
//       browser,
//       page,
//       isCollectType
//     );

//     if (popupPage) {
//       await popupPage.waitForSelector(
//         !isCollectType ? "#attach_frm" : 'a[href*="OpenAttach.cfm"]'
//       );
//     }

//     if (isCollectType) {
//       const files = await collectFilesFromPopupWindow({
//         popupPage,
//         referralId,
//         requiredSpecialty,
//         page,
//       });
//       const nationalityOptions = await getSelectedNationalityFromDropdwon(page);
//       const startedAtValues = await getWhenCaseStarted(page);

//       patientDetails.nationality = (nationalityOptions || {}).text;

//       const { startedAt, startedAtMessage, reviewMinutes } = startedAtValues;

//       patientDetails.startedAt = startedAt;
//       patientDetails.startedAtMessage = startedAtMessage;
//       patientDetails.reviewMinutes = reviewMinutes;

//       if (files) {
//         patientDetails.files = files || [];
//       }

//       await closePageSafely(popupPage);

//       console.log(
//         `✅ Successfully collected patient=${adherentName} referralId=${referralId}`
//       );

//       return { patientDetails, isDoneSuccessfully: true };
//     }

//     if (!canUploadLetter) {
//       if (retryCount >= MAX_UPLOAD_RETRIES) {
//         const message = `❌ ${retryCount} retries reached: we couldn't find a way to upload the letter for patient=${patient.adherentName} referralId=${patient.referralId}`;
//         console.error(message);
//         return {
//           patientDetails,
//           isDoneSuccessfully: false,
//           wasTryingToUpload: true,
//           uploadError: message,
//         };
//       }

//       await clickAppLogo(page);

//       // Increase retry count for recursive call
//       return await openDetailsPageAndDoUserAction({
//         ...options,
//         retryCount: retryCount + 1,
//       });
//     }

//     const isUploadedSuccessfully = await uploadLetterFile({
//       popupPage,
//       letterFile,
//       isAcceptingPatient: isAcceptType,
//       referralId,
//     });

//     if (!isUploadedSuccessfully) {
//       return {
//         patientDetails,
//         isDoneSuccessfully: false,
//         isUploadedSuccessfully,
//       };
//     }

//     if (isRejectType) {
//       await fillDetailsPageRejectionForm(page);
//     }

//     await closePageSafely(popupPage, true);

//     await Promise.all([
//       page.waitForNavigation({ waitUntil: "networkidle2" }),
//       page.click(isAcceptType ? "#accept" : "#reject"),
//     ]);

//     console.log(
//       `✅ Visiting the captcha page for patient=${adherentName} referralId=${referralId}`
//     );

//     const captchaFileName = `${adherentName}_${referralId}`;

//     return {
//       patientDetails,
//       isDoneSuccessfully: true,
//       captchaFileName,
//     };
//   } catch (error) {
//     console.error(
//       `❌ Failed processing patient=${adherentName} referralId=${referralId}:`,
//       error.message
//     );

//     return { patientDetails, isDoneSuccessfully: false };
//   }
// };

// export default openDetailsPageAndDoUserAction;
