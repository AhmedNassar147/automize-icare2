/*
 *
 * Helper: `speakText`.
 *
 */
import { spawn } from "child_process";

const speakText = (text, times = 4, delayMs = 4200) => {
  let count = 0;
  const escapedText = text.replace(/'/g, "''").replace(/"/g, '""');

  const speak = () => {
    if (count >= times) return;

    const ps = spawn("powershell", ["-NoProfile", "-Command", "-"], {
      stdio: ["pipe", "inherit", "inherit"],
    });

    ps.stdin.write(`
      Add-Type -AssemblyName System.Speech;
      $speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      $speak.SelectVoice('Microsoft Zira Desktop');
      $speak.Rate = 2;
      $speak.Volume = 100;
      $speak.Speak('${escapedText}');
    `);
    ps.stdin.end();

    ps.on("exit", () => {
      count++;
      setTimeout(speak, delayMs);
    });
  };

  speak();
};

export default speakText;
