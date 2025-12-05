/*
 *
 * Helper: `createReloadAndCheckIfShouldCreateNewPage`.
 *
 */
import createConsoleMessage from "./createConsoleMessage.mjs";

const createReloadAndCheckIfShouldCreateNewPage =
  (pauseController, pausableSleep, INTERVAL) =>
  async (page, logString = "") => {
    try {
      const intervalTime = INTERVAL + Math.random() * 9000;

      await pauseController.waitIfPaused();

      if (!page || !page?.reload) {
        await pausableSleep(intervalTime);

        createConsoleMessage(
          `Will recreate page on next loop iteration, refreshing in ${
            intervalTime / 1000
          }s...`,
          "warn"
        );
        return true;
      }

      createConsoleMessage(
        `${logString} refreshing in ${intervalTime / 1000}s...`,
        "info"
      );
      await pausableSleep(intervalTime);

      await pauseController.waitIfPaused();
      await page.reload({ waitUntil: "domcontentloaded" });
    } catch (err) {
      const intervalTime = INTERVAL + Math.random() * 11_000;
      await pausableSleep(intervalTime);

      createConsoleMessage(
        err,
        "error",
        `Will recreate page on next loop iteration, refreshing in ${
          intervalTime / 1000
        }s...`
      );
      return true;
    }
  };

export default createReloadAndCheckIfShouldCreateNewPage;
