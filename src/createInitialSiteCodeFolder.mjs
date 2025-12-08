/*
 *
 * Helper: `createInitialSiteCodeFolder`.
 *
 */
import { writeFile } from "fs/promises";
import generateFolderIfNotExisting from "./generateFolderIfNotExisting.mjs";
import readJsonFile from "./readJsonFile.mjs";
import unlinkAllFastGlob from "./unlinkAllFastGlob.mjs";
import { siteCodeFolderDirectory, siteCodeConfigFile } from "./constants.mjs";

const createInitialSiteCodeFolder = async () => {
  await generateFolderIfNotExisting(siteCodeFolderDirectory);

  const config = await readJsonFile(siteCodeConfigFile, true);

  if (!config) {
    await unlinkAllFastGlob(siteCodeFolderDirectory);

    const newConfig = {
      current: "",
      previous: "",
      lastModifiedAt: "",
    };

    await writeFile(siteCodeConfigFile, JSON.stringify(newConfig, null, 2));
  }
};

export default createInitialSiteCodeFolder;
