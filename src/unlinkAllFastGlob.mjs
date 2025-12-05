/*
 *
 * Helper: `unlinkAllFastGlob`.
 *
 */
import fg from "fast-glob";
import { unlink } from "fs/promises";

const unlinkAllFastGlob = async (folderPath) => {
  const files = await fg("**/*", {
    cwd: folderPath,
    absolute: true,
    onlyFiles: true,
    dot: true,
    concurrency: 64, // default is already fast
    followSymbolicLinks: false,
  });

  if (!files?.length) return false;

  await Promise.allSettled(files.map((file) => unlink(file)));
};

export default unlinkAllFastGlob;
