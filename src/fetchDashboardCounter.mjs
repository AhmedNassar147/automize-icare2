/*
 *
 * Helper: `fetchDashboardCounter`.
 */
import { baseGlobMedAPiUrl, globMedHeaders } from "./constants.mjs";
const apiUrl = `${baseGlobMedAPiUrl}/dashboard-counter`;

const fetchDashboardCounter = async (page) => {
  try {
    const result = await page.evaluate(
      async ({ globMedHeaders, apiUrl }) => {
        try {
          const response = await fetch(apiUrl, {
            method: "GET",
            headers: globMedHeaders,
          });

          let data;

          try {
            data = await response.json();
          } catch {
            return {
              success: false,
              data: null,
              message: "Dashboard counter response was not valid JSON",
            };
          }

          return {
            success: response.ok,
            data,
            message: response.ok ? null : `HTTP ${response.status}`,
          };
        } catch (err) {
          return {
            success: false,
            data: null,
            message: `Catch error: ${err.message}`,
          };
        }
      },
      { globMedHeaders, apiUrl },
    );

    const { success, data, message } = result;

    if (!success || !data?.data?.length) {
      return {
        success: false,
        counter: {},
        data,
        message: message || "Dashboard counter API fetch failed",
      };
    }

    if (data?.statusCode !== "Success") {
      return {
        success: false,
        counter: {},
        data,
        message: `Dashboard counter API returned non-success status: ${data?.statusCode}`,
      };
    }

    const rows = Array.isArray(data?.data) ? data.data : [];

    const counter = rows.reduce((acc, item) => {
      if (item?.categoryReference) {
        acc[item.categoryReference] = Number(item.nbReferrals ?? 0);
      }
      return acc;
    }, {});

    return {
      success: true,
      counter,
      data,
      message: null,
    };
  } catch (err) {
    return {
      success: false,
      counter: {},
      data: null,
      message: `Global Catch error: ${err.message}`,
    };
  }
};

export default fetchDashboardCounter;

// GET https://referralprogram.globemedsaudi.com/referrals/dashboard-counter
// {
//     "data": [
//         {
//             "categoryReference": "pending",
//             "category": "Pending Referrals",
//             "nbReferrals": 0,
//             "icon": "access_time"
//         },
//         {
//             "categoryReference": "accepted",
//             "category": "Accepted Referrals",
//             "nbReferrals": 0,
//             "icon": "done"
//         },
//         {
//             "categoryReference": "confirmed",
//             "category": "Confirmed Referrals",
//             "nbReferrals": 504,
//             "icon": "done_all"
//         },
//         {
//             "categoryReference": "admitted",
//             "category": "Admitted Requests",
//             "nbReferrals": 333,
//             "icon": "local_hospital"
//         },
//         {
//             "categoryReference": "discharged",
//             "category": "Discharged Requests",
//             "nbReferrals": 159,
//             "icon": "exit_to_app"
//         },
//         {
//             "categoryReference": "declined",
//             "category": "Declined Requests",
//             "nbReferrals": 1,
//             "icon": "block"
//         }
//     ],
//     "statusCode": "Success",
//     "errorMessage": null
// }
