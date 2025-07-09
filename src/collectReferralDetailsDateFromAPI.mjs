/*
 *
 * Helper: `collectReferralDetailsDateFromAPI`.
 *
 */
import getWhenCaseStarted from "./getWhenCaseStarted.mjs";

const endpoint = "referrals/details";

const collectReferralDetailsDateFromAPI = (
  page,
  referralId,
  useDefaultMessageIfNotFound
) => {
  return new Promise((resolve) => {
    let requestStartTime = null;
    let timeoutId;

    const onRequest = (req) => {
      if (req.url().includes(endpoint) && req.method() === "POST") {
        requestStartTime = Date.now();
      }
    };

    const onResponse = async (res) => {
      if (
        res.url().includes(endpoint) &&
        res.request().method() === "POST" &&
        res.status() === 200
      ) {
        const detailsApiReceivedAtMS = Date.now();
        const latency = requestStartTime
          ? detailsApiReceivedAtMS - requestStartTime
          : 1500;

        console.log(`Got patient=${referralId} details api response`);

        try {
          const data = await res.json();
          const { statusCode, data: apiData } = data || {};

          if (!apiData || statusCode !== "Success") {
            cleanup();
            return resolve({
              detailsApiError: "Invalid response data",
              detailsApiStatusCode,
              detailsApiData: data,
            });
          }

          const {
            message,
            requiredSpecialty,
            specialty,
            mobileNumber: mobileNumberFromDetails,
            ...otherDetailsData
          } = apiData;

          const serverSentAtMS = detailsApiReceivedAtMS - latency;

          const timingData = getWhenCaseStarted(
            serverSentAtMS,
            message,
            useDefaultMessageIfNotFound
          );

          cleanup();

          resolve({
            timingData: {
              detailsApiCalledAtMs: requestStartTime,
              detailsApiCalledAt: requestStartTime
                ? new Date(requestStartTime).toLocaleString()
                : null,
              detailsApiReturnedAtMs: detailsApiReceivedAtMS,
              detailsApiReturnedAt: new Date(
                detailsApiReceivedAtMS
              ).toLocaleString(),
              detailsRequestNetworkLatency: latency,
              detailsResponseFiredFromServerAtMS: serverSentAtMS,
              ...timingData,
            },
            specialty: requiredSpecialty,
            subSpecialty: specialty || requiredSpecialty,
            mobileNumberFromDetails,
            ...otherDetailsData,
          });
        } catch (err) {
          cleanup();
          resolve({
            detailsApiError: "Failed to parse details API response",
            detailsApiStatusCode: res.status(),
            detailsApiCatchError: err.message,
          });
        }
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      page.off("request", onRequest);
      page.off("response", onResponse);
    };

    page.on("request", onRequest);
    page.on("response", onResponse);

    // Auto-timeout after 15 seconds
    timeoutId = setTimeout(() => {
      cleanup();
      resolve({
        detailsApiError: "Timeout: No valid 'details' API response within 17s",
      });
    }, 17000);
  });
};

export default collectReferralDetailsDateFromAPI;

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
