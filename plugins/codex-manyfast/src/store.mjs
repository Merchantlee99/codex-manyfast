import { appendFile, mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PlanningError, createInitialState } from "./domain.mjs";
import { projectManifest } from "./manifest.mjs";

const STORE_DIR = ".codex-manyfast";

export function storePaths(workspaceRoot) {
  const root = path.resolve(workspaceRoot);
  return {
    root,
    directory: path.join(root, STORE_DIR),
    state: path.join(root, STORE_DIR, "state.json"),
    events: path.join(root, STORE_DIR, "events.jsonl"),
    snapshots: path.join(root, STORE_DIR, "snapshots"),
    lock: path.join(root, STORE_DIR, ".lock"),
  };
}

export async function initializeStore(workspaceRoot, input) {
  const paths = storePaths(workspaceRoot);
  await mkdir(paths.snapshots, { recursive: true });
  try {
    await readFile(paths.state, "utf8");
    throw new PlanningError("PROJECT_ALREADY_INITIALIZED", `Planning store already exists at ${paths.directory}`);
  } catch (error) {
    if (error instanceof PlanningError) throw error;
    if (error.code !== "ENOENT") throw error;
  }
  const state = createInitialState(input);
  await writeJsonAtomic(paths.state, state);
  await appendEvent(paths.events, { seq: 1, revision: 1, type: "project_initialized", at: state.createdAt });
  return state;
}

export async function readState(workspaceRoot) {
  const paths = storePaths(workspaceRoot);
  try {
    return JSON.parse(await readFile(paths.state, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new PlanningError("PROJECT_NOT_INITIALIZED", `No planning store at ${paths.directory}`);
    }
    throw error;
  }
}

export async function mutateState(workspaceRoot, { expectedRevision, eventType, eventPayload = {}, mutate }) {
  const paths = storePaths(workspaceRoot);
  await mkdir(paths.directory, { recursive: true });
  const lock = await acquireLock(paths.lock);
  try {
    const current = await readState(workspaceRoot);
    if (current.revision !== expectedRevision) {
      throw new PlanningError("STALE_REVISION", `Expected revision ${expectedRevision}, current revision is ${current.revision}`, {
        expectedRevision,
        actualRevision: current.revision,
      });
    }
    const result = await mutate(structuredClone(current));
    const nextState = result?.state ?? result;
    const now = new Date().toISOString();
    nextState.revision = current.revision + 1;
    nextState.updatedAt = now;
    await writeJsonAtomic(paths.state, nextState);
    await appendEvent(paths.events, {
      seq: nextState.revision,
      revision: nextState.revision,
      type: eventType,
      at: now,
      payload: eventPayload,
    });
    return { state: nextState, result: result?.state ? result : null };
  } finally {
    await lock.close();
    await rm(paths.lock, { force: true });
  }
}

export async function createManifestSnapshot(workspaceRoot) {
  const paths = storePaths(workspaceRoot);
  const state = await readState(workspaceRoot);
  const snapshot = projectManifest(state);
  await mkdir(paths.snapshots, { recursive: true });
  await writeJsonAtomic(path.join(paths.snapshots, `${snapshot.snapshotId}.json`), snapshot);
  return snapshot;
}

export async function readManifestSnapshot(workspaceRoot, snapshotId) {
  if (!/^manifest-r\d+-[a-f0-9]{12}$/.test(snapshotId)) {
    throw new PlanningError("INVALID_SNAPSHOT_ID", "Invalid manifest snapshot ID");
  }
  const paths = storePaths(workspaceRoot);
  const snapshotPath = path.join(paths.snapshots, `${snapshotId}.json`);
  try {
    return JSON.parse(await readFile(snapshotPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw new PlanningError("SNAPSHOT_NOT_FOUND", `Snapshot not found: ${snapshotId}`);
    throw error;
  }
}

async function acquireLock(lockPath) {
  try {
    return await open(lockPath, "wx", 0o600);
  } catch (error) {
    if (error.code === "EEXIST") throw new PlanningError("STORE_BUSY", "Planning state is being updated by another process");
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, filePath);
}

async function appendEvent(filePath, event) {
  await appendFile(filePath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
}
