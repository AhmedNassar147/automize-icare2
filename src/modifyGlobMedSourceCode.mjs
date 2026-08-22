/*
 *
 * Helper: `modifyGlobMedSourceCode`.
 *
 */
import { readFile, writeFile } from "fs/promises";
import createConsoleMessage from "./createConsoleMessage.mjs";

function findReferralRendererName(src, markerIdx) {
  const marker = "referral-button-container";

  // const re =
  //   /(^|[^\w$])([A-Za-z_$][\w$]*)\s*=\s*\(\s*\)\s*=>\s*h\.jsx?s?\s*\(/gm;

  const re =
    /(^|[^\w$])([A-Za-z_$][\w$]*)\s*=\s*\(\s*\)\s*=>\s*(?:[A-Za-z_$][\w$]*)\s*\.\s*jsxs?\s*\(/gm;

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
    "g",
  );

  return src.replace(callRe, (m, prefix) => prefix);
}

const getReactAlias = (src) => {
  const [, reactAliasMatch] = src.match(
    /\b([A-Za-z_$][\w$]*)\.(?:jsx|jsxs)\s*\(/,
  );

  return reactAliasMatch || "h";
};

function findEnclosingReactCallStart(src, anchorIdx) {
  // Search backwards a bit for the nearest p.jsx( or p.jsxs( that encloses the anchor
  const backStart = Math.max(0, anchorIdx - 6000);
  const back = src.slice(backStart, anchorIdx);

  const reactAliasMatch = getReactAlias(back);
  const jsxIdx = back.lastIndexOf(`${reactAliasMatch}.jsx(`);
  const jsxsIdx = back.lastIndexOf(`${reactAliasMatch}.jsxs(`);

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

const makeApisExposeRefetch = (sourceCode, apiId, refetchName) => {
  const pattern = new RegExp(
    `\\{\\s*data:\\s*([A-Za-z_$][\\w$]*),\\s*error:\\s*([A-Za-z_$][\\w$]*),\\s*isLoading:\\s*([A-Za-z_$][\\w$]*),?\\s*\\}\\s*=\\s*([A-Za-z_$][\\w$]*)\\(\\s*\\[\\s*"${apiId}",`,
  );

  return sourceCode.replace(
    pattern,
    (matched, dataVarName, errorVarName, isLoadingVarName, functionName) =>
      `{data:${dataVarName},error:${errorVarName},isLoading:${isLoadingVarName},refetch:${refetchName}}=${functionName}(["${apiId}",`,
  );
};

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
  acceptButtonObject,
) {
  const guard =
    `(!!${variableName}&&(` +
    `${variableName}==null?void 0:${variableName}.status` +
    `)==="P")&&`;

  // 1) Remove original ACCEPT (swallow adjacent comma safely)
  let next = removeSpanWithOptionalComma(
    sectionText,
    acceptButtonObject.start,
    acceptButtonObject.end,
  );

  // 2) Create the copied ACCEPT with order style
  const acceptWithOrder = addOrderStyleAfterAcceptLabelCall(
    acceptButtonObject.text,
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

const addFilesFromLocalStorage = (sourceCode, acceptHandlerName) => {
  if (!acceptHandlerName) return sourceCode; // safely skip this patch

  // 2) Find where that handler starts: "Rt = async (...) => {"
  const handlerStartRegex = new RegExp(
    acceptHandlerName + "\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*{",
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
  const WINDOW_SIZE = 1500;
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

  const filesVarName = filesMatch[1]; // e.g. "St"

  // 5) Build a regex that finds `<filesVarName> = await Promise.all(...)`
  //    We capture the Promise.all(...) part as group 1 so we can reuse it.
  const promiseRegex = new RegExp(
    filesVarName + "\\s*=\\s*await\\s*(Promise\\.all\\([\\s\\S]*?\\));",
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
      "(await $1);",
  );

  // const handlerWithBraceRegex = new RegExp(
  //   "(" + acceptHandlerName + "\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*{)",
  // );

  // const injectedCode =
  //   // 'const waitingTime=Number(localStorage.getItem("GM__TIME")||0);if(waitingTime>0){typeof refetchReferralDetails==="function"&&await refetchReferralDetails();await new Promise(r=>setTimeout(r,waitingTime));}';
  //   'const waitingTime=Number(localStorage.getItem("GM__TIME")||0);if(waitingTime>0){await new Promise(r=>setTimeout(r,waitingTime));}';

  // segment = segment.replace(handlerWithBraceRegex, `$1${injectedCode}`);

  // 7) Rebuild the sourceCode with the patched segment
  sourceCode =
    sourceCode.slice(0, windowStart) + segment + sourceCode.slice(windowEnd);

  return sourceCode;
};

function extractRecaptchaHandlerInfo(sourceCode, acceptHandlerName) {
  if (!acceptHandlerName) return null;

  // const handlerStartRegex = new RegExp(
  //   acceptHandlerName + "\\s*=\\s*async\\s*\\(\\s*\\)\\s*=>\\s*{",
  // );

  const handlerStartRegex = new RegExp(
    acceptHandlerName + "\\s*=\\s*async\\s*\\([^)]*\\)\\s*=>\\s*{",
  );

  const startMatch = sourceCode.match(handlerStartRegex);
  if (!startMatch) return null;

  const windowStart = startMatch.index;
  const windowEnd = Math.min(sourceCode.length, windowStart + 4000);
  const segment = sourceCode.slice(windowStart, windowEnd);

  const referralIdVarMatch = segment.match(
    /referralId:\s*([A-Za-z_$][\w$]*)\s*,/,
  );
  const tokenCallMatch = segment.match(
    /const\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+([A-Za-z_$][\w$]*)\(\)\s*;/,
  );

  if (!referralIdVarMatch || !tokenCallMatch) return null;

  return {
    windowStart,
    windowEnd,
    referralIdVar: referralIdVarMatch[1],
    resultVarName: tokenCallMatch[1],
    triggerFnName: tokenCallMatch[2],
    fullTokenCallMatch: tokenCallMatch[0],
  };
}

const addTokenFromLocalStorage = (
  sourceCode,
  acceptHandlerName,
  recaptchaInfo,
) => {
  const info =
    recaptchaInfo || extractRecaptchaHandlerInfo(sourceCode, acceptHandlerName);

  if (!info) {
    console.warn(
      "[GM] addTokenFromLocalStorage: could not resolve recaptcha handler info",
    );
    return sourceCode;
  }

  const { referralIdVar, resultVarName, triggerFnName, fullTokenCallMatch } =
    info;

  // Re-locate the match fresh in whatever sourceCode we're actually given —
  // don't trust cached windowStart/windowEnd offsets, since earlier patches
  // (e.g. addPrepareButton) may have shifted everything after their
  // insertion point.
  const matchIndex = sourceCode.indexOf(fullTokenCallMatch);
  if (matchIndex === -1) {
    console.warn(
      "[GM] addTokenFromLocalStorage: fullTokenCallMatch not found in current sourceCode",
    );
    return sourceCode;
  }

  // const replacement =
  //   `const ${resultVarName}=await(async()=>{` +
  //   `const storeKey="GM__CPTCHA_TKN_"+${referralIdVar};` +
  //   `const raw=localStorage.getItem(storeKey);` +
  //   `try{` +
  //   `if(raw){` +
  //   `const parsed=JSON.parse(raw);` +
  //   `localStorage.removeItem(storeKey);` +
  //   `return{success:true,token:parsed.token,message:"cached"};` +
  //   `}else{` +
  //   `console.log("[GM] Not using cached token for",${referralIdVar});` +
  //   `alert("[GM] Fix: Couldn't find the cached token for "+${referralIdVar}+" in localStorage");` +
  //   `return {};` +
  //   `}` +
  //   `}catch(e){alert("[GM] Cached token parse failed for",${referralIdVar},e);return {}}` +
  //   `})();`;

  const replacement =
    `const ${resultVarName}=await(async()=>{` +
    `const storeKey="GM__CPTCHA_TKN_"+${referralIdVar};` +
    `const raw=localStorage.getItem(storeKey);` +
    `try{` +
    `if(raw){` +
    `const parsed=JSON.parse(raw);` +
    `localStorage.removeItem(storeKey);` +
    `return{success:true,token:parsed.token,message:"cached"};` +
    `}else{` +
    `console.log("[GM] Not using cached token for",${referralIdVar});` +
    `alert("[GM] Fix: Couldn't find the cached token for "+${referralIdVar}+" in localStorage");` +
    // `return await ${triggerFnName}();` +
    `return {};` +
    `}` +
    `}catch(e){alert("[GM] Cached token parse failed for "+${referralIdVar}+": "+e);return {};}` +
    `})();`;

  return (
    sourceCode.slice(0, matchIndex) +
    replacement +
    sourceCode.slice(matchIndex + fullTokenCallMatch.length)
  );
};

const addPrepareButton = (
  sectionText,
  acceptButtonObject,
  acceptHandlerName,
  recaptchaTriggerFnName,
) => {
  const injectedOnClick =
    "onClick:async (e) => {" +
    "const btn=e.currentTarget;" +
    "if (btn.disabled)return;" +
    "btn.disabled=true;" +
    "try{" +
    `if(localStorage.getItem("usesCachedTokenFlow")==="1"){` +
    `const stateReferralId=window.history.state?.usr?.idReferral;` +
    `const storeKey="GM__CPTCHA_TKN_" + stateReferralId;` +
    "const t1=performance.now();" +
    `const result=await ${recaptchaTriggerFnName}();` +
    "const t2=performance.now();" +
    "localStorage.setItem(storeKey, JSON.stringify(result));" +
    `const logName="GM__TOKEN_TIME_" + stateReferralId;` +
    "const elapsedMs=Math.floor(t2 - t1);" +
    "console.log(logName, elapsedMs);" +
    `const autoAcceptAfterMs=Number(localStorage.getItem("autoAcceptAfterMs") || 0);` +
    `if(autoAcceptAfterMs>0){` +
    `const maxWait=Number(localStorage.getItem("maxWait") || 0);` +
    `const waitMs=Math.max(maxWait,autoAcceptAfterMs-elapsedMs);` +
    `console.log(logName+"__autoAcceptAfterMs",autoAcceptAfterMs,"__waitMs__", waitMs);` +
    `setTimeout(()=>{` +
    `const acceptBtn=document.querySelector(".referral-button-container button.MuiButton-containedPrimary:not([data-gm-prepare])");` +
    `if(acceptBtn){` +
    `acceptBtn.click();` +
    `}` +
    `},waitMs);` +
    `}` +
    `}` +
    "}catch(err){" +
    `console.log("[GM] Prepare failed:", err);` +
    "}finally{" +
    "btn.disabled=false;" +
    `btn.style.backgroundColor="yellow";` +
    "}" +
    "}";
  const { start, text } = acceptButtonObject;

  const prepareButton = text
    .replace(/,children:[^,}]+\}\)\}\)$/, ',children:"Prepare"})})')
    .replace(/onClick:\s*([A-Za-z_$][\w$]*)/, injectedOnClick)
    .replace(/(size:\s*"small")/, '$1,"data-gm-prepare":"1"');

  return (
    sectionText.slice(0, start) + prepareButton + "," + sectionText.slice(start)
  );
};

