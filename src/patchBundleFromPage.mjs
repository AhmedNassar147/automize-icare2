/*
 *
 * Helper: `patchBundleFromPage`.
 *
 */
import { writeFile } from "fs/promises";
import { basename } from "path";
import modifyGlobMedSourceCode from "./modifyGlobMedSourceCode.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import formateDateToString from "./formateDateToString.mjs";
import readJsonFile from "./readJsonFile.mjs";
import unlinkAllFastGlob from "./unlinkAllFastGlob.mjs";
import { siteCodeConfigFile, siteCodeFolderDirectory } from "./constants.mjs";

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

  const orginalFileName = basename(new URL(bundleUrl).pathname);
  const config = await readJsonFile(siteCodeConfigFile, true);

  if (config.current === orginalFileName) {
    createConsoleMessage(
      `✅ Original bundle unchanged (${orginalFileName}), skipping...`,
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
  await unlinkAllFastGlob(siteCodeFolderDirectory);

  const lastModifiedAt = formateDateToString(new Date());

  const newConfig = {
    previous: config.current,
    current: orginalFileName,
    lastModifiedAt: lastModifiedAt,
  };

  const outputPath = `${siteCodeFolderDirectory}/index-patched.js`;
  const orginalFileNamePath = `${siteCodeFolderDirectory}/${orginalFileName}`;

  await Promise.allSettled([
    writeFile(siteCodeConfigFile, JSON.stringify(newConfig, null, 2)),
    writeFile(orginalFileNamePath, originalBody),
    writeFile(outputPath, patchedBody),
  ]);

  createConsoleMessage(`✅ Patched bundle written to: ${outputPath}`, "info");
}

export default patchBundleFromPage;
