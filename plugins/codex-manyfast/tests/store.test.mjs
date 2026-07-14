import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PlanningError, confirmObjective } from "../src/domain.mjs";
import { createManifestSnapshot, initializeStore, mutateState, readManifestSnapshot, readState } from "../src/store.mjs";

test("repo-local store uses revisions, atomic state, and immutable manifest snapshots", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-manyfast-store-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeStore(root, { projectId: "demo", objective: "Plan safely", now: "2026-01-01T00:00:00.000Z" });
  const mutation = await mutateState(root, {
    expectedRevision: 1,
    eventType: "objective_confirmed",
    mutate: (state) => confirmObjective(state, { confirmationQuote: "Confirmed." }),
  });
  assert.equal(mutation.state.revision, 2);
  assert.equal((await readState(root)).objective.status, "confirmed");
  const snapshot = await createManifestSnapshot(root);
  assert.deepEqual(await readManifestSnapshot(root, snapshot.snapshotId), snapshot);
  const events = (await readFile(path.join(root, ".codex-manyfast/events.jsonl"), "utf8")).trim().split("\n");
  assert.equal(events.length, 2);
});

test("stale writes fail instead of overwriting newer planning", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "codex-manyfast-stale-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await initializeStore(root, { projectId: "demo", objective: "Plan safely" });
  await mutateState(root, { expectedRevision: 1, eventType: "objective_confirmed", mutate: (state) => confirmObjective(state, { confirmationQuote: "Confirmed." }) });
  await assert.rejects(
    mutateState(root, { expectedRevision: 1, eventType: "stale", mutate: (state) => state }),
    (error) => error instanceof PlanningError && error.code === "STALE_REVISION",
  );
});
