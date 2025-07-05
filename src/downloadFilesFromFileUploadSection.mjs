/*
 *
 * Helper: `downloadDocuments`.
 *
 */
const headerTitles = ["name", "size", "type", "uploaded by", "actions"];

const downloadFilesFromFileUploadSection = async (
  page,
  referralId,
  specialty
) => {
  // Find the "File Upload" section by heading text
  const [section] = await page.$x(
    "//section[contains(@class, 'collapsible-container')]//h2[text()='File Upload']/ancestor::section"
  );
  if (!section) {
    console.log(
      `❌ Could not find File Upload section for referralId=${referralId} specialty=${specialty}`
    );
    return [];
  }

  // Get all row elements (MuiGrid-container divs) inside that section
  const allRowElements = await section.$$("div.MuiGrid-container");

  const files = [];

  for (const rowEl of allRowElements) {
    // Extract columns text in this row
    const columns = await rowEl.$$eval("div.MuiGrid-item", (els) =>
      els.map((el) => el.innerText.trim())
    );

    if (columns.length === 0) continue;

    const firstColLower = columns[0].toLowerCase();

    // Skip if header row or missing download button
    if (headerTitles.some((title) => firstColLower.includes(title))) continue;

    const button = await rowEl.$("button");
    if (!button) continue;

    // Build filename: use label (third column) + name (first column)
    const rawFileName = columns[0];
    const label = columns[2] || "";
    const baseName = rawFileName.replace(/\.[^/.]+$/, "");
    const fileName = `${label || ""} ${baseName}`.trim();

    const extMatch = rawFileName.match(/\.(pdf|png|jpe?g)$/i);
    if (!extMatch) continue;

    const extension = extMatch[1].toLowerCase();

    // Click download and wait for response with matching URL containing 'download'
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.status() === 200 &&
          res.url().toLowerCase().includes("referrals/download-attachment") &&
          res.request().method() === "GET"
      ),
      button.click(),
    ]);

    const buffer = await response.buffer();
    const fileBase64 = buffer.toString("base64");

    files.push({
      fileName: `referralId=${referralId}-specialty=${specialty}-${fileName}`,
      extension,
      fileBase64,
    });
  }

  return files;
};

export default downloadFilesFromFileUploadSection;

// [
//   {
//     fileName: "Medical Report 1122766551",
//     extension: "pdf",
//     fileBase64:
//       "JVBERi0xLjcKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwvTGluZWFyaXplZCAxL0wgMTM3MjYvTyA2L0UgMTI4MTQvTiAxL1QgMTMzNjI+PgplbmRvYmoK",
//   },
//   {
//     fileName: "Medical Report __احالة بيبي امل حسن001_",
//     extension: "pdf",
//     fileBase64:
//       "JVBERi0xLjcKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwvTGluZWFyaXplZCAxL0wgMTM3MjYvTyA2L0UgMTI4MTQvTiAxL1QgMTMzNjI+PgplbmRvYmoK",
//   },
// ];
