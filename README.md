<div align="center">

# Codex Manyfast

**A local-first decision continuity plugin for ordinary Codex conversations.**

[![version](https://img.shields.io/badge/version-0.1.0-2ea44f)](./plugins/codex-manyfast/.codex-plugin/plugin.json)
[![license](https://img.shields.io/badge/license-MIT-0969da)](./LICENSE)
[![Node](https://img.shields.io/badge/Node-20%2B-417e38)](./package.json)
[![local-first](https://img.shields.io/badge/local--first-planning%20runtime-6f42c1)](#how-it-works)
[![tests](https://img.shields.io/badge/local%20tests-11%20passed-238636)](#verified-scope)

[English](./README.md) · [한국어](./README.ko.md) · [Why I built it](#why-i-built-it) · [Quickstart](#quickstart) · [Visual evidence](#visual-evidence) · [Architecture](#architecture)

</div>

AI coding agents can produce polished plans while quietly filling the most important gaps: who the user is, what evidence supports a claim, which trade-off the user accepted, or whether a new implementation request invalidates an earlier decision.

**Codex Manyfast** keeps the normal Codex conversation as the interface. It records user statements, external evidence, agent inferences, open questions, accepted decisions, requirements, and implementation-time changes as different types. At useful checkpoints it renders a read-only **Planning Manifest** from an immutable state snapshot.

This is a `0.1.0` developer preview. It does **not** claim to finish product planning automatically or prove that a decision is correct. It makes the current objective, evidence boundaries, explicit decisions, blockers, and revision visible so the user can judge them.

## Visual evidence

[![Codex Manyfast Planning Manifest](./plugins/codex-manyfast/assets/manifest-preview.png)](./plugins/codex-manyfast/assets/manifest-preview.png)

This is an actual Codex desktop conversation captured after installing plugin build `0.1.0+codex.20260714074541`. Codex called the bundled STDIO MCP tools, created immutable snapshot `manifest-r4-dede70506f36`, and rendered that snapshot inline through `planning_render_manifest`. The image was cropped only to remove unrelated tasks and desktop content.

The captured run contains:

- a user-confirmed objective at revision 2;
- one verbatim user-statement observation;
- one open implementation blocker;
- readiness `not_ready`, without guessing an answer; and
- immutable revision 4, snapshot ID, and content hash.

## Why I built it

The first failure in AI-assisted implementation is often not code. It is an unstated product decision that the agent silently completes on the user's behalf.

Codex Manyfast treats planning as a traceable decision chain:

```text
Intent
→ Observation / Research Question
→ Evidence
→ Proposed Decision
→ Explicit User Confirmation
→ Requirement + Acceptance Criteria
→ Implementation-time Change
```

A user correction or an agent interpretation does not become durable truth automatically. An external claim needs provenance. A decision stays proposed until the user explicitly confirms it. A requirement must point back to an accepted decision.

## How it works

```text
ordinary Codex conversation
→ ask one material question instead of guessing
→ record statements, evidence, and inference as different types
→ compare alternatives and propose a decision
→ accept only with a verbatim user confirmation
→ validate traceability and readiness
→ create an immutable Planning Manifest snapshot
→ render that exact snapshot inside the conversation
```

The runtime is local-first. The plugin stores authoritative state, an append-only event log, and immutable manifest snapshots under `.codex-manyfast/` in the target workspace. Every write uses an expected revision; stale writes fail instead of overwriting newer planning.

### Natural-language usage

After installation, use normal requests rather than operating a separate planning editor:

```text
I want to build a tool for solo developers, but I have not fixed the target workflow yet.
Ask me one material question at a time and do not turn your assumptions into decisions.
```

```text
Show me what is confirmed, what is evidence-backed, and what still blocks implementation.
```

```text
This requirement appeared during implementation. Capture it as additional planning,
identify the affected decisions, and pause only the work that depends on it.
```

## Planning Manifest contract

The model decides **when** a visual checkpoint helps. It does not author the manifest fields.

```text
planning_get_manifest(workspaceRoot)
→ immutable snapshotId + contentHash

planning_render_manifest(workspaceRoot, snapshotId)
→ the exact stored structuredContent + MCP UI resource
```

The render tool accepts a server-created `snapshotId`, not arbitrary display data. Unsupported schemas fail closed with an error instead of showing a best-effort summary.

## Quickstart

Requirements: Node.js 20 or newer and a Codex build with plugin support.

```bash
git clone https://github.com/Merchantlee99/codex-manyfast.git
cd codex-manyfast
npm ci
npm run check
```

Add the repository marketplace and install the plugin:

```bash
codex plugin marketplace add .
codex plugin add codex-manyfast@codex-manyfast
```

Start a new Codex task after installation so the bundled skill and MCP tools are discovered.

To inspect the widget locally:

```bash
npm run preview
# open http://127.0.0.1:4173
```

To capture the standalone development harness (this does not replace the live Codex evidence above):

```bash
npm run capture
```

## MCP tools

| Tool | Contract |
|---|---|
| `planning_init` | Initialize a repo-local planning store |
| `planning_get_state` | Read authoritative state and revision |
| `planning_confirm_objective` | Confirm the objective with the user's quote |
| `planning_record_observation` | Record user statement, sourced evidence, or unconfirmed inference |
| `planning_add_question` | Capture an open question and blocking scope |
| `planning_propose_decision` | Propose without accepting |
| `planning_accept_decision` | Accept only with explicit user confirmation |
| `planning_add_requirement` | Link acceptance criteria to accepted decisions |
| `planning_capture_change` | Capture additional planning found during implementation |
| `planning_validate` | Check integrity and readiness |
| `planning_get_manifest` | Create an immutable manifest snapshot |
| `planning_render_manifest` | Render only a stored snapshot ID |

## Verified scope

| Area | 0.1.0 evidence |
|---|---|
| Epistemic type separation | Automated domain tests |
| External evidence provenance | Automated domain tests |
| Explicit confirmation gate | Automated domain and MCP tests |
| Revision conflict rejection | Automated store and MCP tests |
| Deterministic manifest hash | Automated projection test |
| Bundled STDIO MCP process | Real child-process MCP client test |
| MCP UI resource and exact snapshot rendering | MCP integration test |
| Actual inline rendering in Codex desktop | Recorded live task and inspected screenshot |
| Desktop and mobile-width rendering | Real Chromium visual test |
| Unsupported schema fail-closed state | Real Chromium visual test |
| Codex marketplace install | Clean temporary `CODEX_HOME` install test |
| Plugin manifest | Official local plugin validator |
| Production dependency audit | `npm install` reported zero known vulnerabilities |

Local verification on 2026-07-14: **11/11 automated tests passed**, plugin validation passed, marketplace installation succeeded, and an actual Codex desktop task completed the six-tool planning flow and rendered the immutable manifest inline. See [the verification record](./docs/verification/LOCAL_TEST.md).

## Current limitations

- The user-confirmation boundary records a verbatim quote but is not cryptographic proof of human presence.
- The live screenshot proves this tested flow on the installed desktop build; it is not a claim that every Codex host or future build renders identically.
- Research acquisition adapters are not bundled yet. Evidence can be recorded after Codex obtains it through available browser, web, or connector tools.
- Change impact is explicit through affected IDs, but automatic code-to-requirement drift detection is not implemented.
- The manifest is intentionally read-only. Decisions are changed through conversation, not by editing the card.
- Multi-user approval, remote synchronization, and cross-repository planning are outside `0.1.0`.

## Development

```bash
npm run build        # bundle the self-contained MCP server
npm test             # domain, store, MCP, and Chromium tests
npm run test:visual # responsive and fail-closed UI states
npm run check        # release gate used before publish
npm run preview      # local conversation host harness
npm run capture      # regenerate the standalone harness screenshot
```

## Architecture

- `plugins/codex-manyfast/src/domain.mjs` — entity rules, confirmation gates, validation, and readiness
- `plugins/codex-manyfast/src/store.mjs` — repo-local revision store, event log, and immutable snapshots
- `plugins/codex-manyfast/src/manifest.mjs` — deterministic state-to-manifest projection
- `plugins/codex-manyfast/src/server.mjs` — STDIO MCP tools and MCP UI resource
- `plugins/codex-manyfast/src/widget-template.mjs` — read-only inline manifest renderer
- `plugins/codex-manyfast/skills/codex-manyfast/` — conversational workflow and no-guess boundaries
- `.agents/plugins/marketplace.json` — repository marketplace entry

See [Architecture](./docs/ARCHITECTURE.md) for the state and rendering boundaries.

## License

MIT License. See [LICENSE](./LICENSE).
