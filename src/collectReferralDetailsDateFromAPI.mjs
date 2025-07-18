/*
 *
 * Helper: `collectReferralDetailsDateFromAPI`.
 *
 */
import getWhenCaseStarted from "./getWhenCaseStarted.mjs";
import formatToDateTime from "./formatToDateTime.mjs";

const apiEndpoints = {
  details: "referrals/details",
  patientInfo: "referrals/patient-info",
  icds: "referrals/icds",
  // cpts: "referrals/cpts",
  // attachments: "referrals/attachments",
};

const getCleanText = (raw = "") =>
  raw
    .replace(/\\["nrt]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildDetailsApiData = (responseData, useDefaultMessageIfNotFound) => {
  const {
    response,
    receivedAt,
    requestStartTime,
    networkStatus,
    apiCatchError,
    apiCatchMessage,
    headers,
  } = responseData || {};

  const { statusCode, data: apiData } = response || {};

  if (
    !apiData ||
    statusCode !== "Success" ||
    apiCatchError ||
    apiCatchMessage
  ) {
    return {
      detailsApiErrorResult: {
        statusCode,
        apiData,
        apiCatchError,
        networkStatus,
        requestStartTime,
        receivedAt,
        responseHeaders: headers,
      },
    };
  }

  const {
    message,
    requiredSpecialty,
    specialty,
    mobileNumber: mobileNumberFromDetails,
    ...otherDetailsData
  } = apiData;

  const latency =
    requestStartTime != null ? receivedAt - requestStartTime : 350;

  const serverSentAtMS = receivedAt - latency;

  const timingData = getWhenCaseStarted(
    headers.date,
    message,
    useDefaultMessageIfNotFound
  );

  return {
    timingData: {
      detailsApiCalledAtMs: requestStartTime,
      detailsApiCalledAt: requestStartTime
        ? formatToDateTime(requestStartTime)
        : null,
      detailsRequestNetworkLatency: latency,
      detailsApiReturnedAtMs: receivedAt,
      detailsApiReturnedAt: formatToDateTime(receivedAt),
      detailsResponseFiredFromServerAtMS: serverSentAtMS,
      detailsResponseFiredFromServerAt: formatToDateTime(serverSentAtMS),
      ...timingData,
      responseHeaders: headers,
    },
    specialty: requiredSpecialty,
    subSpecialty: specialty || requiredSpecialty,
    mobileNumberFromDetails,
    ...otherDetailsData,
  };
};

const buildPatientInfo = (responseData, mobileNumberFromDetails) => {
  const { response, networkStatus, apiCatchError, apiCatchMessage } =
    responseData || {};

  const { statusCode, data: apiData } = response || {};

  if (
    !apiData ||
    statusCode !== "Success" ||
    apiCatchError ||
    apiCatchMessage
  ) {
    return {
      patientInfoApiErrorResult: {
        statusCode,
        apiData,
        apiCatchError,
        networkStatus,
      },
    };
  }

  const {
    firstName,
    lastName,
    mobileNumber,
    alternativeMobileNumber,
    ...otherPatientInfo
  } = apiData;

  const patientName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    patientName,
    mobileNumber:
      mobileNumber || alternativeMobileNumber || mobileNumberFromDetails,
    ...otherPatientInfo,
  };
};

const buildIcdData = (responseData) => {
  const { response, networkStatus, apiCatchError, apiCatchMessage } =
    responseData || {};

  const { statusCode, data: apiData } = response || {};

  if (
    !apiData ||
    statusCode !== "Success" ||
    apiCatchError ||
    apiCatchMessage
  ) {
    return {
      icds: [],
      icdsApiErrorResult: {
        statusCode,
        apiData,
        apiCatchError,
        networkStatus,
      },
    };
  }

  const { data } = apiData || {};
  const icdList = Array.isArray(data) ? data : [];

  if (!icdList.length) {
    return { icds: [] };
  }

  const formatted = icdList.map((icd) => {
    const { description = "", isDefault = false } = icd;
    return [
      getCleanText(description),
      `isDefault=(${isDefault ? "Yes" : "No"})`,
    ].join(" AND ");
  });

  return {
    icds: formatted,
  };
};

