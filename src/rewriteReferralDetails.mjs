import zlib from "zlib";

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
    const { requestId, request, responseStatusCode, responseHeaders } = e;

    if ((request.method || "").toUpperCase() !== "POST") {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    const bodyInfo = await client
      .send("Fetch.getResponseBody", { requestId })
      .catch(() => null);
    if (!bodyInfo) {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    let buf = bodyInfo.base64Encoded
      ? Buffer.from(bodyInfo.body, "base64")
      : Buffer.from(bodyInfo.body || "", "utf8");

    const hdr = new Map(
      (responseHeaders || []).map((h) => [
        (h.name || "").toLowerCase(),
        h.value ?? "",
      ])
    );
    const enc = (hdr.get("content-encoding") || "").toLowerCase();

    try {
      if (enc.includes("gzip")) buf = zlib.gunzipSync(buf);
      else if (enc.includes("deflate")) buf = zlib.inflateSync(buf);
      else if (enc.includes("br") && zlib.brotliDecompressSync)
        buf = zlib.brotliDecompressSync(buf);
    } catch {}

    let json;
    try {
      json = JSON.parse(buf.toString("utf8"));
    } catch {
      await client.send("Fetch.continueRequest", { requestId }).catch(() => {});
      return;
    }

    // Your mutation
    if (json?.data) {
      json.data.status = "P";
      json.data.canUpdate = true;
      json.data.canTakeAction = true;
    }

    const out = JSON.stringify(json);

    hdr.delete("content-encoding");
    hdr.set("content-type", "application/json; charset=utf-8");
    hdr.set("content-length", Buffer.byteLength(out, "utf8").toString());

    const responseHeadersOut = Array.from(hdr, ([name, value]) => ({
      name,
      value,
    }));

    await client
      .send("Fetch.fulfillRequest", {
        requestId,
        responseCode: responseStatusCode || 200,
        responseHeaders: responseHeadersOut,
        body: Buffer.from(out, "utf8").toString("base64"),
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

  page.once("close", disposerHandler);

  return disposerHandler;
};

export default rewriteReferralDetails;
