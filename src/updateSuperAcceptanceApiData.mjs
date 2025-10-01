/*
 *
 * Helper: `updateSuperAcceptanceApiData`.
 *
 */
import { writeFile } from "fs/promises";

import { SUPPER_ACCEPTACNE_RESULTS_FILE_PATH } from "./constants.mjs";
import readJsonFile from "./readJsonFile.mjs";
import checkPathExists from "./checkPathExists.mjs";

const updateSuperAcceptanceApiData = async (
  referralId,
  superAcceptanaceData,
  apiData
) => {
  const isFileExists = await checkPathExists(
    SUPPER_ACCEPTACNE_RESULTS_FILE_PATH
  );

  if (!isFileExists) {
    await writeFile(
      SUPPER_ACCEPTACNE_RESULTS_FILE_PATH,
      JSON.stringify({}, null, 2),
      "utf8"
    );
  }

  const fileContent =
    (await readJsonFile(SUPPER_ACCEPTACNE_RESULTS_FILE_PATH, true)) || {};

  let _superAcceptanaceData = fileContent?.superAcceptanaceData || {};

  if (superAcceptanaceData?.body) {
    const { files, ...otherData } = superAcceptanaceData.body;

    const [fileData] = files || [];
    const { fileName, ...otherFileData } = fileData || {};

    _superAcceptanaceData = {
      files: [
        {
          fileName: (fileName || "").substring(0, 60),
          ...otherFileData,
        },
      ],
      ...otherData,
    };
  }

  const fileData = {
    ...(fileContent || null),
    [referralId]: {
      superAcceptanaceData: _superAcceptanaceData,
      apiData: apiData || fileContent?.apiData,
    },
  };

  try {
    await writeFile(
      SUPPER_ACCEPTACNE_RESULTS_FILE_PATH,
      JSON.stringify(fileData, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error(
      `An Error occurred while writing the file: ${SUPPER_ACCEPTACNE_RESULTS_FILE_PATH}`,
      error
    );
  }
};

export default updateSuperAcceptanceApiData;
