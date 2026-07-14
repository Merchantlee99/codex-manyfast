import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { projectManifest } from "./manifest.mjs";
import { manifestWidgetHtml } from "./widget-template.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const sample = JSON.parse(await readFile(path.join(packageRoot, "fixtures/sample-state.json"), "utf8"));
const snapshot = projectManifest(sample);
const port = Number(process.env.PORT ?? 4173);

const previewHtml = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Codex Manyfast Preview</title><style>
:root{color-scheme:light;background:#f3f3f1;color:#1a1a1a;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0}.shell{min-height:100vh;display:grid;grid-template-columns:240px 1fr}.sidebar{background:#eaeae7;padding:24px 18px;border-right:1px solid #dadad6}.brand{font-size:14px;font-weight:750}.task{margin-top:28px;color:#666;font-size:12px}.main{padding:44px 36px 60px}.conversation{max-width:820px;margin:0 auto}.user{margin-left:auto;max-width:550px;background:#e8e8e4;border-radius:18px 18px 4px 18px;padding:13px 16px;font-size:14px;line-height:1.5}.assistant{margin:28px 0 12px;font-size:14px;line-height:1.65}.widget{width:100%;height:590px;border:0;background:transparent}.caption{color:#777;font-size:11px;margin:9px 3px}@media(max-width:760px){.shell{display:block}.sidebar{display:none}.main{padding:22px 12px}.widget{height:690px}}
</style></head><body><div class="shell"><aside class="sidebar"><div class="brand">Codex</div><div class="task">codex-manyfast<br>Planning checkpoint</div></aside><main class="main"><div class="conversation"><div class="user">지금까지 확정된 것과 구현 전에 풀어야 할 질문을 보여줘.</div><div class="assistant">현재 기획 상태를 canonical revision에서 읽었습니다. 구현을 막는 질문이 1개 남아 있습니다.</div><iframe class="widget" title="Planning Manifest" src="/widget"></iframe><div class="caption">Read-only projection · 대화가 결정하고 Manifest는 상태만 비춥니다.</div></div></main></div><script>
const frame=document.querySelector('iframe'); frame.addEventListener('load',async()=>{const data=await fetch('/snapshot').then(r=>r.json()); frame.contentWindow.postMessage({jsonrpc:'2.0',method:'ui/notifications/tool-result',params:{structuredContent:data}},'*');});
</script></body></html>`;

const server = createServer((request, response) => {
  if (request.url === "/health") return send(response, 200, "text/plain", "ok");
  if (request.url === "/widget") return send(response, 200, "text/html; charset=utf-8", manifestWidgetHtml());
  if (request.url === "/snapshot") return send(response, 200, "application/json", JSON.stringify(snapshot));
  if (request.url === "/" || request.url === "/index.html") return send(response, 200, "text/html; charset=utf-8", previewHtml);
  return send(response, 404, "text/plain", "not found");
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Codex Manyfast preview: http://127.0.0.1:${port}\n`);
});

function send(response, status, type, body) {
  response.writeHead(status, { "content-type": type, "cache-control": "no-store" });
  response.end(body);
}