const getDashboardButtonAliases = (sourceCode) => {
  const idx = sourceCode.indexOf('"CREATE_REFERRAL"');
  if (idx === -1) return null;

  const snippet = sourceCode.slice(Math.max(0, idx - 600), idx + 50);

  const btnMatch = snippet.match(
    /children:\s*[A-Za-z_$][\w$]*\.jsx\(([A-Za-z_$][\w$]*),\s*\{\s*variant:\s*"contained"/,
  );

  const iconMatch = snippet.match(
    /[A-Za-z_$][\w$]*\.jsx\(([A-Za-z_$][\w$]*),\s*\{\s*children:\s*"add"\s*\}/,
  );

  if (!btnMatch || !iconMatch) return null;

  return { btnAlias: btnMatch[1], iconAlias: iconMatch[1] };
};

const addSettingsToDashboard = (sourceCode) => {
  const btnPattern =
    /(children:\s*[A-Za-z_$][\w$]*\s*\(\s*"CREATE_REFERRAL"\s*\)\s*\}\)\s*\}\))(\])/;

  if (!btnPattern.test(sourceCode)) {
    console.warn("[GM] addSettingsToDashboard: button anchor not found");
    return sourceCode;
  }

  const dialogPattern = /(categoryReference:[^\]]+\]\}\))(\])/;

  if (!dialogPattern.test(sourceCode)) {
    console.warn("[GM] addSettingsToDashboard: dialog anchor not found");
    return sourceCode;
  }

  const reactAlias = getReactAlias(sourceCode);
  const aliases = getDashboardButtonAliases(sourceCode);

  if (!aliases) {
    console.warn("[GM] addSettingsToDashboard: button aliases not found");
    return sourceCode;
  }

  const { btnAlias, iconAlias } = aliases;

  const CSS =
    `#gm-dialog{border:none;border-radius:8px;padding:24px;min-width:360px;box-shadow:0 11px 15px rgba(0,0,0,0.2);font-family:Roboto,sans-serif;}` +
    `#gm-dialog::backdrop{background:rgba(0,0,0,0.5);}` +
    `#gm-dialog h2{margin:0 0 20px;font-size:1.25rem;font-weight:500;color:white;}` +
    `#gm-dialog label{display:block;font-size:0.875rem;color:white;margin-bottom:4px;}` +
    `#gm-dialog input[type=number]{width:100%;padding:8px 12px;border:1px solid rgba(0,0,0,0.23);border-radius:4px;font-size:1rem;box-sizing:border-box;outline:none;transition:border-color 0.2s;}` +
    `#gm-dialog input[type=number]:focus{border-color:#1976d2;border-width:2px;}` +
    `#gm-dialog .gm-field{margin-bottom:16px;}` +
    `#gm-dialog .gm-input-row{display:flex;align-items:center;gap:8px;}` +
    `#gm-dialog .gm-input-row input{flex:1;}` +
    `#gm-dialog .gm-seconds{font-size:0.875rem;color:white;white-space:nowrap;min-width:48px;}` +
    `#gm-dialog .gm-checkbox-row{display:flex;align-items:center;gap:8px;margin-bottom:16px;}` +
    `#gm-dialog .gm-checkbox-row input[type=checkbox]{width:18px;height:18px;cursor:pointer;}` +
    `#gm-dialog .gm-checkbox-row span{font-size:0.875rem;color:white;}` +
    `#gm-dialog .gm-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;}` +
    `#gm-dialog button{padding:6px 16px;border-radius:4px;font-size:0.875rem;font-weight:500;cursor:pointer;border:none;text-transform:uppercase;letter-spacing:0.02857em;}` +
    `#gm-dialog .gm-btn-cancel{background:transparent;color:#1976d2;}` +
    `#gm-dialog .gm-btn-cancel:hover{background:rgba(25,118,210,0.04);}` +
    `#gm-dialog .gm-btn-save{background:#1976d2;color:#fff;}` +
    `#gm-dialog .gm-btn-save:hover{background:#1565c0;}`;

  const onClickHandler =
    `async()=>{` +
    `const dialog=document.getElementById('gm-dialog');` +
    `if(!dialog)return;` +
    `if(!dialog.dataset.init){` +
    `dialog.dataset.init='1';` +
    `const style=document.createElement('style');` +
    `style.textContent='${CSS}';` +
    `document.head.appendChild(style);` +
    `const enforceMax4=function(){if(this.value.length>4)this.value=this.value.slice(0,4);};` +
    `const updateSeconds=(inputId,spanId)=>{` +
    `const input=document.getElementById(inputId);` +
    `const span=document.getElementById(spanId);` +
    `if(!input||!span)return;` +
    `input.addEventListener('input',function(){` +
    `enforceMax4.call(this);` +
    `const ms=parseInt(this.value,10);` +
    `span.textContent=isNaN(ms)||ms<=0?'':(ms/1000).toFixed(3)+'s';` +
    `});` +
    `};` +
    `updateSeconds('gm-wait-input','gm-wait-seconds');` +
    `updateSeconds('gm-extra-input','gm-extra-seconds');` +
    `document.getElementById('gm-cancel')?.addEventListener('click',()=>dialog.close());` +
    `document.getElementById('gm-extra-check')?.addEventListener('change',function(){` +
    `document.getElementById('gm-extra-field').style.display=this.checked?'block':'none';` +
    `});` +
    `document.getElementById('gm-save')?.addEventListener('click',async()=>{` +
    `const waitVal=parseInt(document.getElementById('gm-wait-input')?.value,10);` +
    `const ec=document.getElementById('gm-extra-check');` +
    `const extraVal=ec?.checked?parseInt(document.getElementById('gm-extra-input')?.value,10):undefined;` +
    `try{` +
    `await fetch('https://localhost:8443/settings',{` +
    `method:'POST',` +
    `headers:{'Content-Type':'application/json'},` +
    `body:JSON.stringify({whatsAppWait:waitVal,waitBeforeReady:extraVal})` +
    `});` +
    `}catch(e){console.log('[GM] save settings failed',e);}` +
    `dialog.close();` +
    `});` +
    `dialog.addEventListener('click',function(e){` +
    `const rect=dialog.getBoundingClientRect();` +
    `if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();` +
    `});` +
    `}` +
    // Load values from API on every open
    `const waitInput=document.getElementById('gm-wait-input');` +
    `const waitSeconds=document.getElementById('gm-wait-seconds');` +
    `const extraCheck=document.getElementById('gm-extra-check');` +
    `const extraField=document.getElementById('gm-extra-field');` +
    `const extraInput=document.getElementById('gm-extra-input');` +
    `const extraSeconds=document.getElementById('gm-extra-seconds');` +
    `try{` +
    `const res=await fetch('https://localhost:8443/settings');` +
    `const settings=await res.json();` +
    `if(waitInput)waitInput.value=settings.whatsAppWait||'';` +
    `if(waitSeconds&&settings.whatsAppWait)waitSeconds.textContent=(settings.whatsAppWait/1000).toFixed(3)+'s';` +
    `const hasExtra=!!settings.waitBeforeReady;` +
    `if(extraCheck)extraCheck.checked=hasExtra;` +
    `if(extraField)extraField.style.display=hasExtra?'block':'none';` +
    `if(extraInput)extraInput.value=settings.waitBeforeReady||'';` +
    `if(extraSeconds&&settings.waitBeforeReady)extraSeconds.textContent=(settings.waitBeforeReady/1000).toFixed(3)+'s';` +
    `}catch(e){console.log('[GM] load settings failed',e);}` +
    `dialog.showModal();` +
    `}`;

  // Inject settings button into dashboard button row
  const settingsBtn =
    `,${reactAlias}.jsx(${btnAlias},{variant:"contained",color:"primary",size:"small",` +
    `startIcon:${reactAlias}.jsx(${iconAlias},{children:"settings"}),` +
    `onClick:${onClickHandler},` +
    `children:"😉 Settings"})`;

  sourceCode = sourceCode.replace(
    btnPattern,
    (_, before, bracket) => before + settingsBtn + bracket,
  );

  // Inject dialog as native React element into dashboard JSX
  const dialogEl =
    `,${reactAlias}.jsx("dialog",{id:"gm-dialog",children:[` +
    `${reactAlias}.jsx("h2",{children:"Set Settings for next patient"}),` +
    `${reactAlias}.jsx("div",{className:"gm-field",children:[` +
    `${reactAlias}.jsx("label",{children:"WAIT_FOR_ACCEPT_MS (whatsapp) (ms)"}),` +
    `${reactAlias}.jsx("div",{className:"gm-input-row",children:[` +
    `${reactAlias}.jsx("input",{id:"gm-wait-input",type:"number",min:0,step:1,placeholder:"e.g. 1975"}),` +
    `${reactAlias}.jsx("span",{id:"gm-wait-seconds",className:"gm-seconds"})` +
    `]})` +
    `]}),` +
    `${reactAlias}.jsx("div",{className:"gm-checkbox-row",children:[` +
    `${reactAlias}.jsx("input",{id:"gm-extra-check",type:"checkbox"}),` +
    `${reactAlias}.jsx("span",{children:"Enter in last second"})` +
    `]}),` +
    `${reactAlias}.jsx("div",{id:"gm-extra-field",className:"gm-field",style:{display:"none"},children:[` +
    `${reactAlias}.jsx("label",{children:"How long to wait before ready (ms)"}),` +
    `${reactAlias}.jsx("div",{className:"gm-input-row",children:[` +
    `${reactAlias}.jsx("input",{id:"gm-extra-input",type:"number",min:0,step:1,placeholder:"e.g. 2181"}),` +
    `${reactAlias}.jsx("span",{id:"gm-extra-seconds",className:"gm-seconds"})` +
    `]})` +
    `]}),` +
    `${reactAlias}.jsx("div",{className:"gm-actions",children:[` +
    `${reactAlias}.jsx("button",{className:"gm-btn-cancel",id:"gm-cancel",children:"Cancel"}),` +
    `${reactAlias}.jsx("button",{className:"gm-btn-save",id:"gm-save",children:"Save"})` +
    `]})` +
    `]})`;

  sourceCode = sourceCode.replace(
    dialogPattern,
    (_, before, bracket) => before + dialogEl + bracket,
  );

  return sourceCode;
};

