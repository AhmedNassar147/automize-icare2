/*
 *
 * Helper: `extractDetailsSectionsByTitle`.
 *
 */

const toCamelCase = (str) =>
  str
    .replace(/[^a-zA-Z0-9 ]/g, "") // Remove non-alphanumerics
    .replace(/^[A-Z]/, (m) => m.toLowerCase()) // Lowercase first char
    .replace(/ ([a-zA-Z])/g, (_, g1) => g1.toUpperCase()); // Space to capital

const extractDetailsSectionsByTitle = async (page, titles) => {
  const result = {};

  for (const title of titles) {
    const sectionHandle = await page.$x(
      `//h2[contains(text(), "${title}")]/ancestor::section`
    );

    if (sectionHandle.length === 0) {
      continue;
    }

    const section = sectionHandle[0];
    const key = toCamelCase(title);

    if (title === "Patient Information" || title === "Case Details") {
      result[key] = await section.evaluate(() => {
        const toCamelCase = (str) =>
          str
            .replace(/[^a-zA-Z0-9 ]/g, "")
            .replace(/^[A-Z]/, (m) => m.toLowerCase())
            .replace(/ ([a-zA-Z])/g, (_, g1) => g1.toUpperCase());

        const entries = {};
        document.querySelectorAll(".grid-item").forEach((item) => {
          const titleEl = item.querySelector(".item-title");
          const valueEl = item.querySelector(".item-description");
          if (titleEl && valueEl) {
            const key = toCamelCase((titleEl.textContent || "").trim());
            entries[key] = (valueEl.textContent || "").trim();
          }
        });
        return entries;
      });
    } else if (title === "ICD") {
      result[key] = await section.evaluate(() => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        return rows
          .map((row) => {
            const cells = row.querySelectorAll("td");

            const code = cells[0]?.textContent?.trim() || "";
            const description = cells[1]?.textContent?.trim() || "";

            if (!code && !description) return null;

            return {
              code,
              description,
              isDefault: cells[2]?.textContent?.trim() || "",
            };
          })
          .filter(Boolean);
      });
    } else if (title === "Procedure") {
      result[key] = await section.evaluate(() => {
        const rows = Array.from(document.querySelectorAll("tbody tr"));
        return rows
          .map((row) => {
            const cells = row.querySelectorAll("td");

            const code = cells[0]?.textContent?.trim() || "";
            const description = cells[1]?.textContent?.trim() || "";

            if (!code && !description) return null;

            return {
              code,
              description,
              estimatedCost: cells[2]?.textContent?.trim() || "",
              estimatedQty: cells[3]?.textContent?.trim() || "",
            };
          })
          .filter(Boolean);
      });
    }
  }

  return result;
};

export default extractDetailsSectionsByTitle;

// const result = {
//   patientInformation: {
//     dOB: "June 11, 2025",
//     hijriDOB: "Dhu al-Hijjah 15, 1446 AH",
//     firstName: "amal",
//     fatherName: "hasan",
//     lastName: "saeed",
//     gender: "Female",
//     mobileNumber: "+966501564641",
//     nationality: "SAUDI"
//   },
//   caseDetails: {
//     requestDate: "2025-06-22T17:35:34",
//     referralType: "Emergency",
//     subReferralType: "HP",
//     referralCause: "Bed Unavailable",
//     providerZone: "Asir",
//     sourceProvider: "Al-Khamis Maternity and Children Hospital",
//     mainSpecialty: "Obstetrics & Gynecology",
//     subSpecialty: "Obstetrics & Gynecology",
//     physician: "NA",
//     physicianMobilePhone: "NA",
//     requestedBedType: "Neonatal Intensive Care Unit (NICU)",
//     claimReference: "NA",
//     referralReasonDetails: "NICU",
//     additionalInformation: "NA"
//   },
//   icd: [
//     {
//       code: "O00.0",
//       description: "O00.0 - Abdominal pregnancy (15)",
//       isDefault: "Yes"
//     }
//   ],
//   procedure: [
//     {
//       code: "N.1",
//       description: `N.1 - "NICU First week (SR/Day) N.1*
// Medication above 350 SR per day as per SFDA price list, Blood & blood products, MRI,
// CT, ECHO, Doppler , CRRT , Surgical and endoscopic procedure are an excluded
// serviceTo get re-imbused for medication above the daily "`,
//       estimatedCost: "0",
//       estimatedQty: "0"
//     }
//   ]
// };
