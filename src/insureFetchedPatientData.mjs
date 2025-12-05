/*
 *
 * Helper: `insureFetchedPatientData`.
 *
 */
import sleep from "./sleep.mjs";

/**
 * Try `fn` up to `maxAttempts` times.
 * - fn must return patientData (object) or throw.
 * - If patientData contains internal error flags, we consider it a failure and retry.
 * - Returns the successful patientData, or the last patientData (may contain errors), or null.
 */
const insureFetchedPatientData = async (
  fn,
  maxAttempts = 2,
  baseBackoffMs = 1000
) => {
  let lastPatientData = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const patientData = await fn();
      lastPatientData = patientData;

      const { patientDetailsError, patientInfoError, attchmentsError } =
        patientData || {};

      // If internal errors, retry (unless last attempt)
      if (patientDetailsError || patientInfoError || attchmentsError) {
        if (attempt < maxAttempts) {
          const wait = baseBackoffMs + Math.random() * 1000;
          console.log(
            `[${new Date().toLocaleTimeString()}] ⚠️ attempt ${attempt} returned internal errors, retrying in ${Math.round(
              wait
            )}ms...`
          );
          await sleep(wait);
          continue;
        }

        // last attempt: return lastPatientData (may contain errors)
        return lastPatientData;
      }

      // success
      return patientData;
    } catch (err) {
      // fn threw — retry unless we exhausted attempts
      if (attempt < maxAttempts) {
        const wait = baseBackoffMs + Math.random() * 1000;
        console.log(
          `[${new Date().toLocaleTimeString()}] ⚠️ attempt ${attempt} threw (${
            err.message
          }), retrying in ${Math.round(wait)}ms...`
        );
        await sleep(wait);
        continue;
      }

      console.log(
        `[${new Date().toLocaleTimeString()}] ❌ all ${maxAttempts} attempts failed (last error: ${
          err.message
        })`
      );
      return lastPatientData; // maybe null
    }
  }

  return lastPatientData;
};

export default insureFetchedPatientData;
