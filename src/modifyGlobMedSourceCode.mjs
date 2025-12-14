/*
 *
 * Helper: `modifyGlobMedSourceCode`.
 *
 */
// import { readFile, writeFile } from "fs/promises";

function findReferralRendererName(src, markerIdx) {
  const marker = "referral-button-container";

  const re =
    /(^|[^\w$])([A-Za-z_$][\w$]*)\s*=\s*\(\s*\)\s*=>\s*p\.jsx?s?\s*\(/gm;

  let bestName = null;
  let bestStart = -1;

  for (const m of src.matchAll(re)) {
    const name = m[2];
    const start = m.index ?? -1;
    if (start < 0 || start > markerIdx) continue;

    // Check a forward window from this renderer start includes the marker
    const snippet = src.slice(start, Math.min(src.length, start + 20000));
    if (!snippet.includes(marker)) continue;

    // pick the closest one before marker
    if (start > bestStart) {
      bestStart = start;
      bestName = name;
    }
  }

  return bestName;
}

function removeAllRendererInvocations(src, rendererName) {
  // Remove call-sites like:  ni(),   or   ni()   (optionally with trailing comma)
  // but DO NOT touch: ni = () => ...
  const callRe = new RegExp(
    `(^|[\\[,\\s])${rendererName}\\s*\\(\\s*\\)\\s*,?`,
    "g"
  );

  return src.replace(callRe, (m, prefix) => prefix);
}

function findEnclosingReactCallStart(src, anchorIdx) {
  // Search backwards a bit for the nearest p.jsx( or p.jsxs( that encloses the anchor
  const backStart = Math.max(0, anchorIdx - 6000);
  const back = src.slice(backStart, anchorIdx);

  const jsxIdx = back.lastIndexOf("p.jsx(");
  const jsxsIdx = back.lastIndexOf("p.jsxs(");

  const rel = Math.max(jsxIdx, jsxsIdx);
  if (rel === -1) return -1;

  return backStart + rel;
}

function insertRendererBeforePatientInfo(src) {
  const marker = "referral-button-container";
  const markerIdx = src.indexOf(marker);
  if (markerIdx === -1) return src;

  const rendererName = findReferralRendererName(src);
  if (!rendererName) return src;

  const winStart = Math.max(0, markerIdx - 80);
  const winEnd = Math.min(src.length, markerIdx + 30_000);

  let win = src.slice(winStart, winEnd);

  const anchorIdx = win.indexOf(".VIEW_PATIENT_INFORMATION");
  if (anchorIdx === -1) return src;

  // Remove existing invocation(s) inside this window so we don’t duplicate
  win = removeAllRendererInvocations(win, rendererName);

  const callStart = findEnclosingReactCallStart(win, anchorIdx);
  if (callStart === -1) return src;

  // Insert as an array item before the patient-info element
  win = win.slice(0, callStart) + `${rendererName}(),` + win.slice(callStart);

  return src.slice(0, winStart) + win + src.slice(winEnd);
}

function cleanupTrailingCommaBeforeArrayClose(src) {
  return src.replace(/,\s*\]/g, "]");
}

function injectRefetchIntervalNearReferralDetails(sourceCode) {
  const anchor = '["referral-details"';
  const idx = sourceCode.indexOf(anchor);
  if (idx === -1) return sourceCode;

  // Take a small slice after the anchor; tune if needed.
  const WINDOW = 180;
  const start = idx;
  const end = Math.min(sourceCode.length, start + WINDOW);
  let segment = sourceCode.slice(start, end);

  // Find refetchOnWindowFocus: !1, (with or without spaces)
  const focusRegex = /refetchOnWindowFocus\s*:\s*!1\s*,/;

  if (!focusRegex.test(segment)) {
    // If the window is too small, increase WINDOW above.
    return sourceCode;
  }

  // Inject right after refetchOnWindowFocus: !1,
  const injection = `refetchInterval:d=>{if(!d||typeof d.status!=="string")return 600;if(d.status!=="P")return!1;const k="__GM_REF_POLL__";if(d.canTakeAction&&d.canUpdate)return window[k]=undefined,!1;const s=window[k]||(window[k]={n:0});let b=210+s.n*50;b=Math.min(b,500);const j=b*.2,m=Math.floor(b-j+Math.random()*(2*j));return s.n++,m},`;
  segment = segment.replace(focusRegex, (m) => m + injection);

  return sourceCode.slice(0, start) + segment + sourceCode.slice(end);
}

