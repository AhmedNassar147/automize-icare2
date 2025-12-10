/*
 *
 * Helper: `checkSiteCodeConfig`.
 *
 */
import { writeFile } from "fs/promises";
import readJsonFile from "./readJsonFile.mjs";
import { siteCodeConfigFile } from "./constants.mjs";

const checkSiteCodeConfig = async () => {
  const config = await readJsonFile(siteCodeConfigFile, true);

  if (!config) {
    const newConfig = {
      current: "",
      previous: "",
      lastModifiedAt: "",
    };

    await writeFile(siteCodeConfigFile, JSON.stringify(newConfig, null, 2));
  }
};

export default checkSiteCodeConfig;
