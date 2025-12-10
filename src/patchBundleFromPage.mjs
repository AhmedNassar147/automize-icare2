/*
 *
 * Helper: `patchBundleFromPage`.
 *
 */
import { writeFile } from "fs/promises";
import { basename, join, dirname } from "path";
import modifyGlobMedSourceCode from "./modifyGlobMedSourceCode.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import generateFolderIfNotExisting from "./generateFolderIfNotExisting.mjs";
import formateDateToString from "./formateDateToString.mjs";
import readJsonFile from "./readJsonFile.mjs";
import { siteCodeConfigFile } from "./constants.mjs";

const getOverridePathForUrl = (bundleUrl) => {
  const url = new URL(bundleUrl);

  const overridesFolder = join(
    process.env.USER_PROFILE_PATH,
    "Default",
    "Overrides"
  );

  return join(
    overridesFolder,
    url.hostname,
    ...url.pathname.split("/").filter(Boolean)
  );
};

async function saveToChromeOverrides(filePath, patchedCode) {
  const folderPath = dirname(filePath);

  await generateFolderIfNotExisting(folderPath);
  await writeFile(filePath, patchedCode, "utf8");
}

async function patchBundleFromPage(page) {
  const { error: bundleUrlError, bundleUrl } = await page.evaluate(async () => {
    const scripts = Array.from(document.querySelectorAll("script[src]"));
    const bundleUrl = scripts
      .map((s) => s.src)
      .find((src) => /\/assets\/index-.*\.js$/.test(src));

    if (!bundleUrl) {
      return {
        error: "❌ Could not find /assets/index-*.js bundle URL on the page",
      };
    }

    return {
      error: undefined,
      bundleUrl,
    };
  });

  if (bundleUrlError) {
    createConsoleMessage(bundleUrlError, "error");
    return;
  }

  createConsoleMessage(`✅ Detected bundle URL: ${bundleUrl}`, "info");

  const originalFileName = basename(new URL(bundleUrl).pathname);
  const config = await readJsonFile(siteCodeConfigFile, true);

  if (config.current === originalFileName) {
    createConsoleMessage(
      `✅ Original bundle unchanged (${originalFileName}), skipping...`,
      "info"
    );
    return;
  }

  // 2) FETCH INSIDE THE BROWSER so cookies/headers are used
  const { error, originalBody } = await page.evaluate(async (bundleUrl) => {
    const res = await fetch(bundleUrl, {
      credentials: "include", // send cookies
      cache: "no-cache",
    });
    if (!res.ok) {
      return {
        error: `❌ Failed to fetch bundle: ${res.status} ${res.statusText}`,
        bundleUrl,
        originalBody: undefined,
      };
    }
    const code = await res.text();
    return {
      error: undefined,
      bundleUrl,
      originalBody: code,
    };
  }, bundleUrl);

  if (error || !originalBody) {
    createConsoleMessage(error || "❌ Failed to fetch bundle", "error");
    return;
  }

  // 3) Patch it in Node
  createConsoleMessage("✅ Patching bundle", "info");
  const patchedBody = modifyGlobMedSourceCode(originalBody);

  if (!patchedBody.includes("GM__FILS")) {
    createConsoleMessage(
      `❌ The patched source hasn't the GM__FILS variable, skipping...`,
      "error"
    );

    return;
  }

  // 4) Write into Chrome Overrides
  const overridePath = getOverridePathForUrl(bundleUrl);
  await saveToChromeOverrides(overridePath, patchedBody);

  const lastModifiedAt = formateDateToString(new Date());

  const newConfig = {
    previous: config.current,
    current: originalFileName,
    overridePath,
    lastModifiedAt,
  };

  await writeFile(siteCodeConfigFile, JSON.stringify(newConfig, null, 2));

  createConsoleMessage(
    `✅ Patched bundle written to Chrome Overrides: \n${overridePath}`,
    "info"
  );
}

export default patchBundleFromPage;
