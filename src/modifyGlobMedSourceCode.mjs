/*
 *
 * Helper: `modifyGlobMedSourceCode`.
 *
 */
// import { readFile, writeFile } from "fs/promises";
import createConsoleMessage from "./createConsoleMessage.mjs";

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

  const rendererName = findReferralRendererName(src, markerIdx);
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

function extractIsLoadingVar(segment) {
  const m = segment.match(/\bisLoading\s*:\s*([A-Za-z_$][\w$]*)\b/);
  return m ? m[1] : null;
}

function makeReferralDetailsApiPoll(sourceCode, refetchType) {
  const anchor = '["referral-details"';
  const idx = sourceCode.indexOf(anchor);
  if (idx === -1) {
    return {
      sourceCode,
      loadingVariable: null,
      patched: false,
      reason: "ReferralDetailsApiPoll: no anchor",
    };
  }

  // Take a small slice after the anchor; tune if needed.
  const WINDOW = 180;
  const start = idx - 17;
  const end = Math.min(sourceCode.length, start + WINDOW);
  let segment = sourceCode.slice(start, end);

  // Match either !0 or !1
  const focusRegex = /refetchOnWindowFocus\s*:\s*!\s*[01]\s*,/;

  if (!focusRegex.test(segment)) {
    return {
      sourceCode,
      loadingVariable: null,
      patched: false,
      reason: "ReferralDetailsApiPoll: no focusRegex",
    };
  }

  const loadingVariable = extractIsLoadingVar(segment);

  if (!loadingVariable) {
    return {
      sourceCode,
      loadingVariable,
      patched: false,
      reason: "ReferralDetailsApiPoll: no loadingVariable",
    };
  }

  // if (refetchType === "focus") {
  //   // force focus refetch on
  //   segment = segment.replace(focusRegex, (m) => m.replace(/!\s*[01]/, "!0"));
  // } else {
  //   // Inject right after refetchOnWindowFocus: !1,
  //   const pollInjection = `refetchInterval:d=>{if(!d||typeof d.status!=="string")return 400;if(d.status!=="P")return!1;const k="__GM_REF_POLL__";if(d.canTakeAction&&d.canUpdate)return window[k]=undefined,!1;const s=window[k]||(window[k]={n:0});let b=165+s.n*48;b=Math.min(b,460);const j=b*.2,m=Math.floor(b-j+Math.random()*(2*j));return s.n++,m},`;
  //   segment = segment.replace(focusRegex, (m) => m + pollInjection);
  // }

  const pollInjection = `refetchInterval:d=>{const t=+window.fetchOnceTime||0;if(!t)return!1;const k="__GM_REFETCH_ONCE__";if(window[k])return!1;window[k]=1;return t;},`;
  segment = segment.replace(focusRegex, (m) => m + pollInjection);

  return {
    sourceCode: sourceCode.slice(0, start) + segment + sourceCode.slice(end),
    loadingVariable,
    patched: true,
  };
}

function findReactCallBoundsEnclosingText(src, text) {
  const idx = src.indexOf(text);
  if (idx === -1) return null;

  // Parse one react call starting at objectName + ".jsx(" or ".jsxs("
  function parseCallFromDot(dotPos, kind) {
    // find start of identifier before ".jsx"
    let start = dotPos - 1;
    while (start >= 0 && /[A-Za-z0-9_$]/.test(src[start])) start--;
    start++;

    const open = dotPos + (kind === "jsxs" ? 5 : 4); // index of '('
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          return { start, end: i + 1, text: src.slice(start, i + 1) };
        }
      }
    }
    return null;
  }

  let best = null;

  // Scan backwards and collect candidates whose call contains idx
  for (let i = idx; i >= 0; i--) {
    if (src[i] !== ".") continue;

    let kind = null;
    if (src.startsWith(".jsx(", i)) kind = "jsx";
    else if (src.startsWith(".jsxs(", i)) kind = "jsxs";
    else continue;

    const c = parseCallFromDot(i, kind);
    if (!c) continue;

    // Does this candidate contain the anchor index?
    if (c.start <= idx && idx < c.end) {
      // pick the OUTERMOST (largest span)
      if (!best || c.end - c.start > best.end - best.start) best = c;
    }
  }

  return best;
}

