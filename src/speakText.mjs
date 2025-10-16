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
}) =>
  new Promise((resolve, reject) => {
    const voice = useMaleVoice
      ? "Microsoft David Desktop"
      : "Microsoft Zira Desktop";

    let count = 0;
    const escapedText = text.replace(/'/g, "''").replace(/"/g, '""');

    const speak = () => {
      if (count >= times) return resolve();

      const ps = spawn("powershell", ["-NoProfile", "-Command", "-"], {
        stdio: ["pipe", "inherit", "inherit"],
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

      ps.on("error", reject);
      ps.on("exit", () => {
        count++;
        if (delayMs) {
          setTimeout(speak, delayMs);
        }
      });
    };

    speak();
  });

export default speakText;
