/*
 *
 * Helper: `ensureNoiseBlocking`.
 *
 */
import { BLOCK_PATHS, NOTES_PATH_RE } from "./constants.mjs";

const ensureNoiseBlocking = async (page) => {
  await page.setRequestInterception(true);
  const requestHandler = (req) => {
    const urlStr = req.url();

    let url;
    try {
      url = new URL(urlStr);
    } catch (error) {
      console.log("ERROR when parsing url", urlStr);
      return req.continue();
    }

    if (url) {
      const urlPath = url.pathname;
      const isBlockMatch =
        BLOCK_PATHS.has(urlPath) || NOTES_PATH_RE.test(urlPath);

      if (isBlockMatch) {
        try {
          return req.abort();
        } catch {
          return;
        }
      }
    }

    try {
      return req.continue();
    } catch {
      return;
    }
  };

  page.on("request", requestHandler);
  page.once("close", () => page.off("request", requestHandler));
};

export default ensureNoiseBlocking;
