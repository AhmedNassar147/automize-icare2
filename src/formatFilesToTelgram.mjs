/*
 *
 * Helper: `formatFilesToTelegram`.
 *
 */
import containsExcludedText from "./containsExcludedText.mjs";
import createConsoleMessage from "./createConsoleMessage.mjs";

const getBase64SizeBytes = (base64) => Math.floor((base64.length * 3) / 4);

const formatFilesToTelegram = async (files) => {
  if (!files?.length) return [];

  const validFiles = files.filter(({ downloadError, fileBase64, fileName }) => {
    if (downloadError || !fileBase64) {
      createConsoleMessage(
        `⚠️ Skipping file ${fileName} — ${downloadError || "no base64"}`,
        "warn",
      );

      return false;
    }

    return true;
  });

  const fileChecks = (
    await Promise.allSettled(
      validFiles.map(async (file) => ({
        file,
        exclude: await containsExcludedText(file),
      })),
    )
  )
    .filter(({ status }) => status === "fulfilled")
    .map(({ value }) => value);

  const formattedFiles = fileChecks
    .filter(({ exclude, file }) => {
      if (exclude) {
        createConsoleMessage(`⏩ Excluding file: ${file.fileName}`, "warn");
      }

      return !exclude;
    })
    .map(({ file }) => file)
    .sort(
      (a, b) =>
        getBase64SizeBytes(b.fileBase64) - getBase64SizeBytes(a.fileBase64),
    );

  return formattedFiles;
};

export default formatFilesToTelegram;
