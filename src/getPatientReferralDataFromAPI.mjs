/*
 *
 * Helper: `getPatientReferralDataFromAPI`.
 *
 */
import { globMedHeaders, baseGlobMedAPiUrl } from "./constants.mjs";

const urls = [
  `${baseGlobMedAPiUrl}/attachments`,
  `${baseGlobMedAPiUrl}/patient-info`,
  `${baseGlobMedAPiUrl}/details`,
];

const getPatientReferralDataFromAPI = async (page, idReferral) => {
  const results = await page.evaluate(
    async ({ urls, globMedHeaders, idReferral, baseGlobMedAPiUrl }) => {
      const responses = await Promise.all(
        urls.map(async (url) => {
          const apiFiresAtMS = new Date().getTime();
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: globMedHeaders,
              body: JSON.stringify({ idReferral }),
            });

            const finishedDateMS = new Date().getTime();
            const serverResponseTimeMS = (finishedDateMS - apiFiresAtMS) / 2;

            if (!res.ok) {
              return {
                apiFiresAtMS,
                serverResponseTimeMS,
                success: false,
                error: `Status ${res.status}`,
              };
            }

            const data = await res.json();

            return {
              success: true,
              data: data?.data,
              apiFiresAtMS,
              serverResponseTimeMS,
            };
          } catch (err) {
            const finishedDateMS = new Date().getTime();

            return {
              success: false,
              error: err.message,
              apiFiresAtMS,
              serverResponseTimeMS: (finishedDateMS - apiFiresAtMS) / 2,
            };
          }
        })
      );

      const [attachmentResponse, patientInfoResponse, detailsResponse] =
        responses;

      const {
        data: detailsData,
        error: patientDetailsError,
        apiFiresAtMS,
        serverResponseTimeMS,
      } = detailsResponse;

      const { data: patientInfo, error: patientInfoError } =
        patientInfoResponse || {};

      const { data: attachmentList, error: attchmentsError } =
        attachmentResponse || {};

      const {
        requiredSpecialty,
        specialty,
        mobileNumber: mobileNumberFromDetails,
        sourceProvider,
        requestDate,
        referralCause,
        requestedBedType,
        refType,
        providerZone,
        providerName,
        providerCode,
        message,
        quotaExceededMessage,
        referralCauseDetails,
      } = detailsData || {};

      const {
        firstName,
        fatherName,
        lastName,
        mobileNumber,
        alternativeMobileNumber,
        patientType,
        passportNbr,
        email,
        weight,
        ...otherPatientInfo
      } = patientInfo || {};

      const patientName = [firstName, lastName].filter(Boolean).join(" ");
      const _mobileNumber =
        mobileNumber || alternativeMobileNumber || mobileNumberFromDetails;

      const _specialty = requiredSpecialty || specialty;
      const subSpecialty = specialty || requiredSpecialty;

      const { note } = referralCauseDetails || {};

      let finalData = {
        patientName,
        mobileNumber: _mobileNumber,
        patientType: patientType || undefined,
        passportNbr: passportNbr || undefined,
        email: email || undefined,
        weight: weight || undefined,
        ...otherPatientInfo,
        patientInfoError: patientInfoError,
        specialty: _specialty,
        subSpecialty: subSpecialty,
        sourceProvider,
        providerZone,
        providerName,
        providerCode,
        requestDate,
        requestedBedType,
        referralCause,
        referralType: refType,
        note: note,
        detailsAPiFiresAtMS: apiFiresAtMS,
        detailsAPiServerResponseTimeMS: Math.trunc(serverResponseTimeMS),
        caseAlertMessage: message,
        quotaExceededMessage,
        patientDetailsError,
        attchmentsError,
      };

      if (Array.isArray(attachmentList) && attachmentList.length) {
        function arrayBufferToBase64(buffer) {
          let binary = "";
          const bytes = new Uint8Array(buffer);
          const chunkSize = 0x8000; // 32KB chunks

          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(
              null,
              bytes.subarray(i, i + chunkSize)
            );
          }

          return btoa(binary);
        }

        const downloadTasks = attachmentList
          .filter((item) => !!(item.fileName && item.idAttachment))
          .map(async ({ fileName, idAttachment }) => {
            const downloadUrl = `${baseGlobMedAPiUrl}/download-attachment/${idAttachment}`;

            try {
              const fileRes = await fetch(downloadUrl);

              if (!fileRes.ok) {
                return {
                  idAttachment,
                  fileName,
                  downloadUrl,
                  downloadError: `Failed with status ${fileRes.status}`,
                };
              }

              const getSaveName = (name) =>
                name ? name.replace(/[^a-z0-9_\-\.]/gi, "_") : "";

              const blob = await fileRes.blob();

              const arrayBuffer = await blob.arrayBuffer();
              const base64 = arrayBufferToBase64(arrayBuffer);

              const parts = (fileName || "").split(".");
              const extension = parts.length > 1 ? parts.pop() : "pdf";
              const name = parts.join(".");
              const safeName = getSaveName(name);

              return {
                fileName: `${idReferral}_${getSaveName(
                  _specialty
                )}_${safeName}`,
                extension: extension,
                fileBase64: base64,
                idAttachment,
              };
            } catch (error) {
              return {
                fileName,
                downloadUrl,
                downloadError: `Failed with error ${error}`,
              };
            }
          });

        const files = await Promise.allSettled(downloadTasks);

        finalData.files = files.map((item) => item.value).filter(Boolean);
      }

      return finalData;
    },
    { urls, globMedHeaders, idReferral, baseGlobMedAPiUrl }
  );

  return results;
};

