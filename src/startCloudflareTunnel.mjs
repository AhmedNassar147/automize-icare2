import { spawn } from "child_process";
import createConsoleMessage from "./createConsoleMessage.mjs";

let publicActionBaseUrl = null;

export const getPublicActionBaseUrl = () => publicActionBaseUrl;

const startCloudflareTunnel = () => {
  const tunnel = spawn("cloudflared", [
    "tunnel",
    "--url",
    "https://localhost:8443",
    "--no-tls-verify",
  ]);

  tunnel.stdout.on("data", (data) => {
    const text = data.toString();
    console.log(text);

    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

    if (match) {
      publicActionBaseUrl = match[0];
      createConsoleMessage(
        `Cloudflare public URL: ${publicActionBaseUrl}`,
        "info",
      );
    }
  });

  tunnel.stderr.on("data", (data) => {
    const text = data.toString();
    console.error(text);

    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);

    if (match) {
      publicActionBaseUrl = match[0];
      createConsoleMessage(
        `Cloudflare public URL: ${publicActionBaseUrl}`,
        "info",
      );
    }
  });

  tunnel.on("exit", (code) => {
    createConsoleMessage(`cloudflared exited: ${code}`, "info");
    publicActionBaseUrl = null;
  });

  return tunnel;
};

export default startCloudflareTunnel;