const collectReferralDetailsDateFromAPI = ({
  page,
  referralId,
  useDefaultMessageIfNotFound,
  useOnlyDetailsApi,
}) => {
  return new Promise((resolve) => {
    let timeoutId;
    const requestStart = {};
    const responses = {};

    const apiTargets = Object.entries(
      useOnlyDetailsApi
        ? {
            details: "referrals/details",
          }
        : apiEndpoints
    );

    const cleanup = () => {
      clearTimeout(timeoutId);
      page.off("request", onRequest);
      page.off("response", onResponse);
    };

    const onRequest = (req) => {
      for (const [key, endpoint] of apiTargets) {
        if (req.url().includes(endpoint) && req.method() === "POST") {
          requestStart[key] = Date.now();
        }
      }
    };

    const onResponse = async (res) => {
      for (const [key, endpoint] of apiTargets) {
        if (
          res.url().includes(endpoint) &&
          res.request().method() === "POST" &&
          res.status() >= 200 &&
          res.status() < 300 &&
          !responses[key]
        ) {
          try {
            const receivedAt = Date.now();
            const requestStartTime = requestStart[key];

            const data = await res.json();

            const headers = res.headers();

            responses[key] = {
              response: data,
              receivedAt,
              requestStartTime,
              networkStatus: res.status(),
              headers,
            };

            console.log(`✅ Got ${key} response for referralId=${referralId}`);
          } catch (err) {
            responses[key] = {
              apiCatchError: `Failed to parse JSON for ${key}`,
              apiCatchMessage: err.message,
              networkStatus: res.status(),
            };
          }
        }
      }

      const conditionToBuildData = useOnlyDetailsApi
        ? responses.details
        : responses.details && responses.patientInfo && responses.icds;

      if (conditionToBuildData) {
        cleanup();
        resolve(
          buildFinalResult(
            responses,
            useDefaultMessageIfNotFound,
            useOnlyDetailsApi
          )
        );
      }
    };

    const buildFinalResult = (
      responses,
      useDefaultMessageIfNotFound,
      useOnlyDetailsApi
    ) => {
      const {
        details: detailsDataResonse,
        patientInfo: infoDataResponse,
        icds: icdsDataResponse,
      } = responses;

      const { mobileNumberFromDetails, timingData, ...otherDetails } =
        buildDetailsApiData(detailsDataResonse, useDefaultMessageIfNotFound);

      if (useOnlyDetailsApi) {
        return {
          ...timingData,
          ...otherDetails,
        };
      }

      const { patientName, mobileNumber, ...otherPatientInfo } =
        buildPatientInfo(infoDataResponse, mobileNumberFromDetails);

      const icdData = buildIcdData(icdsDataResponse);

      return {
        ...timingData,
        patientName,
        mobileNumber,
        ...otherPatientInfo,
        ...otherDetails,
        ...icdData,
      };
    };

    page.on("request", onRequest);
    page.on("response", onResponse);

    timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        apisError: "Timeout: One or more APIs did not respond in time.",
        receivedApisDataNames: Object.keys(responses),
        missingApisDataNames: Object.keys(apiEndpoints).filter(
          (k) => !responses[k]
        ),
      });
    }, 29_000);
  });
};

export default collectReferralDetailsDateFromAPI;

