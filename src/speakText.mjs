/*
 *
 * Helper: `speakText`.
 *
 */
import { spawn } from "child_process";

const speakText = ({
  text,
  times = 7,
  delayMs = 4000,
  rate = 2,
  useMaleVoice,
  volume = 94,
}) => {
  // // Input validation
  // if (!text || typeof text !== "string") {
  //   console.error("speakText: Invalid text provided");
  //   return;
  // }

  // if (volume < 0 || volume > 100) {
  //   console.warn("speakText: Volume should be between 0-100");
  //   volume = Math.max(0, Math.min(100, volume)); // Clamp value
  // }

  const voice = useMaleVoice
    ? "Microsoft David Desktop"
    : "Microsoft Zira Desktop";

  let count = 0;
  const escapedText = text.replace(/'/g, "''").replace(/"/g, '""');

  const speak = () => {
    if (count >= times) return;

    try {
      const ps = spawn("powershell", ["-NoProfile", "-Command", "-"], {
        stdio: ["pipe", "inherit", "inherit"],
      });

      // Handle process errors
      ps.on("error", (error) => {
        console.error("speakText: PowerShell error:", error);
      });

      ps.stdin.write(`
        Add-Type -AssemblyName System.Speech;
        $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;
        $speak.SelectVoice('${voice}');
        $speak.Rate = ${rate};
        $speak.Volume = ${volume};
        $speak.Speak('${escapedText}');
      `);
      ps.stdin.end();

      ps.on("exit", (code) => {
        if (code !== 0) {
          console.error(`speakText: Process exited with code ${code}`);
        }
        count++;
        if (count < times && delayMs > 0) {
          setTimeout(speak, delayMs);
        }
      });
    } catch (error) {
      console.error("speakText: Unexpected error:", error);
    }
  };

  speak();
};

export default speakText;
