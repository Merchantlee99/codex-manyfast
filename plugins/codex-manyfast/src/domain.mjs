import { createHash, randomUUID } from "node:crypto";

export const STATE_SCHEMA_VERSION = "0.1.0";

export class PlanningError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlanningError";
    this.code = code;
    this.details = details;
  }
}

export function createInitialState({ projectId, objective, now = new Date().toISOString() }) {
  if (!projectId?.trim()) throw new PlanningError("INVALID_PROJECT_ID", "projectId is required");
  if (!objective?.trim()) throw new PlanningError("INVALID_OBJECTIVE", "objective is required");

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    projectId: projectId.trim(),
    revision: 1,
    objective: {
      statement: objective.trim(),
      status: "proposed",
      confirmationQuote: null,
    },
    observations: [],
    questions: [],
    decisions: [],
    requirements: [],
    changes: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function confirmObjective(state, { confirmationQuote }) {
  requireConfirmation(confirmationQuote);
  return {
    ...state,
    objective: {
      ...state.objective,
      status: "confirmed",
      confirmationQuote: confirmationQuote.trim(),
    },
  };
}

export function addObservation(state, input) {
  const allowedKinds = new Set(["user_statement", "external_evidence", "agent_inference"]);
  if (!allowedKinds.has(input.kind)) {
    throw new PlanningError("INVALID_OBSERVATION_KIND", `Unsupported observation kind: ${input.kind}`);
  }
  if (!input.content?.trim()) {
    throw new PlanningError("INVALID_OBSERVATION", "Observation content is required");
  }
  if (input.kind === "external_evidence" && !input.sourceUrl?.trim()) {
    throw new PlanningError("MISSING_PROVENANCE", "External evidence requires sourceUrl");
  }

  const observation = {
    id: input.id ?? makeId("OBS"),
    kind: input.kind,
    content: input.content.trim(),
    sourceUrl: input.sourceUrl?.trim() ?? null,
    sourceTitle: input.sourceTitle?.trim() ?? null,
    status: input.kind === "agent_inference" ? "unconfirmed" : "recorded",
    createdAt: input.now ?? new Date().toISOString(),
  };
  return { state: { ...state, observations: [...state.observations, observation] }, observation };
}

export function addQuestion(state, input) {
  if (!input.question?.trim()) throw new PlanningError("INVALID_QUESTION", "Question is required");
  const question = {
    id: input.id ?? makeId("QUE"),
    question: input.question.trim(),
    status: "open",
    blocking: Boolean(input.blocking),
    reason: input.reason?.trim() ?? null,
    answeredByDecisionId: null,
    createdAt: input.now ?? new Date().toISOString(),
  };
  return { state: { ...state, questions: [...state.questions, question] }, question };
}

export function proposeDecision(state, input) {
  if (!input.question?.trim()) throw new PlanningError("INVALID_DECISION", "Decision question is required");
  if (!input.proposal?.trim()) throw new PlanningError("INVALID_DECISION", "Decision proposal is required");

  ensureReferencesExist(state, input.supportedBy ?? []);
  const decision = {
    id: input.id ?? makeId("DEC"),
    question: input.question.trim(),
    proposal: input.proposal.trim(),
    alternatives: normalizeStrings(input.alternatives),
    supportedBy: [...(input.supportedBy ?? [])],
    status: "proposed",
    blocking: Boolean(input.blocking),
    confirmationQuote: null,
    reopenWhen: normalizeStrings(input.reopenWhen),
    createdAt: input.now ?? new Date().toISOString(),
    acceptedAt: null,
  };
  return { state: { ...state, decisions: [...state.decisions, decision] }, decision };
}

export function acceptDecision(state, { decisionId, confirmationQuote, now = new Date().toISOString() }) {
  requireConfirmation(confirmationQuote);
  const index = state.decisions.findIndex((decision) => decision.id === decisionId);
  if (index < 0) throw new PlanningError("DECISION_NOT_FOUND", `Decision not found: ${decisionId}`);
  if (state.decisions[index].status !== "proposed") {
    throw new PlanningError("INVALID_TRANSITION", "Only proposed decisions can be accepted");
  }

  const decision = {
    ...state.decisions[index],
    status: "accepted",
    confirmationQuote: confirmationQuote.trim(),
    acceptedAt: now,
  };
  const decisions = [...state.decisions];
  decisions[index] = decision;
  const questions = state.questions.map((question) =>
    question.status === "open" && normalize(question.question) === normalize(decision.question)
      ? { ...question, status: "answered", answeredByDecisionId: decision.id }
      : question,
  );
  return { state: { ...state, decisions, questions }, decision };
}

export function addRequirement(state, input) {
  if (!input.statement?.trim()) throw new PlanningError("INVALID_REQUIREMENT", "Requirement statement is required");
  if (!input.decisionIds?.length) {
    throw new PlanningError("MISSING_DECISION_LINK", "Requirement requires at least one decisionId");
  }
  for (const decisionId of input.decisionIds) {
    const decision = state.decisions.find((item) => item.id === decisionId);
    if (!decision || decision.status !== "accepted") {
      throw new PlanningError("INVALID_DECISION_LINK", `Requirement decision is not accepted: ${decisionId}`);
    }
  }
  if (!input.acceptanceCriteria?.length) {
    throw new PlanningError("MISSING_ACCEPTANCE_CRITERIA", "Requirement requires acceptance criteria");
  }

  const requirement = {
    id: input.id ?? makeId("REQ"),
    statement: input.statement.trim(),
    decisionIds: [...input.decisionIds],
    acceptanceCriteria: normalizeStrings(input.acceptanceCriteria),
    status: "active",
    createdAt: input.now ?? new Date().toISOString(),
  };
  return { state: { ...state, requirements: [...state.requirements, requirement] }, requirement };
}

export function createChange(state, input) {
  if (!input.summary?.trim()) throw new PlanningError("INVALID_CHANGE", "Change summary is required");
  const affectedIds = normalizeStrings(input.affectedIds);
  for (const id of affectedIds) {
    if (![...state.decisions, ...state.requirements].some((item) => item.id === id)) {
      throw new PlanningError("INVALID_CHANGE_TARGET", `Unknown affected item: ${id}`);
    }
  }
  const change = {
    id: input.id ?? makeId("CHG"),
    summary: input.summary.trim(),
    reason: input.reason?.trim() ?? null,
    affectedIds,
    blocking: Boolean(input.blocking),
    status: "captured",
    createdAt: input.now ?? new Date().toISOString(),
  };
  return { state: { ...state, changes: [...state.changes, change] }, change };
}

export function validateState(state) {
  const errors = [];
  const warnings = [];
  if (state.schemaVersion !== STATE_SCHEMA_VERSION) {
    errors.push(issue("UNSUPPORTED_SCHEMA", `Expected ${STATE_SCHEMA_VERSION}, got ${state.schemaVersion}`));
  }
  if (!Number.isInteger(state.revision) || state.revision < 1) {
    errors.push(issue("INVALID_REVISION", "revision must be a positive integer"));
  }
  if (state.objective.status === "confirmed" && !state.objective.confirmationQuote) {
    errors.push(issue("UNCONFIRMED_OBJECTIVE", "Confirmed objective is missing confirmationQuote"));
  }
  for (const observation of state.observations) {
    if (observation.kind === "external_evidence" && !observation.sourceUrl) {
      errors.push(issue("MISSING_PROVENANCE", `${observation.id} is missing sourceUrl`, [observation.id]));
    }
  }
  for (const decision of state.decisions) {
    if (decision.status === "accepted" && !decision.confirmationQuote) {
      errors.push(issue("UNCONFIRMED_DECISION", `${decision.id} is missing confirmationQuote`, [decision.id]));
    }
    for (const reference of decision.supportedBy) {
      if (!state.observations.some((item) => item.id === reference)) {
        errors.push(issue("BROKEN_EVIDENCE_LINK", `${decision.id} references ${reference}`, [decision.id, reference]));
      }
    }
  }
  for (const requirement of state.requirements) {
    if (!requirement.acceptanceCriteria.length) {
      errors.push(issue("MISSING_ACCEPTANCE_CRITERIA", `${requirement.id} has no acceptance criteria`, [requirement.id]));
    }
    for (const decisionId of requirement.decisionIds) {
      const decision = state.decisions.find((item) => item.id === decisionId);
      if (!decision || decision.status !== "accepted") {
        errors.push(issue("BROKEN_DECISION_LINK", `${requirement.id} references unaccepted ${decisionId}`, [requirement.id, decisionId]));
      }
    }
  }
  if (state.observations.some((item) => item.kind === "agent_inference" && item.status === "unconfirmed")) {
    warnings.push(issue("OPEN_INFERENCE", "Unconfirmed agent interpretations remain"));
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function readiness(state) {
  const validation = validateState(state);
  const blockers = [];
  if (state.objective.status !== "confirmed") blockers.push("Objective is not user-confirmed");
  blockers.push(...state.questions.filter((item) => item.status === "open" && item.blocking).map((item) => item.question));
  blockers.push(...state.decisions.filter((item) => item.status === "proposed" && item.blocking).map((item) => item.question));
  blockers.push(...state.changes.filter((item) => item.status === "captured" && item.blocking).map((item) => item.summary));
  blockers.push(...validation.errors.map((item) => item.message));
  return { status: blockers.length ? "not_ready" : "ready", blockers, validation };
}

export function stableHash(value) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function ensureReferencesExist(state, references) {
  for (const reference of references) {
    if (!state.observations.some((item) => item.id === reference)) {
      throw new PlanningError("OBSERVATION_NOT_FOUND", `Observation not found: ${reference}`);
    }
  }
}

function requireConfirmation(value) {
  if (!value?.trim()) {
    throw new PlanningError("EXPLICIT_CONFIRMATION_REQUIRED", "A verbatim user confirmation is required");
  }
}

function normalizeStrings(values = []) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))];
}

function makeId(prefix) {
  return `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function normalize(value) {
  return value.trim().toLocaleLowerCase();
}

function issue(code, message, relatedIds = []) {
  return { code, message, relatedIds };
}