// https://referralprogram.globemedsaudi.com/referrals/patient-info (POST) statusCode => 200 OK
// patient info
// {
//     "data": {
//         "nationalId": "1054184054",
//         "firstName": "MISFERA ",
//         "lastName": "GHATHANI",
//         "fatherName": "AWAD ",
//         "weight": null,
//         "alternativeMobileNumber": null,
//         "mobileNumber": "+966597210000",
//         "hijriDOB": "Muharram 9, 1447 AH",
//         "nationality": "SAUDI",
//         "patientType": null,
//         "gender": "Female",
//         "dob": "2025-07-04T00:00:00",
//         "maritalStatus": "Single",
//         "passportNbr": null,
//         "email": null
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
// ------------------------ (ICD) ------------------------
// https://referralprogram.globemedsaudi.com/referrals/icds  (POST) Status Code 200
// {
//     "data": {
//         "tableHeaders": [
//             {
//                 "id": "icdCode",
//                 "label": "Code",
//                 "sortingId": null
//             },
//             {
//                 "id": "description",
//                 "label": "Description",
//                 "sortingId": null
//             },
//             {
//                 "id": "isDefault",
//                 "label": "Is Default",
//                 "sortingId": null
//             }
//         ],
// "data": [
//     {
//         "icdCode": "P07.32",
//         "description": "P07.32 - Other preterm infant, 32 or more completed weeks but less than 37 completed weeks (16)",
//         "isDefault": true
//     }
// ]
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }

// https://referralprogram.globemedsaudi.com/referrals/attachment-types?languageCode=1 (POST) statusCode => 200 OK
// {
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

// ------------------------ (procesdure) ------------------------
// https://referralprogram.globemedsaudi.com/referrals/cpts  (POST) Status Code 200
// {
//     "data": {
//         "data": [
//             {
//                 "idCPT": "N.1",
//                 "description": "N.1 - \"NICU First week (SR/Day) N.1* Medication above 350 SR per day as per SFDA price list, Blood & blood products, MRI, CT, ECHO, Doppler , CRRT , Surgical and endoscopic procedure are an excluded serviceTo get re-imbused for medication above the daily \"",
//                 "serviceCode": "PD",
//                 "estimatedCost": 0,
//                 "estimatedQty": 0
//             }
//         ]
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }

// ----------------------------------------

//  https://referralprogram.globemedsaudi.com/referrals/attachments (POST) statusCode => 200 OK
// {
//     "data": [
//         {
//             "idProvider": null,
//             "canAttach": false,
//             "idAttachment": "4954",
//             "fileName": "Image_1450 (1).pdf",
//             "attachmentType": "Medical Report",
//             "fileExtension": 0,
//             "attachmentDate": "0001-01-01T00:00:00",
//             "content": null
//         },
//         {
//             "idProvider": "H509821",
//             "canAttach": false,
//             "idAttachment": "4956",
//             "fileName": "letter_351193.pdf",
//             "fileExtension": 0,
//             "attachmentType": "Acceptance",
//             "attachmentDate": "0001-01-01T00:00:00",
//             "content": null
//         }
//     ],
//     "statusCode": "Success",
//     "errorMessage": null
// }
// ----------------------------------------

// ----------------------------------------
// https://referralprogram.globemedsaudi.com/referrals/download-attachment/4956 Request Method (GET) Status Code 200 (content-type: application/octet-stream)
// cookie
// __moh-bff=CfDJ8EhdFmr9dTdLn-VtvO2lgcR-luOT8PmkiM2mhe7A8V2G8PSd_MTaPLKYPN7VFuy_uckBvJpWnn52GT4emk1buKp3PvseRkHQH1RH2gmpY6iYodfuYlw10d7m0LLJSNDJmT1WPtgkviqD0adfbLD7erBN4uQAeaQbU0EDunaum-fA2UIggwCOKzB78fk6Z4GVg6VlcrBrjdH2xGozM-_3FLnixcPqpSN2vJHoK2nDq7gNWxpfJkyhv7LPeYejXsEZfd2EA-Wju4-_paFZ4CcrWAnI5Eb7ygEI0pQZIhA7KEhAYzXCi33vUz1HFO7Nc_zQ9g0IprQfAROtpOORp4AYVxY; __moh-bff=CfDJ8EhdFmr9dTdLn-VtvO2lgcT_r5aXX5w-MppQDkoywKNCULgi8B7QvJ85hBvmOYRzNKVemH4YBgVIFbsw0If0fOCav5mAmAmTBmGLAEmb0LKkXO54GXWijYf_pD-CEZ9LLpgZ-_cclwOYRENH6L_b3V_uDRnVvk6DIjxxK2YOU_axiW4VZMU5sn6_SP5y3HdLcJ7znvj_IdqK2YbmX1XhNMQCAHwQlgeBIk9onQij463_tMXZmYKiNbBzaOaitdMC4awDbIAN_DsqdYQeNd0N3z2SLEbtIumE2k80_aU37PUMWpkMaZP6yce1apRbENU-VTi4veZf6s9jYnBVwzYiQFU; cookiesession1=678A3E6658FBCBD1D1F859834AC5A3E0
// host
// referralprogram.globemedsaudi.com
// referer
// https://referralprogram.globemedsaudi.com/referral/details
// sec-ch-ua
// "Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"
// sec-ch-ua-mobile
// ?0
// sec-ch-ua-platform
// "Windows"
// sec-fetch-dest
// empty
// ----------------------------------------

