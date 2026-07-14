# Local verification — 2026-07-14

Environment:

- macOS arm64
- Node.js `v24.11.1`
- npm `11.6.2`
- app-bundled Codex CLI `0.144.2`
- Google Chrome headless through Playwright `1.61.1`

## Automated release gate

Command:

```bash
npm run check
```

Result: `11/11` tests passed.

Covered states:

- inference remains unconfirmed;
- external evidence without provenance is rejected;
- decision acceptance requires a confirmation quote;
- readiness follows confirmed objective and blocker state;
- manifest projection is deterministic;
- bundled MCP server starts through STDIO;
- rendered structured content exactly matches the stored snapshot;
- stale revisions return `STALE_REVISION`;
- event log and immutable snapshots persist;
- desktop and mobile-width Chromium rendering has no horizontal overflow; and
- unsupported widget schemas fail closed.

## Plugin validator

Command:

```bash
python3 ~/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py plugins/codex-manyfast
```

Result: plugin validation passed.

## Clean Codex install sentinel

The repository marketplace was added to a temporary `CODEX_HOME`, then `codex-manyfast@codex-manyfast` was installed and listed. The installed copy resolved to the plugin source in this repository and reported version `0.1.0`, enabled `true`.

The temporary home was removed after the test, so the user's existing Codex plugin configuration was not modified.

## Installed Codex desktop run

The repository marketplace was then added to the actual app-bundled Codex environment and plugin build `0.1.0+codex.20260714074541` was installed and reported as enabled.

Actual Codex task: `019f5f97-7297-7d00-9b86-4be65399619c`

The task completed these MCP calls against the projectless workspace `/Users/isanginn/Documents/Codex/2026-07-14/codex-manyfast-live-proof`:

1. `planning_get_state` — expected initial failure because no store existed;
2. `planning_init` — revision 1;
3. `planning_confirm_objective` — revision 2;
4. `planning_record_observation` — observation `OBS-D7AD5DC1`, revision 3;
5. `planning_add_question` — blocker `QUE-81AE5C65`, revision 4;
6. `planning_get_manifest` — snapshot `manifest-r4-dede70506f36`;
7. `planning_render_manifest` — completed with `Showing planning revision 4.`

The completed task reported integrity `passed` and readiness `not_ready`. The question remained open; the agent did not invent an answer.

## Actual Codex visual evidence

Output:

```text
plugins/codex-manyfast/assets/manifest-preview.png
```

The image was captured from the actual Codex desktop task after `planning_render_manifest` completed. It visibly contains the user prompt, the inline Planning Manifest, and the completion summary with the same snapshot ID. It was cropped only to remove unrelated task names and desktop content.

## Standalone harness evidence

Command:

```bash
npm run capture
```

Output:

```text
plugins/codex-manyfast/assets/manifest-harness.png
```

This second image is the reproducible local host harness. It uses the same widget renderer and MCP `structuredContent` contract, but it is kept separate from the actual Codex desktop evidence.
