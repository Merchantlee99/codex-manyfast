# Architecture

Codex Manyfast separates conversation, authoritative planning state, deterministic projection, and rendering.

```text
Codex conversation + skill
          │
          ▼
typed MCP commands
          │
          ▼
Planning Core ── validates transitions and traceability
          │
          ▼
.codex-manyfast/state.json + events.jsonl
          │
          ▼
Manifest Projector ── pure deterministic function
          │
          ▼
immutable snapshotId + contentHash
          │
          ▼
MCP UI resource ── read-only structuredContent renderer
```

## Authority boundaries

### Model and skill

The model may ask questions, compare alternatives, recommend a decision, and select when a visual checkpoint is useful. It may not accept a decision without a current-turn user confirmation or construct display fields for the manifest.

### Domain runtime

The runtime owns state transitions, entity links, revision conflicts, readiness, and manifest projection. The current confirmation boundary requires a non-empty verbatim quote. It limits accidental promotion but does not prove human presence against a malicious caller.

### Store

`state.json` is authoritative. `events.jsonl` records update events. Manifest snapshots are immutable content-hashed projections. Writes use an expected revision and atomic rename.

### Widget

The widget owns only ephemeral presentation state. It receives the exact `structuredContent` returned by `planning_render_manifest`, creates DOM nodes using `textContent`, and fails closed on unknown schema versions.

## Why the render tool accepts only a snapshot ID

Passing arbitrary fields from the model to a render tool would let the model omit, rewrite, or reorder decision-grade information. The two-step contract prevents that:

1. `planning_get_manifest` projects and stores the authoritative revision.
2. `planning_render_manifest` reloads that stored snapshot by ID.

The model cannot author the snapshot payload between those calls.

## Readiness

`ready` means the next implementation slice is structurally actionable:

- objective confirmed;
- no open blocking question;
- no proposed blocking decision;
- no captured blocking change; and
- structural validation passes.

It does not mean that all uncertainty is gone or that the product decision is objectively correct.
