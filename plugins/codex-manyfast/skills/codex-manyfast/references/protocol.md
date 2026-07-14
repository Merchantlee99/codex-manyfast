# Planning protocol

## Epistemic types

| Type | Meaning | Can become a decision automatically? |
|---|---|---|
| `user_statement` | What the user actually said | No |
| `external_evidence` | A source-backed observation | No |
| `agent_inference` | Codex interpretation | Never |
| `question` | A material unknown | No |
| `decision` | A proposed or user-accepted choice | Only through explicit confirmation |

## Decision lifecycle

```text
proposed → accepted
```

An accepted decision is not overwritten. Capture later pressure as a change and create a new proposal.

## Readiness

Planning is `ready` only when:

- the objective is explicitly confirmed;
- no blocking question remains open;
- no blocking decision remains proposed;
- no blocking implementation-time change remains unresolved; and
- structural validation passes.

`ready` means enough is known to commit to the next implementation slice. It does not mean all uncertainty is gone.

## Manifest contract

The manifest is a deterministic projection of a planning revision. The model may select when to display it, but may not author its fields. `planning_render_manifest` accepts a server-created immutable snapshot ID rather than arbitrary display data.
