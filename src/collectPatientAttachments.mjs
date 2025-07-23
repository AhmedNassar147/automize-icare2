/*
 *
 * Helper: `collectPatientAttachments`.
 *
 */
import humanClick from "./humanClick.mjs";
import scrollIntoView from "./scrollIntoView.mjs";
import extractExtensionFromContentDisposition from "./extractExtensionFromContentDisposition.mjs";
import sleep from "./sleep.mjs";

const collectPatientAttachments = async ({
  page,
  cursor,
  patientName,
  specialty,
  referralId,
}) => {
  const downloadButtons = await page.$$eval(
    'button[type="button"]',
    (buttons) =>
      buttons
        .map((btn, idx) => ({
          index: idx,
          text: btn.innerText.trim().toLowerCase(),
          icon: btn.querySelector("span.material-icons")?.innerText,
        }))
        .filter(
          (b) =>
            b.text.includes("download") ||
            b.icon?.toLowerCase().includes("download_2")
        )
        .map((b) => b.index)
  );

  const allButtons = await page.$$('button[type="button"]');

  const validDownloadButtons = downloadButtons.map((i) => allButtons[i]);

  const logString = `for patientName=${patientName} referralId=${referralId} specialty=${specialty}`;

  if (!validDownloadButtons.length) {
    console.log(`⚠️ No valid download buttons found ${logString}`);
    return [];
  }

  console.log(`✅ collecting attachments ${logString}`);

  const downloadedFiles = [];

  for (const btn of validDownloadButtons) {
    try {
      await scrollIntoView(page, cursor, btn);

      console.log("⚡ Waiting for file response and clicking button...");

      const [response] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes("/referrals/download-attachment/") &&
            res.status() >= 200 &&
            res.status() < 300 &&
            res.request().method() === "GET",
          { timeout: 17_000 }
        ),
        (async () => {
          await sleep(180);
          await humanClick(page, btn);
        })(),
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
      console.error(`❌ Error downloading ${logString}: ${err.message}`);
    }
  }

  return downloadedFiles;
};

export default collectPatientAttachments;
