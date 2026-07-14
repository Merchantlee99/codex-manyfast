import { readiness, stableHash } from "./domain.mjs";

export const MANIFEST_SCHEMA_VERSION = "1.0.0";

export function projectManifest(state, { now = state.updatedAt } = {}) {
  const currentReadiness = readiness(state);
  const manifest = {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    projectId: state.projectId,
    projectRevision: state.revision,
    generatedAt: now,
    objective: {
      statement: state.objective.statement,
      status: state.objective.status,
    },
    readiness: {
      status: currentReadiness.status,
      blockers: currentReadiness.blockers,
      integrity: currentReadiness.validation.valid ? "passed" : "failed",
    },
    acceptedDecisions: state.decisions
      .filter((item) => item.status === "accepted")
      .map((item) => ({
        id: item.id,
        question: item.question,
        decision: item.proposal,
        evidenceCount: item.supportedBy.length,
        reopenWhen: item.reopenWhen,
      })),
    openQuestions: state.questions
      .filter((item) => item.status === "open")
      .map((item) => ({ id: item.id, question: item.question, blocking: item.blocking, reason: item.reason })),
    proposedDecisions: state.decisions
      .filter((item) => item.status === "proposed")
      .map((item) => ({ id: item.id, question: item.question, proposal: item.proposal, blocking: item.blocking })),
    evidenceHealth: {
      userStatements: state.observations.filter((item) => item.kind === "user_statement").length,
      externalEvidence: state.observations.filter((item) => item.kind === "external_evidence").length,
      unconfirmedInferences: state.observations.filter((item) => item.kind === "agent_inference" && item.status === "unconfirmed").length,
    },
    requirements: state.requirements.map((item) => ({
      id: item.id,
      statement: item.statement,
      decisionIds: item.decisionIds,
      acceptanceCriteriaCount: item.acceptanceCriteria.length,
    })),
    recentChanges: state.changes.slice(-5).reverse().map((item) => ({
      id: item.id,
      summary: item.summary,
      blocking: item.blocking,
      status: item.status,
      affectedIds: item.affectedIds,
    })),
  };
  const contentHash = stableHash(manifest);
  return {
    snapshotId: `manifest-r${state.revision}-${contentHash.slice(0, 12)}`,
    contentHash: `sha256:${contentHash}`,
    manifest,
  };
}
