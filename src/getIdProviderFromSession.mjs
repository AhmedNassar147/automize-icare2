/*
 *
 * Helper: `getIdProviderFromSession`.
 *
 * Reads the logged-in user's `provider_code` claim straight from the
 * portal's own auth endpoint, the same source it uses internally to
 * derive `idProvider` for accept-referral calls.
 */
const getIdProviderFromSession = async (page) => {
  try {
    const claims = await page.evaluate(async () => {
      const res = await fetch("/bff/user?slide=false", {
        headers: { "X-CSRF": "1", "Accept-Language": "en-US,en;q=0.9" },
        credentials: "include",
      });

      if (!res.ok) return null;

      return res.json();
    });

    if (!Array.isArray(claims)) return null;

    return (
      claims.find((claim) => claim?.type === "provider_code")?.value || null
    );
  } catch {
    return null;
  }
};

export default getIdProviderFromSession;
