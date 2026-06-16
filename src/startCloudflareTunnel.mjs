import { spawn, execSync } from "child_process";
import createConsoleMessage from "./createConsoleMessage.mjs";

const getCloudflaredPath = () => {
  try {
    return execSync("where cloudflared", {
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .find(Boolean)
      .trim();
  } catch {
    return null;
  }
};

let publicActionBaseUrl = null;
let tunnelReadyPromise = null;

export const getPublicActionBaseUrl = () => publicActionBaseUrl;

export const waitForPublicActionBaseUrl = async () => {
  if (publicActionBaseUrl) return publicActionBaseUrl;

  if (!tunnelReadyPromise) {
    throw new Error("Cloudflare tunnel has not been started yet");
  }

  return tunnelReadyPromise;
};

const startCloudflareTunnel = () => {
  if (tunnelReadyPromise) {
    return tunnelReadyPromise;
  }

  const PORT = process.env.PORT;

  if (!PORT) {
    throw new Error(`PORT is missing or invalid PORT=${PORT}`);
  }

  const cloudflaredPath = getCloudflaredPath() || "cloudflared";
  // || "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";

  console.log("cloudflaredPath", cloudflaredPath);

  tunnelReadyPromise = new Promise((resolve, reject) => {
    let resolved = false;

    const url = `https://localhost:${PORT}`;

    createConsoleMessage(`Starting Cloudflare tunnel on ${url}`, "info");

    const tunnel = spawn(
      cloudflaredPath,
      ["tunnel", "--url", url, "--no-tls-verify"],
      {
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const startupTimeout = setTimeout(() => {
      if (!resolved) {
        publicActionBaseUrl = null;
        tunnelReadyPromise = null;

        reject(new Error("Timed out waiting for Cloudflare tunnel URL"));
      }
    }, 30000);

    const handleOutput = (data) => {
      const text = data.toString();
      const match = text.match(/https:\/\/[\w-]+\.trycloudflare\.com/);

      if (match && !resolved) {
        resolved = true;
        clearTimeout(startupTimeout);

        publicActionBaseUrl = match[0];

        createConsoleMessage(
          `Cloudflare public URL: ${publicActionBaseUrl}`,
          "info",
        );

        resolve(publicActionBaseUrl);
      }
    };

    tunnel.stdout.on("data", handleOutput);
    tunnel.stderr.on("data", handleOutput);

    tunnel.on("error", (error) => {
      clearTimeout(startupTimeout);
      publicActionBaseUrl = null;
      tunnelReadyPromise = null;

      if (!resolved) {
        reject(error);
      }
    });

    tunnel.on("exit", (code) => {
      clearTimeout(startupTimeout);

      createConsoleMessage(`cloudflared exited: ${code}`, "info");

      publicActionBaseUrl = null;
      tunnelReadyPromise = null;

      if (!resolved) {
        reject(new Error(`cloudflared exited before URL was created: ${code}`));
      }
    });
  });

  return tunnelReadyPromise;
};

export default startCloudflareTunnel;
