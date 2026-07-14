import test from "node:test";
import assert from "node:assert/strict";
import {
  PlanningError,
  acceptDecision,
  addObservation,
  addQuestion,
  addRequirement,
  confirmObjective,
  createInitialState,
  proposeDecision,
  readiness,
  stableHash,
} from "../src/domain.mjs";
import { projectManifest } from "../src/manifest.mjs";

test("agent inference stays unconfirmed and cannot masquerade as evidence", () => {
  const state = createInitialState({ projectId: "demo", objective: "Clarify the build", now: "2026-01-01T00:00:00.000Z" });
  const result = addObservation(state, { id: "OBS-1", kind: "agent_inference", content: "Users probably want teams", now: "2026-01-01T00:00:01.000Z" });
  assert.equal(result.observation.status, "unconfirmed");
  assert.equal(readiness(result.state).validation.warnings[0].code, "OPEN_INFERENCE");
});

test("external evidence requires provenance", () => {
  const state = createInitialState({ projectId: "demo", objective: "Clarify the build" });
  assert.throws(
    () => addObservation(state, { kind: "external_evidence", content: "A claim without a URL" }),
    (error) => error instanceof PlanningError && error.code === "MISSING_PROVENANCE",
  );
});

test("decision acceptance requires verbatim confirmation", () => {
  const initial = createInitialState({ projectId: "demo", objective: "Clarify the build" });
  const proposed = proposeDecision(initial, { id: "DEC-1", question: "Who is first?", proposal: "Solo builders", blocking: true }).state;
  assert.throws(
    () => acceptDecision(proposed, { decisionId: "DEC-1", confirmationQuote: "" }),
    (error) => error.code === "EXPLICIT_CONFIRMATION_REQUIRED",
  );
});

test("readiness changes only after objective and blockers are confirmed", () => {
  let state = createInitialState({ projectId: "demo", objective: "Clarify the build" });
  state = confirmObjective(state, { confirmationQuote: "Yes, that is the objective." });
  state = addQuestion(state, { id: "QUE-1", question: "Who is first?", blocking: true }).state;
  state = proposeDecision(state, { id: "DEC-1", question: "Who is first?", proposal: "Solo builders", blocking: true }).state;
  assert.equal(readiness(state).status, "not_ready");
  state = acceptDecision(state, { decisionId: "DEC-1", confirmationQuote: "Start with solo builders." }).state;
  assert.equal(readiness(state).status, "ready");
  state = addRequirement(state, { id: "REQ-1", statement: "Support a repo-local project", decisionIds: ["DEC-1"], acceptanceCriteria: ["State survives a new process"] }).state;
  assert.equal(readiness(state).status, "ready");
});

test("manifest projection is deterministic for the same revision", () => {
  const state = createInitialState({ projectId: "demo", objective: "Clarify the build", now: "2026-01-01T00:00:00.000Z" });
  const first = projectManifest(state, { now: "2026-01-01T00:00:00.000Z" });
  const second = projectManifest(structuredClone(state), { now: "2026-01-01T00:00:00.000Z" });
  assert.deepEqual(first, second);
  assert.equal(stableHash(first.manifest), first.contentHash.replace("sha256:", ""));
});
