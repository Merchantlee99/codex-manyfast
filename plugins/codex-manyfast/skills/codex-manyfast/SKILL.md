---
name: codex-manyfast
description: Use when a user wants to clarify what to build, research decision-grade unknowns, fix product or technical decisions before implementation, inspect planning readiness, or handle additional planning discovered during implementation without silently guessing.
---

# Codex Manyfast

Keep the ordinary Codex conversation as the primary interface. Use the planning runtime to preserve only decisions and evidence that must survive the thread.

## Non-negotiable boundaries

- Never turn an agent interpretation into a user fact.
- Never accept a decision without explicit user confirmation in the current conversation.
- Pass the user's verbatim confirmation to `planning_confirm_objective` or `planning_accept_decision`.
- Record external evidence only with a source URL.
- Ask one high-impact question at a time when an unknown could materially change the product, architecture, risk, or implementation scope.
- Do not block all implementation for a local planning gap. Capture the change and pause only affected work when it is marked blocking.
- Treat the chat as ephemeral. Durable planning state lives in the repo-local `.codex-manyfast/` store.

## Workflow

1. Read `planning_get_state`. If no store exists, initialize it from the user's stated objective.
2. Separate each new item into one of:
   - user statement
   - external evidence
   - unconfirmed agent inference
   - open question
   - proposed decision
3. When a question matters, ask it directly instead of filling the gap.
4. Present alternatives and trade-offs before proposing a material decision.
5. Accept a decision only after the user explicitly confirms it.
6. Link requirements only to accepted decisions and include acceptance criteria.
7. Run `planning_validate` before implementation or handoff.
8. When a visual checkpoint helps:
   - call `planning_get_manifest`
   - pass its exact `snapshotId` to `planning_render_manifest`
   - never reconstruct or rewrite the manifest payload yourself

## Implementation-time planning

When implementation reveals an additional need:

1. Capture it with `planning_capture_change`.
2. Identify affected decision and requirement IDs.
3. Mark it blocking only if continuing affected work would create rework, violate a confirmed contract, or make acceptance criteria unknowable.
4. Continue unaffected work.
5. Ask the smallest question needed to resolve the delta.

Read [the protocol](./references/protocol.md) for entity and state definitions.
