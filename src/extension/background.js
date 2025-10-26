const URL_PAT = "*://referralprogram.globemedsaudi.com/referrals/details*";

function tryParseJSON(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    try {
      const filter = browser.webRequest.filterResponseData(details.requestId);
      const dec = new TextDecoder("utf-8");
      const enc = new TextEncoder();
      let buf = "";

      filter.ondata = (e) => {
        buf += dec.decode(e.data, { stream: true });
      };
      filter.onstop = () => {
        buf += dec.decode();
        let out = buf;

        const json = tryParseJSON(buf);
        if (json && json.data && typeof json.data === "object") {
          json.data.status = "P";
          json.data.canUpdate = true;
          json.data.canTakeAction = true;
          out = JSON.stringify(json);
          // console.log("[ext] modified /referrals/details");
        }

        try {
          filter.write(enc.encode(out));
        } catch {}
        filter.disconnect();
      };
      filter.onerror = (err) => {
        try {
          filter.disconnect();
        } catch {}
      };
    } catch (e) {
      // If filter creation fails, do nothing (fallback to original response)
    }
    return {};
  },
  { urls: [URL_PAT], types: ["xmlhttprequest", "fetch"] },
  ["blocking", "responseHeaders"]
);