// https://referralprogram.globemedsaudi.com/referrals/details (POST) statusCode => 200 OK
// {
//     "data": {
//         "requestDate": "2025-06-28T11:35:18",
//         "creationDate": "2025-06-28T08:38:30",
//         "ihalatyReference": "31954369",
//         "providerName": "TADAWI MEDICALhospital- khamis Mushayt",
//         "longitude": null,
//         "latitude": null,
//         "providerCode": "H523757",
//         "providerZoneCode": "18",
//         "providerCityCode": null,
//         "providerRegionCode": null,
//         "providerZone": "Bisha",
//         "referralCause": "Specialty Unavailable",
//         "requestedBedType": "Intensive Care Unit (ICU)",
//         "claimType": null,
//         "doctor": null,
//         "estimationCost": 0,
//         "category": "HP",
//         "sourceProvider": "King Abdullah Hospital",
//         "referralTypeCode": "2",
//         "refType": "Emergency",
//         "requiredSpecialtyCode": "520",
//         "er": false,
//         "specialtyCode": "290",
//         "specialty": "Pulmonary Diseases",
//         "mobileNumber": null,
//         "claimReference": null,
//         "lengthOfStay": 0,
//         "referralCauseDetails": {
//             "id": 872,
//             "note": "Diagnosis NSTEMI, CHEST INFECTION , ESRD ON HD",
//             "isPublic": true,
//             "isActive": true,
//             "owner": null,
//             "canDelete": null
//         },
//         "referralAdditionalInformation": null,
//         "status": "C",
//         "canUpdate": true,
//         "requiredSpecialty": "Internal Medicine",
//         "message": "",
//         "isPrivate": false,
//         "canTakeAction": true,
//         "quotaExceededMessage": ""
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
// {
//     "data": {
//         "requestDate": "2025-07-06T00:18:19",
//         "creationDate": "2025-07-05T21:19:39",
//         "ihalatyReference": "31974623",
//         "providerName": "TADAWI MEDICALhospital- khamis Mushayt",
//         "longitude": null,
//         "latitude": null,
//         "providerCode": "H523742",
//         "providerZoneCode": "15",
//         "providerCityCode": null,
//         "providerRegionCode": null,
//         "providerZone": "Asir",
//         "referralCause": "Bed Unavailable",
//         "requestedBedType": "Neonatal Intensive Care Unit (NICU)",
//         "claimType": null,
//         "doctor": null,
//         "estimationCost": 0,
//         "category": "HP",
//         "sourceProvider": "Maternity and Children Hospital Abha",
//         "referralTypeCode": "2",
//         "refType": "Emergency",
//         "requiredSpecialtyCode": "630",
//         "er": false,
//         "specialtyCode": "630",
//         "specialty": "Neonatology",
//         "mobileNumber": null,
//         "claimReference": null,
//         "lengthOfStay": 0,
//         "referralCauseDetails": {
//             "id": 1096,
//             "note": "NICU",
//             "isPublic": true,
//             "isActive": true,
//             "owner": null,
//             "canDelete": null
//         },
//         "referralAdditionalInformation": null,
//         "status": "C",
//         "canUpdate": true,
//         "requiredSpecialty": "Neonatology",
//         "message": "",
//         "isPrivate": false,
//         "canTakeAction": true,
//         "quotaExceededMessage": ""
//     },
//     "statusCode": "Success",
//     "errorMessage": null
// }
