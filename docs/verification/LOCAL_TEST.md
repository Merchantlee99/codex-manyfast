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

## Visual evidence

Command:

```bash
npm run capture
```

Output:

```text
plugins/codex-manyfast/assets/manifest-preview.png
```

The image was opened and inspected after capture. It shows the actual local host harness and the same widget renderer used by the MCP UI resource. It is not represented as a production Codex host screenshot.
