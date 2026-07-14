import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

test("manifest preview renders real structured data without overflow on desktop and mobile", async (t) => {
  const port = 4187;
  const preview = spawn(process.execPath, [path.join(root, "src/preview-server.mjs")], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(() => preview.kill("SIGTERM"));
  await waitFor(`http://127.0.0.1:${port}/health`);
  const executablePath = chromePath();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  t.after(() => browser.close());

  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(`http://127.0.0.1:${port}`, { waitUntil: "networkidle" });
    const frame = page.locator("iframe").contentFrame();
    await frame.getByText("Planning Manifest").waitFor();
    await frame.getByText("NOT READY").waitFor();
    await frame.getByText("일반 Codex 대화를 유지하고 중요한 상태 변화에만 읽기 전용 Manifest를 보여준다.").waitFor();
    const overflow = await frame.locator("html").evaluate((node) => node.scrollWidth > node.clientWidth);
    assert.equal(overflow, false, `horizontal overflow at ${viewport.width}px`);
    const error = await frame.locator(".error").count();
    assert.equal(error, 0);
    await page.close();
  }
});

test("widget fails closed when manifest schema is unsupported", async (t) => {
  const port = 4188;
  const preview = spawn(process.execPath, [path.join(root, "src/preview-server.mjs")], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "inherit"],
  });
  t.after(() => preview.kill("SIGTERM"));
  await waitFor(`http://127.0.0.1:${port}/health`);
  const executablePath = chromePath();
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 800, height: 700 } });
  await page.goto(`http://127.0.0.1:${port}/widget`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: { structuredContent: { manifest: { schemaVersion: "9.9.9" } } } }, "*"));
  await page.getByText("내용을 추측해 표시하지 않았습니다.").waitFor();
});

function chromePath() {
  return [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
  ].filter(Boolean).find((candidate) => existsSync(candidate));
}

async function waitFor(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview did not start: ${url}`);
}
