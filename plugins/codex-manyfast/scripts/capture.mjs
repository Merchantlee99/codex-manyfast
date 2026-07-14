import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const output = path.resolve(root, "assets/manifest-preview.png");
await mkdir(path.dirname(output), { recursive: true });
const port = 4173;
const preview = spawn(process.execPath, [path.join(root, "src/preview-server.mjs")], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "inherit"],
});
try {
  await waitFor(`http://127.0.0.1:${port}/health`);
  const executablePath = chromePath();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
  await page.locator("iframe").contentFrame().locator("text=Planning Manifest").waitFor();
  await page.screenshot({ path: output, fullPage: true });
  await browser.close();
  process.stdout.write(`${output}\n`);
} finally {
  preview.kill("SIGTERM");
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate));
}

async function waitFor(url) {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error(`Preview did not start: ${url}`);
}