function findAllEnclosingReactCalls(src, anchorIndex) {
  function parseCallFromDot(dotPos, kind) {
    // find start of identifier before ".jsx"/".jsxs"
    let start = dotPos - 1;
    while (start >= 0 && /[A-Za-z0-9_$]/.test(src[start])) start--;
    start++;

    const open = dotPos + (kind === "jsxs" ? 5 : 4); // points at '('
    let depth = 0;

    for (let i = open; i < src.length; i++) {
      const ch = src[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0)
          return { start, end: i + 1, text: src.slice(start, i + 1) };
      }
    }
    return null;
  }

  const out = [];
  for (let i = anchorIndex; i >= 0; i--) {
    if (src[i] !== ".") continue;

    let kind = null;
    if (src.startsWith(".jsx(", i)) kind = "jsx";
    else if (src.startsWith(".jsxs(", i)) kind = "jsxs";
    else continue;

    const c = parseCallFromDot(i, kind);
    if (!c) continue;

    if (c.start <= anchorIndex && anchorIndex < c.end) out.push(c);
  }

  // smallest first
  out.sort((a, b) => a.end - a.start - (b.end - b.start));
  return out;
}

function findAcceptElementBounds(sectionText) {
  const idx = sectionText.indexOf('("ACCEPT_REFERRAL")');
  if (idx === -1) return null;

  const candidates = findAllEnclosingReactCalls(sectionText, idx);
  if (!candidates.length) return null;

  // Prefer the smallest enclosing call that includes "permission:"
  const withPermission = candidates.find((c) => c.text.includes("permission:"));
  return withPermission || candidates[0];
}

function extractCanTakeActionVar(sectionText) {
  const re = /([A-Za-z_$][\w$]*)(?:\?\.)?\.canTakeAction\b/;
  const m = sectionText.match(re);
  return m ? m[1] : null;
}

function extractOnClickHandler(acceptText) {
  // Matches: onClick: Rt   or   onClick:Rt
  const m = acceptText.match(/onClick\s*:\s*([A-Za-z_$][\w$]*)/);
  return m ? m[1] : null;
}

function removeSpanWithOptionalComma(src, start, end) {
  if (src[end] === ",") return src.slice(0, start) + src.slice(end + 1);
  if (start > 0 && src[start - 1] === ",")
    return src.slice(0, start - 1) + src.slice(end);
  return src.slice(0, start) + src.slice(end);
}

