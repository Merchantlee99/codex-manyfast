import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.resolve(here, "../dist/server.mjs");

test("bundled MCP server exposes planning tools and renders the exact stored snapshot", async (t) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-manyfast-mcp-"));
  t.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
  const client = new Client({ name: "codex-manyfast-test", version: "0.1.0" });
  await client.connect(transport);
  t.after(() => client.close());

  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name);
  assert.ok(names.includes("planning_init"));
  assert.ok(names.includes("planning_get_manifest"));
  assert.ok(names.includes("planning_render_manifest"));

  const initialized = await client.callTool({
    name: "planning_init",
    arguments: { workspaceRoot, projectId: "mcp-demo", objective: "Make planning traceable" },
  });
  assert.equal(initialized.isError, undefined);

  const generated = await client.callTool({ name: "planning_get_manifest", arguments: { workspaceRoot } });
  const snapshot = generated.structuredContent;
  assert.match(snapshot.snapshotId, /^manifest-r1-[a-f0-9]{12}$/);

  const rendered = await client.callTool({
    name: "planning_render_manifest",
    arguments: { workspaceRoot, snapshotId: snapshot.snapshotId },
  });
  assert.deepEqual(rendered.structuredContent, snapshot);

  const resources = await client.listResources();
  assert.ok(resources.resources.some((resource) => resource.uri === "ui://codex-manyfast/planning-manifest.html"));
  const widget = await client.readResource({ uri: "ui://codex-manyfast/planning-manifest.html" });
  assert.match(widget.contents[0].text, /Planning Manifest/);
  assert.match(widget.contents[0].mimeType, /mcp-app/);
});

test("MCP returns a typed stale-revision error instead of overwriting state", async (t) => {
  const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), "codex-manyfast-mcp-stale-"));
  t.after(() => rm(workspaceRoot, { recursive: true, force: true }));
  const transport = new StdioClientTransport({ command: process.execPath, args: [serverPath] });
  const client = new Client({ name: "codex-manyfast-test", version: "0.1.0" });
  await client.connect(transport);
  t.after(() => client.close());
  await client.callTool({ name: "planning_init", arguments: { workspaceRoot, projectId: "demo", objective: "Plan" } });
  await client.callTool({ name: "planning_confirm_objective", arguments: { workspaceRoot, expectedRevision: 1, confirmationQuote: "Yes." } });
  const stale = await client.callTool({ name: "planning_add_question", arguments: { workspaceRoot, expectedRevision: 1, question: "Stale?", blocking: true } });
  assert.equal(stale.isError, true);
  assert.equal(stale.structuredContent.code, "STALE_REVISION");
});
