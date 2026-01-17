import { spawn } from "child_process";
import { performance } from "perf_hooks";

/**
 * Plays a Windows system beep via WinAPI MessageBeep (no PowerShell).
 * Returns when rundll32 exits (sound may be very short).
 */
function makeBeep(type = "0x40") {
  // Common types:
  // 0x10 = MB_ICONHAND (critical)
  // 0x20 = MB_ICONQUESTION
  // 0x30 = MB_ICONEXCLAMATION (warning)
  // 0x40 = MB_ICONASTERISK (info)
  const t0 = performance.now();

  return new Promise((resolve) => {
    const ps = spawn("rundll32.exe", ["user32.dll,MessageBeep", String(type)], {
      windowsHide: true,
    });

    ps.on("error", (err) => {
      resolve({
        elapsedMs: Math.round(performance.now() - t0),
        exitCode: -1,
        error: err?.message || String(err),
      });
    });

    ps.on("exit", (code) => {
      resolve({
        elapsedMs: Math.round(performance.now() - t0),
        exitCode: code ?? -1,
      });
    });
  });
}

export default makeBeep;
