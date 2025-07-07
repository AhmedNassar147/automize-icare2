/*
 *
 * Helper: `collectPatientAttachments`.
 *
 */
import humanClick from "./humanClick.mjs";
import isElementInvisible from "./isElementInvisible.mjs";
import scrollIntoView from "./scrollIntoView.mjs";
import extractExtensionFromContentDisposition from "./extractExtensionFromContentDisposition.mjs";

const collectPatientAttachments = async ({
  page,
  cursor,
  patientName,
  specialty,
  viewportHeight,
  referralId,
}) => {
  const downloadIndexes = await page.$$eval(
    'button[type="button"]',
    (buttons) =>
      buttons
        .map((btn, idx) => ({
          index: idx,
          text: btn.innerText.trim().toLowerCase(),
        }))
        .filter((b) => b.text.includes("download"))
        .map((b) => b.index)
  );

  const allButtons = await page.$$('button[type="button"]');
  const validDownloadButtons = downloadIndexes.map((i) => allButtons[i]);

  const logString = `for patientName=${patientName} referralId=${referralId} specialty=${specialty}`;

  if (!validDownloadButtons.length) {
    console.log(`⚠️ No valid download buttons found ${logString}`);
    return [];
  }

  console.log(`✅ collecting attachments ${logString}`);

  const downloadedFiles = [];

  for (const btn of validDownloadButtons) {
    try {
      // Scroll the button into view
      const isButtonInvisible = await isElementInvisible(btn, viewportHeight);

      if (isButtonInvisible) {
        console.log("⚡ Attempting to scroll to download button...");
        await scrollIntoView(page, cursor, btn);
      }

      console.log("⚡ Waiting for file response and clicking button...");

      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/referrals/download-attachment") &&
            res.status() === 200 &&
            res.request().method() === "GET",
          { timeout: 13_000 }
        ),
        humanClick(page, cursor, btn),
      ]);

      if (!response) {
        console.log(
          `⚠️ invalid response after clicking download ${logString}.`
        );
        continue;
      }

      const contentType = response.headers()["content-type"] || "";
      if (!contentType.includes("application")) {
        console.log("❌ Skipping due to unexpected content-type:", contentType);
        continue;
      }

      const cd = response.headers()["content-disposition"] || "";
      const extension = extractExtensionFromContentDisposition(cd);
      const buffer = await response.buffer();

      const fileName = `${referralId}_${specialty || ""}.${extension}`;

      downloadedFiles.push({
        fileName,
        extension,
        fileBase64: buffer.toString("base64"),
      });

      console.log(`✅ Downloaded: ${fileName} ${logString}`);
    } catch (err) {
      console.error(`❌ Error downloading ${logString}:`, err);
    }
  }

  return downloadedFiles;
};

export default collectPatientAttachments;
