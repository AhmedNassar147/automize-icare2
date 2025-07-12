/*
 *
 * Helper: `closePageSafely`.
 *
 */
const closePageSafely = async (page) => {
  if (page && !page.isClosed()) {
    await page.close().catch(() => {});
  }
};

export default closePageSafely;
