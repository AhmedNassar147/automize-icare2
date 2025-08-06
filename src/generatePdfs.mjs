/*
 *
 * Helper: `generateAcceptancePdfLetters`.
 *
 */
import os from "os";
import pLimit from "p-limit";
import generateAcceptanceLetterHtml from "./generateAcceptanceLetterHtml.mjs";
import {
  USER_ACTION_TYPES,
  generatedPdfsPathForAcceptance,
  generatedPdfsPathForRejection,
} from "./constants.mjs";

const { ACCEPT, REJECT } = USER_ACTION_TYPES;

const generateAcceptancePdfLetters = async (
  browser,
  patientsArray,
  isAcceptance
) => {
  const cpuCount = os.cpus().length; // Get the number of CPU cores

  const limit = pLimit(Math.min(4, cpuCount)); // Max 3 concurrent tabs

  const tasks = patientsArray.map((patient) =>
    limit(async () => {
      const page = await browser.newPage();
      const html = generateAcceptanceLetterHtml({
        ...patient,
        isRejection: !isAcceptance,
      }); // Assume you already have this
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      await page.bringToFront();

      const { referralId } = patient;

      const fielName = `${isAcceptance ? ACCEPT : REJECT}-${referralId}`;

      const folderPath = isAcceptance
        ? generatedPdfsPathForAcceptance
        : generatedPdfsPathForRejection;

      await page.pdf({
        path: `${folderPath}/${fielName}.pdf`,
        format: "A4",
        // Avoid printBackground: true unless absolutely necessary — it increases size significantly
        printBackground: false,
        margin: {
          top: "10mm",
          bottom: "10mm",
          left: "10mm",
          right: "10mm",
        },
        scale: 1,
      });

      await page.close();
    })
  );

  await Promise.all(tasks);
};

export default generateAcceptancePdfLetters;
