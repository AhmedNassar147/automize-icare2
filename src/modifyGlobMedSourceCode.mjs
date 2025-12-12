/*
 *
 * Helper: `modifyGlobMedSourceCode`.
 *
 */

// when 15 minutes not done the details api returns the next vaues
// "status": "P",
// "canUpdate": false,
// "canTakeAction": true,

function modifyGlobMedSourceCode(sourceCode) {
  // ---------------------------------------------------------------------------
  // 1) Patch referral-details onSuccess toast -> console.log (minified-safe)
  // ---------------------------------------------------------------------------
  const anchor = '(["referral-details"';
  const idx = sourceCode.indexOf(anchor);

  if (idx !== -1) {
    const windowStart = Math.max(0, idx - 200);
    const windowEnd = Math.min(sourceCode.length, idx + 2500);
    let seg = sourceCode.slice(windowStart, windowEnd);

    // Match: onSuccess:J=>{ ... }   OR   onSuccess:(J)=>{ ... }
    // Stop at the first "}" that is followed by "," or "}" (end of object prop)
    const onSuccessRegex =
      /onSuccess\s*:\s*(?:\(\s*([A-Za-z_$][\w$]*)\s*\)|([A-Za-z_$][\w$]*))\s*=>\s*{([\s\S]*?)}(?=\s*[,}])/;

    const m = seg.match(onSuccessRegex);
    if (m) {
      const param = m[1] || m[2];
      const body = m[3];

      // Match the warning toast tail WITHOUT assuming function names:
      // !J.canUpdate&&J.message&&l(Qr({message:J.message,type:"warning",time:1e4}))
      //
      // Explanation:
      // - require the guard: !<param>.canUpdate && <param>.message &&
      // - then match: <anyFn>(<anyFn>({message:<param>.message,type:"warning",time:1e4}))
      // - allow whitespace variations
      const toastRegex = new RegExp(
        String.raw`!\s*${param}\.canUpdate\s*&&\s*${param}\.message\s*&&\s*` +
          String.raw`[A-Za-z_$][\w$]*\s*\(\s*[A-Za-z_$][\w$]*\s*\(\s*` +
          String.raw`\{\s*message\s*:\s*${param}\.message\s*,\s*type\s*:\s*"warning"\s*,\s*time\s*:\s*1e4\s*\}\s*` +
          String.raw`\)\s*\)\s*`
      );

      if (toastRegex.test(body)) {
        const newBody = body.replace(
          toastRegex,
          `!${param}.canUpdate&&${param}.message&&console.log("${param}.message",${param}.message)`
        );

        // Rebuild the onSuccess property exactly as it appeared (param with/without parens)
        const rebuilt = m[1]
          ? `onSuccess:(${param})=>{${newBody}}`
          : `onSuccess:${param}=>{${newBody}}`;

        seg = seg.replace(onSuccessRegex, rebuilt);

        sourceCode =
          sourceCode.slice(0, windowStart) + seg + sourceCode.slice(windowEnd);
      }
    }
  }

  // 2) Patch files Promise.all -> localStorage fallback (your existing logic)
  // Find the button with className `referral-button-container...` and grab its onClick handler name
  // ---------------------------------------------------------------------------
  const buttonRegex =
    /className:\s*[`'"]referral-button-container[\s\S]*?[`'"][\s\S]{0,400}?onClick:\s*(\w+)/;
  const buttonMatch = sourceCode.match(buttonRegex);

  if (!buttonMatch) {
    // Couldn't find that specific button – don't modify anything
    return sourceCode;
  }

  const handlerName = buttonMatch[1]; // e.g. "Rt"
  const classIndex = buttonMatch.index ?? -1;

  // 2.a) In the JSX around that className, force *.canUpdate / *.canTakeAction to be true
  // Make canUpdate + canTakeAction always true ONLY inside referral-button-container
  //    (minified-safe: does NOT assume variable names like xe/ac/etc)
  // ---------------------------------------------------------------------------
  if (classIndex >= 0) {
    const JSX_WINDOW = 900;
    const jsxStart = Math.max(0, classIndex - 200);
    const jsxEnd = Math.min(sourceCode.length, classIndex + JSX_WINDOW);

    let jsxSegment = sourceCode.slice(jsxStart, jsxEnd);

    // Replace `<any>.canUpdate &&` → `true &&`
    jsxSegment = jsxSegment.replace(
      /[A-Za-z_$][\w$]*\s*\.canUpdate\s*&&/g,
      "true &&"
    );

    // Replace `<any>.canTakeAction` → `true`
    jsxSegment = jsxSegment.replace(
      /[A-Za-z_$][\w$]*\s*\.canTakeAction\b/g,
      "true"
    );

    // Rebuild the source with the patched JSX segment
    sourceCode =
      sourceCode.slice(0, jsxStart) + jsxSegment + sourceCode.slice(jsxEnd);
  }

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

  return `console.log("<<< PATCHED BUNDLE LOADED >>>");window.__PATCHED_BUNDLE__= true;${sourceCode}`;
}

export default modifyGlobMedSourceCode;
