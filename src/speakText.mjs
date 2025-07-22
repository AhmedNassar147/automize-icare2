/*
 *
 * Helper: `speakText`.
 *
 */
import { exec } from "child_process";

const speakText = (text, times = 4, delayMs = 4300) => {
  let count = 0;

  // Escape single quotes for PowerShell
  const escapedText = text.replace(/'/g, "''");

  const speak = () => {
    if (count >= times) return;

    // const command =
    //   `PowerShell -NoProfile -Command ` +
    //   `"Add-Type -AssemblyName System.Speech; ` +
    //   `$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
    //   `$speak.Speak('${escapedText}');"`;

    const command =
      `PowerShell -NoProfile -Command "` +
      `Add-Type -AssemblyName System.Speech; ` +
      `$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer; ` +
      `$speak.SelectVoice('Microsoft Zira Desktop'); ` + // female voice
      `$speak.Rate = 2; ` + // speaking speed
      `$speak.Volume = 100; ` +
      `$speak.Speak('${escapedText}');"`; // escaped string

    exec(command, (err, stdout, stderr) => {
      if (err) console.error("❌ Error from voice:", err);
      if (stderr) console.error("⚠️ Stderr from voice:", stderr);
    });

    count++;
    setTimeout(speak, delayMs);
  };

  speak();
};

export default speakText;