function addOrderStyleAfterAcceptLabelCall(acceptText) {
  // Match: children: <fn>("ACCEPT_REFERRAL")   OR children:<fn>('ACCEPT_REFERRAL')
  // <fn> can be any identifier: s, t, n, _e, etc.
  const re =
    /children\s*:\s*[A-Za-z_$][\w$]*\s*\(\s*(['"])ACCEPT_REFERRAL\1\s*\)\s*,?/;

  const m = acceptText.match(re);
  if (!m) return acceptText; // pattern not found, don't change

  // Insert *after* the matched children call.
  // If the match already ended with a comma, we don't add an extra comma.
  return acceptText.replace(re, (full) => {
    const endsWithComma = /,\s*$/.test(full);
    return endsWithComma
      ? full + "style:{order:2},"
      : full + ",style:{order:2},";
  });
}

function moveAcceptButtonToTopLevelChildren(
  sectionText,
  variableName,
  acceptButtonObject
) {
  const guard =
    `(!!${variableName}&&(` +
    `${variableName}==null?void 0:${variableName}.status` +
    `)==="P")&&`;

  // 1) Remove original ACCEPT (swallow adjacent comma safely)
  let next = removeSpanWithOptionalComma(
    sectionText,
    acceptButtonObject.start,
    acceptButtonObject.end
  );

  // 2) Create the copied ACCEPT with order style
  const acceptWithOrder = addOrderStyleAfterAcceptLabelCall(
    acceptButtonObject.text
  );

  // 3) Insert into top-level children array
  const key = "children:[";
  const ci = next.indexOf(key);
  if (ci === -1) return sectionText;

  const insertPos = ci + key.length;

  next =
    next.slice(0, insertPos) +
    guard +
    acceptWithOrder +
    "," +
    next.slice(insertPos);

  // 4) Cleanup common artifacts
  next = next.replace(/,\s*\]/g, "]");
  next = next.replace(/\[\s*,/g, "[");
  next = next.replace(/,\s*,/g, ",");

  return next;
}

const addFilesFromLocalStorage = (sourceCode, acceptButton) => {
  const handlerName = extractOnClickHandler(acceptButton);
  if (!handlerName) return sourceCode; // safely skip this patch

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
  const WINDOW_SIZE = 3600;
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

  return sourceCode;
};

function disableReferralLoadingNearBreadcrumb(src, loadingVar) {
  const anchor = '"REFERRAL_DETAILS")';
  const idx = src.indexOf(anchor);
  if (idx === -1) return src;

  // Window bounds
  const start = Math.max(0, idx - 175);
  const end = Math.min(src.length, idx + 600);

  let segment = src.slice(start, end);

  // Match:  <A>||<B> ? p.jsx( ... ) :   (spaces optional)
  // We only replace B (the second var) with !1.
  //
  // Examples matched:
  //   return sr||cr?p.jsx(yC,{}):p.jsxs(...)
  //   return Ab || Cd ? p.jsx(Xy,{}) : ...
  //
  const re =
    /(\b[A-Za-z_$][\w$]*\b)\s*\|\|\s*(\b[A-Za-z_$][\w$]*\b)\s*\?\s*[A-Za-z_$][\w$]*\.jsx\(/;

  const m = segment.match(re);
  if (!m) return src;

  const firstVar = m[1]; // was "sr" in your example, but can be anything

  const pairRe = new RegExp(
    `\\b${firstVar}\\b\\s*\\|\\|\\s*\\b${loadingVar}\\b`
  );

  segment = segment.replace(pairRe, `${firstVar} || !1`);

  // Rebuild source
  return src.slice(0, start) + segment + src.slice(end);
}

function makeNotVarRegex(varName) {
  // Matches:
  //   !cr&&
  //   !cr&&!0
  //   !cr?
  //   !cr )
  return new RegExp(`!\\s*${varName}\\s*(?=&&|\\?|!|\\))`, "g");
}

// REFETCH_TYPE = "poll" | "focus";

function modifyGlobMedSourceCode(code) {
  // const REFETCH_TYPE = "";
  const { REFETCH_TYPE } = process.env;
  let _sourceCode = code;

  // if (REFETCH_TYPE) {
  // createConsoleMessage(`📋 REFETCH_TYPE => ${REFETCH_TYPE}`, "info");
  // _sourceCode = makeReferralDetailsApiPoll(_sourceCode, REFETCH_TYPE);
  // }

  const {
    loadingVariable,
    patched,
    sourceCode: srccode,
    reason,
  } = makeReferralDetailsApiPoll(_sourceCode, REFETCH_TYPE);

  _sourceCode = disableReferralLoadingNearBreadcrumb(srccode, loadingVariable);

  let sourceCode = cleanupTrailingCommaBeforeArrayClose(
    insertRendererBeforePatientInfo(_sourceCode, loadingVariable)
  );

  const section = findReactCallBoundsEnclosingText(
    sourceCode,
    "referral-button-container"
  );
  if (!section || !section.text) return sourceCode;

  let sectionText = section.text;

  const variableName = extractCanTakeActionVar(sectionText);
  if (!variableName) return sectionText;

  let accept = findAcceptElementBounds(sectionText);
  if (!accept || !accept.text) return sourceCode;

  if (!REFETCH_TYPE) {
    const pattern = new RegExp(
      `${variableName}\\s*&&\\s*\\(\\s*${variableName}\\s*==\\s*null\\s*\\?\\s*void\\s+0\\s*:\\s*${variableName}\\.status\\s*\\)\\s*===\\s*"P"`,
      "g"
    );

    sectionText = sectionText.replace(pattern, `!0`);
    sectionText = sectionText.replace(`${variableName}.canTakeAction`, "!0");
    sectionText = sectionText.replace(`${variableName}.canUpdate`, "!0");
  } else if (REFETCH_TYPE === "poll") {
    accept = findAcceptElementBounds(sectionText);

    sectionText = moveAcceptButtonToTopLevelChildren(
      sectionText,
      variableName,
      accept
    );
  }

  if (!accept || !accept.text) return sourceCode;

  const guardRegex = makeNotVarRegex(loadingVariable);
  sectionText = sectionText.replace(guardRegex, "!0");

  sourceCode =
    sourceCode.slice(0, section.start) +
    sectionText +
    sourceCode.slice(section.end);

  sourceCode = addFilesFromLocalStorage(sourceCode, accept.text);

  // window.__PATCHED_BUNDLE__= true;
  return `console.log("<<< PATCHED BUNDLE LOADED >>>");${sourceCode}`;
}

// const filePath = process.cwd() + "/original-gm-index.js";
// const sourceCode = await readFile(filePath, "utf8");

// const modifiedCode = modifyGlobMedSourceCode(sourceCode);
// console.log("modifiedCode", modifiedCode);
// const mdsFilePath = process.cwd() + "/original-gm-index-modfs.js";
// await writeFile(mdsFilePath, modifiedCode);

export default modifyGlobMedSourceCode;
