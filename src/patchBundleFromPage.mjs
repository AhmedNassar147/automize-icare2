/*
 *
 * Helper: `patchBundleFromPage`.
 *
 */
import { writeFile, unlink } from "fs/promises";
import { basename, join, dirname, normalize } from "path";
import modifyGlobMedSourceCode from "./modifyGlobMedSourceCode.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";
import generateFolderIfNotExisting from "./generateFolderIfNotExisting.mjs";
import formateDateToString from "./formateDateToString.mjs";
import speakText from "./speakText.mjs";
import { siteCodeConfigFile } from "./constants.mjs";
import readJsonFile from "./readJsonFile.mjs";
import checkPathExists from "./checkPathExists.mjs";

const getOverridePathForUrl = (bundleUrl) => {
  const url = new URL(bundleUrl);

  const overridesFolder = join(
    process.env.USER_PROFILE_PATH,
    "Default",
    "Overrides"
  );

  return normalize(
    join(
      overridesFolder,
      url.hostname,
      ...url.pathname.split("/").filter(Boolean)
    )
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

  const overridePath = getOverridePathForUrl(bundleUrl);

  if (config.current) {
    speakText({
      text: `Get Ahmed Nassar, globemed changed there code (${originalFileName})`,
      times: 20,
      useMaleVoice: true,
      volume: 100,
    });

    const isFileExists = await checkPathExists(overridePath);

    if (isFileExists) {
      await unlink(overridePath);
    }

    createConsoleMessage(
      `✅ Need to make real chrome points to new (${originalFileName})`,
      "warn"
    );
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