export default getPatientReferralDataFromAPI;

// const globMedHeaders = {
//   Accept: "application/json, text/plain, */*",
//   "Content-Type": "application/json",
//   "Accept-Language": "en-US,en;q=0.9",
//   "X-CSRF": "1",
// };

// const responsex = await fetch("https://referralprogram.globemedsaudi.com/referrals/details", {
//                 method: "POST",
//               headers: globMedHeaders,
//               body: JSON.stringify({ idReferral: "352923" }),
// })

// const datax = await responsex.json();

// https://referralprogram.globemedsaudi.com/referrals/attachments
// Request Method
// POST
// Status Code

// headers
// POST /referrals/attachments HTTP/1.1
// Accept: application/json, text/plain, */*
// Accept-Encoding: gzip, deflate, br, zstd
// Accept-Language: en-US,en;q=0.9
// Connection: keep-alive
// Content-Length: 21
// Content-Type: application/json
// Cookie: __moh-bff=CfDJ8EhdFmr9dTdLn-VtvO2lgcQzauXJeL5oEhEd5BOwowd10JwPvFW9LKfgbr0dXHUUArv0JJJ-UrZL8R_h7Z_-unLYYBRKcGeJLgv_vsy2lr3TlTCpbTbA4nv5Q38reS6Lm4ikKvC2n_qBg2FnHHr9KKh_sx_2NnDZKnQufNwrl5iBT20x132fCHlwFnOe5aPfzEnAcWsjrG7xeenWMUPz2bZeb7z0gHuivTuaIFWPC3zl7nKk6X2-W7eyN4pS6zYuYzuP3TyHBDfJg-w1Qzq_9qax2t90i20kxQ0vLMs0mgtAfhPpt0JPTehMz1LRkaEV3lxhV4FlGLDeA_YmdgjG_Vs; cookiesession1=678A3E66BF05226F904E3EDE31EBF09B
// Host: referralprogram.globemedsaudi.com
// Origin: https://referralprogram.globemedsaudi.com
// Referer: https://referralprogram.globemedsaudi.com/referral/details
// Sec-Fetch-Dest: empty
// Sec-Fetch-Mode: cors
// Sec-Fetch-Site: same-origin
// User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
// X-CSRF: 1
// sec-ch-ua: "Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"
// sec-ch-ua-mobile: ?0
// sec-ch-ua-platform: "Windows"
// https://referralprogram.globemedsaudi.com/referrals/download-attachment/17572

// {
//     "data": [
//         {
//             "idProvider": null,
//             "canAttach": true,
//             "idAttachment": "17572",
//             "fileName": "1174461036.pdf",
//             "fileExtension": 0,
//             "attachmentType": "Medical Report",
//             "attachmentDate": "0001-01-01T00:00:00",
//             "content": null
//         },
//         {
//             "idProvider": null,
//             "canAttach": true,
//             "idAttachment": "17573",
//             "fileName": "حور05082025112534.pdf",
//             "fileExtension": 0,
//             "attachmentType": "Medical Report",
//             "attachmentDate": "0001-01-01T00:00:00",
//             "content": null
//         }
//     ],
//     "statusCode": "Success",
//     "errorMessage": null
// }

// https://referralprogram.globemedsaudi.com/referrals/patient-info
// Request Method
// POST
// Status Code

