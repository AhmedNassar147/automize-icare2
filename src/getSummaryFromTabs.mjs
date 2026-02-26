/*
 *
 * Helper: `getSummaryFromTabs`.
 *
 */
import getFormattedDateForSummary from "./getFormattedDateForSummary.mjs";
import {
  globMedHeaders,
  baseGlobMedAPiUrl,
  PATIENT_SECTIONS_STATUS,
  TABS_COLLECTION_TYPES,
} from "./constants.mjs";

const globMedBodyData = {
  pageSize: 50_000,
  pageNumber: 1,
  providerZone: [],
  providerName: [],
  specialtyCode: [],
  referralTypeCode: [],
  referralReasonCode: [],
  genericSearch: "",
  // startDate: "2025-08-01",
  // endDate: "2025-08-30",
  sortOrder: "asc",
};

const { ACCEPTED, CONFIRMED, ADMITTED, DISCHARGED } = TABS_COLLECTION_TYPES;

const getSummaryFromTabs = async ({
  page,
  reportStartsAt,
  reportEndsAt,
  includeDeclined = false,
  includeConfirmed = false,
  includeAccepted = false,
}) => {
  const categoryReferences = [
    includeAccepted
      ? PATIENT_SECTIONS_STATUS[ACCEPTED].categoryReference
      : null,
    includeConfirmed
      ? PATIENT_SECTIONS_STATUS[CONFIRMED].categoryReference
      : null,
    PATIENT_SECTIONS_STATUS[ADMITTED].categoryReference,
    PATIENT_SECTIONS_STATUS[DISCHARGED].categoryReference,
    includeDeclined ? "declined" : null,
  ].filter(Boolean);

  const endDate = reportEndsAt
    ? reportEndsAt
    : getFormattedDateForSummary(new Date());

  const tabsResults = await page.evaluate(
    async ({
      baseGlobMedAPiUrl,
      globMedHeaders,
      categoryReferences,
      globMedBodyData,
      reportStartsAt,
      endDate,
    }) => {
      const responses = await Promise.allSettled(
        categoryReferences.map(async (categoryReference) => {
          try {
            const res = await fetch(`${baseGlobMedAPiUrl}/listing`, {
              method: "POST",
              headers: globMedHeaders,
              body: JSON.stringify({
                ...globMedBodyData,
                categoryReference,
                startDate: reportStartsAt || undefined,
                endDate: reportStartsAt ? endDate : undefined,
              }),
            });

            if (!res.ok) {
              return {
                success: false,
                error: `Status ${res.status}`,
                categoryReference,
              };
            }

            const data = await res.json();

            const { data: response, errorMessage } = data;
            const { result } = response || {};

            return {
              categoryReference,
              success: true,
              data: result || [],
              error: errorMessage,
            };
          } catch (err) {
            return {
              success: false,
              error: `Capture error: ${err.message}`,
              categoryReference,
            };
          }
        }),
      );

      return responses.reduce(
        (acc, result) => {
          const { categoryReference, data, error } = result.value || {};
          const isRejectedRequest = result?.status === "rejected";

          if (error || isRejectedRequest) {
            acc.errors.push(
              `❌ ${categoryReference || "unknown"} request ${
                isRejectedRequest ? "rejected" : "error"
              }: ${
                error || result.reason?.message || result.reason || "NOT DATA"
              }`,
            );
          } else {
            if (data?.length) {
              acc.patients.push(
                ...data.map((patient) => ({
                  ...patient,
                  tabName: categoryReference,
                  paid: 0,
                })),
              );
            }
          }

          return acc;
        },
        {
          patients: [],
          errors: [],
        },
      );
    },
    {
      categoryReferences,
      globMedHeaders,
      baseGlobMedAPiUrl,
      globMedBodyData,
      reportStartsAt,
      endDate,
    },
  );

  return tabsResults;
};

export default getSummaryFromTabs;
