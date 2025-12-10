/*
 *
 * Helper: `modifyGlobMedSourceCode`.
 *
 */
function modifyGlobMedSourceCode(sourceCode) {
  // 1) Find the button with className `referral-button-container...` and grab its onClick handler name
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

  return `console.log("<<< PATCHED BUNDLE LOADED >>>");${sourceCode}`;
}

export default modifyGlobMedSourceCode;