function modifyGlobMedSourceCode(code) {
  const _sourceCode = injectRefetchIntervalNearReferralDetails(code);

  let sourceCode = cleanupTrailingCommaBeforeArrayClose(
    insertRendererBeforePatientInfo(_sourceCode)
  );

  // 2) Find the button with className `referral-button-container...` and grab its onClick handler name
  const buttonRegex =
    /className:\s*[`'"]referral-button-container[\s\S]*?[`'"][\s\S]{0,400}?onClick:\s*(\w+)/;
  const buttonMatch = sourceCode.match(buttonRegex);

  if (!buttonMatch) {
    // Couldn't find that specific button – don't modify anything
    return sourceCode;
  }

  const handlerName = buttonMatch[1]; // e.g. "Rt"

  // 2) Find where that handler starts: "Rt = async (...) => {"
  const handlerStartRegex = new RegExp(
    handlerName + "\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*{"
  );
  const startMatch = sourceCode.match(handlerStartRegex);

  if (!startMatch) {
    return sourceCode;
  }

  const startIndex = startMatch.index;
  if (startIndex == null || startIndex < 0) {
    return sourceCode;
  }

  // 3) Take a window after the start of the handler (3.5k chars worked for you)
  const WINDOW_SIZE = 3500;
  const windowStart = startIndex;
  const windowEnd = Math.min(sourceCode.length, windowStart + WINDOW_SIZE);
  let segment = sourceCode.slice(windowStart, windowEnd);

  // 4) Inside that segment, find which variable is assigned to `files:`
  const filesVarRegex = /files:\s*([A-Za-z_$][\w$]*)/;
  const filesMatch = segment.match(filesVarRegex);

  if (!filesMatch) {
    // No `files: <var>` in this slice – bail out
    return sourceCode;
  }

  const filesVarName = filesMatch[1]; // e.g. "Ot"

  // 5) Build a regex that finds `<filesVarName> = await Promise.all(...)`
  //    We capture the Promise.all(...) part as group 1 so we can reuse it.
  const promiseRegex = new RegExp(
    filesVarName + "\\s*=\\s*await\\s*(Promise\\.all\\([\\s\\S]*?\\));"
  );

  if (!promiseRegex.test(segment)) {
    // No `<filesVarName> = await Promise.all(...)` in this slice – bail out
    return sourceCode;
  }

  // 6) Replace with: <var> = JSON.parse(...) || await Promise.all(...)
  segment = segment.replace(
    promiseRegex,
    filesVarName +
      '=JSON.parse(localStorage.getItem("GM__FILS")||"null")||' +
      "(await $1);"
  );

  // 7) Rebuild the sourceCode with the patched segment
  sourceCode =
    sourceCode.slice(0, windowStart) + segment + sourceCode.slice(windowEnd);

  // window.__PATCHED_BUNDLE__= true;
  return `console.log("<<< PATCHED BUNDLE LOADED >>>");${sourceCode}`;
}

// const filePath = process.cwd() + "/original-gm-index.js";
// const sourceCode = await readFile(filePath, "utf8");

// const mdsFilePath = process.cwd() + "/original-gm-index-modfs.js";
// await writeFile(mdsFilePath, modifyGlobMedSourceCode(sourceCode));

export default modifyGlobMedSourceCode;
