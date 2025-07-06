/*
 *
 * Helper: `processHomeTableAndCollectPatients`.
 *
 */
import scrollIntoView from "../scrollIntoView.mjs";
import humanClick from "../humanClick.mjs";
import collectReferralDetailsFromApis from "./collectReferralDetailsFromApis.mjs";
import sleep from "../sleep.mjs";
import moveFromCurrentToRandomPosition from "../moveFromCurrentToRandomPosition.mjs";
import { homePageTableSelector, dashboardLinkSelector } from "../constants.mjs";

const safeFileName = (str) => str.replace(/[^a-z0-9_-]/gi, "_");

const extractExtensionFromContentDisposition = (contentDisposition) => {
  // Try UTF-8 filename*= first
  const utf8Match = contentDisposition.match(
    /filename\*\=UTF-8''[^.]+\.(\w+)/i
  );
  if (utf8Match) return utf8Match[1].toLowerCase();

  // Fallback to basic filename
  const fallbackMatch = contentDisposition.match(/filename="?[^.]+\.(\w+)"?/i);
  if (fallbackMatch) return fallbackMatch[1].toLowerCase();

  return "pdf"; // Default fallback
};

const collectAttachments = async ({ page, cursor, patientName, specialty }) => {
  const buttonHandles = await page.$$('button[type="button"]');
  const validDownloadButtons = [];

  for (const btn of buttonHandles) {
    const text = await btn.evaluate((el) => el.innerText.trim().toLowerCase());

    if (text.includes("download")) {
      validDownloadButtons.push(btn);
    }
  }

  const downloadedFiles = [];

  if (!validDownloadButtons.length) {
    return downloadedFiles;
  }

  for (const btn of validDownloadButtons) {
    try {
      await scrollIntoView(page, cursor, btn);
      await moveFromCurrentToRandomPosition(cursor);

      const responsePromise = page.waitForResponse(
        (res) =>
          res.url().includes("/referrals/download-attachment") &&
          res.status() === 200
      );

      await humanClick(page, cursor, btn);

      const response = await responsePromise;
      const cd = response.headers()["content-disposition"] || "";
      const extension = extractExtensionFromContentDisposition(cd);
      const buffer = await response.buffer();

      const fileName = `${safeFileName(patientName)}_${safeFileName(
        specialty
      )}.${extension}`;

      downloadedFiles.push({
        fileName: fileName,
        extension: extension,
        fileBase64: buffer.toString("base64"),
      });

      await sleep(300 + Math.random() * 400);
    } catch (err) {
      console.error(
        `❌ Error downloading for patient=(${patientName}) specialty=(${specialty})`,
        err
      );
    }
  }

  return downloadedFiles;
};

const processHomeTableAndCollectPatients = async ({
  page,
  cursor,
  alreadyCollectedIds,
}) => {
  const currentCollectdListId = [...(alreadyCollectedIds || [])];
  const newlyCollectedPatients = [];

  let rows = [];
  try {
    rows = await page.$$(`${homePageTableSelector} tbody tr`);
  } catch (error) {
    console.log("❌ Error reading home table:", error.message);
    rows = [];
  }

  console.log(`📋 Found "${rows.length}" rows to process.`);

  if (!rows || !rows.length) {
    return [];
  }

  for (let i = 0; i < rows.length; i++) {
    const rowId = i + 1;
    console.log(`\n👉 Processing row ${rowId} of ${rows.length}`);

    const row = rows[i];

    const referralId = await row.$eval(
      "td:nth-child(2) span",
      (el) => el.textContent?.trim() || ""
    );

    if (!referralId || currentCollectdListId.includes(referralId)) {
      console.log(`⏩ Skipping already processed referralId: ${referralId}`);
      continue;
    }

    const button = await row.$("td:last-child button");
    if (!button) {
      console.log("⚠️ No button found in this row, skipping...");
      continue;
    }

    await scrollIntoView(page, cursor, button);

    const box = await button.boundingBox();
    if (!box) {
      console.log("⚠️ Button has no visible box, skipping...");
    }

    await moveFromCurrentToRandomPosition(cursor);

    const apiWaiter = collectReferralDetailsFromApis(page, referralId);

    await cursor.click(button, {
      clickCount: 1,
      moveDelay: 80 + Math.random(),
      randomizeMoveDelay: 20 + Math.random() * 20,
      radius: 4,
      hesitate: 5,
    });

    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    await sleep(350 + Math.random() * 300);

    await moveFromCurrentToRandomPosition(cursor);

    // Light keyboard simulation
    await page.keyboard.press("Tab");
    await sleep(200 + Math.random() * 300); // 200–500ms
    await page.keyboard.press("ArrowDown");

    // Find collapsible section to scroll
    let target = null;
    try {
      const sections = await page.$$(
        "section.collapsible-container.MuiBox-root"
      );
      for (let j = sections.length - 1; j >= 0; j--) {
        const box = await sections[j].boundingBox();
        if (box) {
          target = sections[j];
          break;
        }
      }
    } catch (_) {}

    await scrollIntoView(page, cursor, target);
    await sleep(170 + Math.random() * 300);
    await moveFromCurrentToRandomPosition(cursor);

    const data = await apiWaiter;

    const { patientName, specialty } = data || {};

    if (!data) {
      console.warn(
        `⚠️ Incomplete data for referralId: ${referralId}. Skipping.`
      );
      continue;
    }

    const attachmentData = await collectAttachments({
      page,
      cursor,
      patientName,
      specialty,
    });

    const finalData = {
      ...(data || null),
      attachments: attachmentData,
    };

    currentCollectdListId.push(referralId);
    newlyCollectedPatients.push(finalData);

    await humanClick(page, cursor, dashboardLinkSelector);

    await page.waitForNavigation({
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });

    await moveFromCurrentToRandomPosition(cursor);
    await sleep(300 + Math.random() * 400); // Simulate load time
  }

  return newlyCollectedPatients;
};

export default processHomeTableAndCollectPatients;
