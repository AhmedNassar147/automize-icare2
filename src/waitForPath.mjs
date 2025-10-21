/*
 *
 * Helper: `waitForPath`.
 *
 */
const waitForPath = async (
  page,
  targetPath = "/dashboard/referral",
  timeout = 5 * 60 * 1000
) => {
  const normalize = (s) => s.replace(/\/+$/, "").toLowerCase();
  const wanted = normalize(targetPath);

  const hardP = page
    .waitForNavigation({ waitUntil: "domcontentloaded", timeout })
    .then(() => true)
    .catch(() => false);

  const spaP = page
    .waitForFunction(
      (wantedPath) => {
        const path = new URL(location.href).pathname
          .replace(/\/+$/, "")
          .toLowerCase();
        return path.endsWith(wantedPath);
      },
      { timeout },
      wanted
    )
    .then(() => true)
    .catch(() => false);

  const first = await Promise.race([hardP, spaP]);
  if (!first) return false;

  return page.evaluate((wantedPath) => {
    const p = new URL(location.href).pathname.replace(/\/+$/, "").toLowerCase();
    return p.endsWith(wantedPath);
  }, wanted);
};

export default waitForPath;
