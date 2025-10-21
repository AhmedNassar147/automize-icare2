/*
 *
 * Helper: `rewriteReferralDetails`.
 *
 */
import zlib from "zlib";

const RECAPTCHA_RE =
  /(^https?:\/\/(?:www\.)?google\.com\/recaptcha\/)|(^https?:\/\/www\.gstatic\.com\/recaptcha\/)/i;

const rewriteReferralDetails = async (page) => {
  const client = await (page.createCDPSession?.() ||
    page.target().createCDPSession());

  await client.send("Network.enable");
  await client.send("Network.setCacheDisabled", { cacheDisabled: true });
  await client.send("Fetch.enable", {
    patterns: [
      {
        urlPattern:
          "https://referralprogram.globemedsaudi.com/referrals/details*",
        requestStage: "Response",
      },
    ],
  });

  const onPaused = async (e) => {
    const {
      requestId,
      request,
      responseStatusCode = 0,
      responseHeaders = [],
    } = e;

    // Never touch reCAPTCHA or non-POSTs
    if (
      RECAPTCHA_RE.test(request.url) ||
      (request.method || "").toUpperCase() !== "POST"
    ) {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    // Only rewrite successful JSON responses
    if (responseStatusCode < 200 || responseStatusCode >= 300) {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    const bodyInfo = await client
      .send("Fetch.getResponseBody", { requestId })
      .catch(() => null);
    if (!bodyInfo || !bodyInfo.body) {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    // Decode body
    const hdr = new Map(
      responseHeaders.map((h) => [(h.name || "").toLowerCase(), h.value ?? ""])
    );
    const enc = (hdr.get("content-encoding") || "").toLowerCase();
    const ctype = (hdr.get("content-type") || "").toLowerCase();

    let buf = bodyInfo.base64Encoded
      ? Buffer.from(bodyInfo.body, "base64")
      : Buffer.from(bodyInfo.body, "utf8");
    try {
      if (enc.includes("br") && zlib.brotliDecompressSync)
        buf = zlib.brotliDecompressSync(buf);
      else if (enc.includes("gzip")) buf = zlib.gunzipSync(buf);
      else if (enc.includes("deflate")) buf = zlib.inflateSync(buf);
    } catch {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    if (!ctype.includes("application/json")) {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    let json;
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    // ---- Your mutation ----
    if (json?.data) {
      json.data.status = "P";
      json.data.canUpdate = true;
      json.data.canTakeAction = true;
    }
    // -----------------------

    const out = Buffer.from(JSON.stringify(json), "utf8").toString("base64");

    // Normalize headers
    hdr.delete("content-encoding");
    hdr.set("content-type", "application/json; charset=utf-8");
    hdr.delete("etag");
    hdr.delete("last-modified");
    // omit content-length; Chrome will set it based on body

    const responseHeadersOut = Array.from(hdr, ([name, value]) => ({
      name,
      value,
    }));

    await client
      .send("Fetch.fulfillRequest", {
        requestId,
        responseCode: responseStatusCode || 200,
        responseHeaders: responseHeadersOut,
        body: out,
      })
      .catch(async () => {
        await client
          .send("Fetch.continueRequest", { requestId })
          .catch(() => {});
      });
  };

  client.on("Fetch.requestPaused", onPaused);

  const disposerHandler = async () => {
    try {
      await client.send("Fetch.disable");
    } catch {}
    try {
      await client.send("Network.setCacheDisabled", { cacheDisabled: false });
    } catch {}
    try {
      await client.send("Network.disable");
    } catch {}
    client.off("Fetch.requestPaused", onPaused);
  };

  // Clean up on close *and* when the session detaches
  page.once("close", disposerHandler);
  client.once("Detached", disposerHandler);

  return disposerHandler;
};

export default rewriteReferralDetails;