// headers:
// POST /referrals/patient-info HTTP/1.1
// Accept: application/json, text/plain, */*
// Accept-Encoding: gzip, deflate, br, zstd
// Accept-Language: en-US,en;q=0.9
// Connection: keep-alive
// Content-Length: 21
// Content-Type: application/json
// Cookie: __moh-bff=CfDJ8EhdFmr9dTdLn-VtvO2lgcQzauXJeL5oEhEd5BOwowd10JwPvFW9LKfgbr0dXHUUArv0JJJ-UrZL8R_h7Z_-unLYYBRKcGeJLgv_vsy2lr3TlTCpbTbA4nv5Q38reS6Lm4ikKvC2n_qBg2FnHHr9KKh_sx_2NnDZKnQufNwrl5iBT20x132fCHlwFnOe5aPfzEnAcWsjrG7xeenWMUPz2bZeb7z0gHuivTuaIFWPC3zl7nKk6X2-W7eyN4pS6zYuYzuP3TyHBDfJg-w1Qzq_9qax2t90i20kxQ0vLMs0mgtAfhPpt0JPTehMz1LRkaEV3lxhV4FlGLDeA_YmdgjG_Vs; cookiesession1=678A3E66BF05226F904E3EDE31EBF09B
// Host: referralprogram.globemedsaudi.com
// Origin: https://referralprogram.globemedsaudi.com
// Referer: https://referralprogram.globemedsaudi.com/referral/details
// Sec-Fetch-Dest: empty
// Sec-Fetch-Mode: cors
// Sec-Fetch-Site: same-origin
// User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
// X-CSRF: 1
// sec-ch-ua: "Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"
// sec-ch-ua-mobile: ?0
// sec-ch-ua-platform: "Windows"

// {
//     "data": {
// "nationalId": "1174461036",
// "firstName": "HOUR ",
// "lastName": "ALAMRI",
// "fatherName": "SALEH ",
// "weight": null,
// "alternativeMobileNumber": null,
// "mobileNumber": "+966557294611",
// "hijriDOB": "Shawwal 26, 1436 AH",
// "nationality": "SAUDI",
// "patientType": null,
// "gender": "Female",
// "dob": "2015-08-11T00:00:00",
// "maritalStatus": "Single",
// "passportNbr": null,
//         "email": null
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }

// https://referralprogram.globemedsaudi.com/referrals/details
// POST
// headers
// POST /referrals/details HTTP/1.1
// Accept: application/json, text/plain, */*
// Accept-Encoding: gzip, deflate, br, zstd
// Accept-Language: en-US,en;q=0.9
// Connection: keep-alive
// Content-Length: 21
// Content-Type: application/json
// Cookie: __moh-bff=CfDJ8EhdFmr9dTdLn-VtvO2lgcQzauXJeL5oEhEd5BOwowd10JwPvFW9LKfgbr0dXHUUArv0JJJ-UrZL8R_h7Z_-unLYYBRKcGeJLgv_vsy2lr3TlTCpbTbA4nv5Q38reS6Lm4ikKvC2n_qBg2FnHHr9KKh_sx_2NnDZKnQufNwrl5iBT20x132fCHlwFnOe5aPfzEnAcWsjrG7xeenWMUPz2bZeb7z0gHuivTuaIFWPC3zl7nKk6X2-W7eyN4pS6zYuYzuP3TyHBDfJg-w1Qzq_9qax2t90i20kxQ0vLMs0mgtAfhPpt0JPTehMz1LRkaEV3lxhV4FlGLDeA_YmdgjG_Vs; cookiesession1=678A3E66BF05226F904E3EDE31EBF09B
// Host: referralprogram.globemedsaudi.com
// Origin: https://referralprogram.globemedsaudi.com
// Referer: https://referralprogram.globemedsaudi.com/referral/details
// Sec-Fetch-Dest: empty
// Sec-Fetch-Mode: cors
// Sec-Fetch-Site: same-origin
// User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36
// X-CSRF: 1
// sec-ch-ua: "Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"
// sec-ch-ua-mobile: ?0
// sec-ch-ua-platform: "Windows"

// response
// {
//     "data": {
//         "requestDate": "2025-08-06T10:10:22",
//         "creationDate": "2025-08-06T07:14:11",
//         "ihalatyReference": "32039990",
//         "providerName": "TADAWI MEDICALhospital- khamis Mushayt",
//         "longitude": null,
//         "latitude": null,
//         "providerCode": "H523748",
//         "providerZoneCode": "15",
//         "providerCityCode": null,
//         "providerRegionCode": null,
//         "providerZone": "Asir",
//         "referralCause": "Bed Unavailable",
//         "requestedBedType": "Ward",
//         "claimType": null,
//         "doctor": null,
//         "estimationCost": 0,
//         "category": "HP",
//         "sourceProvider": "Al Namaas Hospital",
//         "referralTypeCode": "3",
//         "refType": "Inpatient",
//         "requiredSpecialtyCode": "320",
//         "er": false,
//         "specialtyCode": "320",
//         "specialty": "Pediatric Surgery",
//         "mobileNumber": null,
//         "claimReference": null,
//         "lengthOfStay": 0,
//         "referralCauseDetails": {
//             "id": 3393,
//             "note": "WARD",
//             "isPublic": true,
//             "isActive": true,
//             "owner": null,
//             "canDelete": null
//         },
//         "referralAdditionalInformation": null,
//         "status": "P",
//         "canUpdate": true,
//         "requiredSpecialty": "Pediatric Surgery",
//         "message": "",
//         "isPrivate": false,
//         "canTakeAction": true,
//         "quotaExceededMessage": ""
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