const addAcceptClickLogger = (sourceCode) => {
  const injection =
    'document.addEventListener("click",function(e){' +
    'if(location.pathname!=="/referral/details")return;' +
    'const btn=e.target.closest("button");' +
    "if(!btn)return;" +
    'const txt=btn.innerText||"";' +
    'if(!txt.includes("Accept"))return;' +
    'const pb=document.querySelector("[data-gm-prepare]");' +
    'const k=Date.now()+"GM__PREPARE_TIME";' +
    'const k_v=pb?.innerText||"";' +
    "localStorage.setItem(k,k_v);" +
    "});";

  return (
    'console.log("<<< PATCHED BUNDLE LOADED >>>");' + injection + sourceCode
  );
};

function modifyGlobMedSourceCode(code) {
  let _sourceCode = code;

  _sourceCode = addSettingsToDashboard(_sourceCode);

  // Usage — synchronous, no await needed
  _sourceCode = makeApisExposeRefetch(
    _sourceCode,
    "referral-details",
    "refetchReferralDetails",
  );

  _sourceCode = makeApisExposeRefetch(
    _sourceCode,
    "patient-info",
    "refetchPatientInfo",
  );

  let sourceCode = cleanupTrailingCommaBeforeArrayClose(
    insertRendererBeforePatientInfo(_sourceCode),
  );

  const section = findReactCallBoundsEnclosingText(
    sourceCode,
    "referral-button-container",
  );
  if (!section || !section.text) {
    return sourceCode;
  }

  let sectionText = section.text;

  const variableName = extractCanTakeActionVar(sectionText);
  if (!variableName) {
    return sectionText;
  }

  let accept = findAcceptElementBounds(sectionText);
  if (!accept || !accept.text) {
    return sourceCode;
  }

  const pattern = new RegExp(
    `${variableName}\\s*&&\\s*\\(\\s*${variableName}\\s*==\\s*null\\s*\\?\\s*void\\s+0\\s*:\\s*${variableName}\\.status\\s*\\)\\s*===\\s*"P"`,
    "g",
  );

  sectionText = sectionText.replace(pattern, `!0`);
  sectionText = sectionText.replace(`${variableName}.canTakeAction`, "!0");
  sectionText = sectionText.replace(`${variableName}.canUpdate`, "!0");

  //  IMPORTANT: find accept AFTER modifying sectionText
  accept = findAcceptElementBounds(sectionText);

  if (!accept || !accept.text) return sourceCode;

  const acceptText = accept.text;

  const acceptHandlerName = extractOnClickHandler(acceptText);

  const recaptchaInfo = extractRecaptchaHandlerInfo(
    sourceCode,
    acceptHandlerName,
  );

  if (!recaptchaInfo) {
    console.warn("[GM] Could not extract recaptcha handler info");
  }

  sectionText = addPrepareButton(
    sectionText,
    accept,
    acceptHandlerName,
    recaptchaInfo?.triggerFnName,
  );

  sourceCode =
    sourceCode.slice(0, section.start) +
    sectionText +
    sourceCode.slice(section.end);

  sourceCode = addFilesFromLocalStorage(sourceCode, acceptHandlerName);
  sourceCode = addTokenFromLocalStorage(
    sourceCode,
    acceptHandlerName,
    recaptchaInfo,
  );

  return addAcceptClickLogger(sourceCode);
}

// const filePath = process.cwd() + "/original-gm-index.js";
// const sourceCode = await readFile(filePath, "utf8");
// const modifiedCode = modifyGlobMedSourceCode(sourceCode);
// const mdsFilePath = process.cwd() + "/original-gm-index-modfs.js";
// await writeFile(mdsFilePath, modifiedCode);

export default modifyGlobMedSourceCode;
