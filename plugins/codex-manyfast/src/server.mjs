#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";
import {
  PlanningError,
  acceptDecision,
  addObservation,
  addQuestion,
  addRequirement,
  confirmObjective,
  createChange,
  proposeDecision,
  readiness,
  validateState,
} from "./domain.mjs";
import {
  createManifestSnapshot,
  initializeStore,
  mutateState,
  readManifestSnapshot,
  readState,
} from "./store.mjs";
import { MANIFEST_TEMPLATE_URI, manifestWidgetHtml } from "./widget-template.mjs";

const server = new McpServer({ name: "codex-manyfast", version: "0.1.0" });

server.registerResource("planning-manifest", MANIFEST_TEMPLATE_URI, {}, async () => ({
  contents: [
    {
      uri: MANIFEST_TEMPLATE_URI,
      mimeType: "text/html;profile=mcp-app",
      text: manifestWidgetHtml(),
      _meta: {
        ui: { prefersBorder: true },
        "openai/widgetDescription": "A read-only planning manifest projected from authoritative local planning state.",
      },
    },
  ],
}));

register("planning_init", {
  title: "Initialize planning state",
  description: "Create a repo-local planning store. Use only after the user has named the project objective; the objective remains proposed until separately confirmed.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    projectId: z.string().min(1),
    objective: z.string().min(1),
  },
  annotations: writeAnnotations(false),
}, async ({ workspaceRoot, projectId, objective }) => {
  const state = await initializeStore(workspaceRoot, { projectId, objective });
  return stateResult(state, "Planning state initialized. The objective still requires explicit confirmation.");
});

register("planning_get_state", {
  title: "Read planning state",
  description: "Read the current authoritative planning revision without modifying it.",
  inputSchema: { workspaceRoot: z.string().min(1) },
  annotations: readAnnotations(),
}, async ({ workspaceRoot }) => {
  const state = await readState(workspaceRoot);
  return stateResult(state, `Planning revision ${state.revision}.`);
});

register("planning_confirm_objective", {
  title: "Confirm the project objective",
  description: "Mark the objective confirmed only after the user explicitly confirms it in the current conversation. Pass the user's verbatim confirmation.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    expectedRevision: z.number().int().positive(),
    confirmationQuote: z.string().min(1),
  },
  annotations: writeAnnotations(true),
}, async ({ workspaceRoot, expectedRevision, confirmationQuote }) => {
  const { state } = await mutateState(workspaceRoot, {
    expectedRevision,
    eventType: "objective_confirmed",
    eventPayload: { confirmationQuote },
    mutate: (current) => confirmObjective(current, { confirmationQuote }),
  });
  return stateResult(state, "Objective confirmed from the recorded user quote.");
});

register("planning_record_observation", {
  title: "Record a planning observation",
  description: "Record a user statement, external evidence with provenance, or an explicitly labeled unconfirmed agent inference.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    expectedRevision: z.number().int().positive(),
    kind: z.enum(["user_statement", "external_evidence", "agent_inference"]),
    content: z.string().min(1),
    sourceUrl: z.string().url().optional(),
    sourceTitle: z.string().optional(),
  },
  annotations: writeAnnotations(true),
}, async (input) => {
  const { workspaceRoot, expectedRevision, ...observationInput } = input;
  const mutation = await mutateState(workspaceRoot, {
    expectedRevision,
    eventType: "observation_recorded",
    eventPayload: { kind: observationInput.kind },
    mutate: (current) => addObservation(current, observationInput),
  });
  return entityResult(mutation, "observation", "Observation recorded without changing its epistemic type.");
});

register("planning_add_question", {
  title: "Add an open planning question",
  description: "Capture one unresolved question and whether it blocks affected implementation work.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    expectedRevision: z.number().int().positive(),
    question: z.string().min(1),
    blocking: z.boolean(),
    reason: z.string().optional(),
  },
  annotations: writeAnnotations(true),
}, async (input) => {
  const { workspaceRoot, expectedRevision, ...questionInput } = input;
  const mutation = await mutateState(workspaceRoot, {
    expectedRevision,
    eventType: "question_added",
    eventPayload: { blocking: questionInput.blocking },
    mutate: (current) => addQuestion(current, questionInput),
  });
  return entityResult(mutation, "question", "Open question captured.");
});

register("planning_propose_decision", {
  title: "Propose a decision",
  description: "Create a proposed decision with alternatives and evidence links. This tool never accepts the decision.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    expectedRevision: z.number().int().positive(),
    question: z.string().min(1),
    proposal: z.string().min(1),
    alternatives: z.array(z.string()).default([]),
    supportedBy: z.array(z.string()).default([]),
    blocking: z.boolean(),
    reopenWhen: z.array(z.string()).default([]),
  },
  annotations: writeAnnotations(true),
}, async (input) => {
  const { workspaceRoot, expectedRevision, ...decisionInput } = input;
  const mutation = await mutateState(workspaceRoot, {
    expectedRevision,
    eventType: "decision_proposed",
    eventPayload: { blocking: decisionInput.blocking },
    mutate: (current) => proposeDecision(current, decisionInput),
  });
  return entityResult(mutation, "decision", "Decision proposed. Explicit user acceptance is still required.");
});

register("planning_accept_decision", {
  title: "Accept a user-confirmed decision",
  description: "Accept a proposed decision only after explicit current-turn user confirmation. Pass the verbatim confirmation quote.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    expectedRevision: z.number().int().positive(),
    decisionId: z.string().min(1),
    confirmationQuote: z.string().min(1),
  },
  annotations: writeAnnotations(true),
}, async ({ workspaceRoot, expectedRevision, decisionId, confirmationQuote }) => {
  const mutation = await mutateState(workspaceRoot, {
    expectedRevision,
    eventType: "decision_accepted",
    eventPayload: { decisionId, confirmationQuote },
    mutate: (current) => acceptDecision(current, { decisionId, confirmationQuote }),
  });
  return entityResult(mutation, "decision", "Decision accepted with an explicit user quote.");
});

register("planning_add_requirement", {
  title: "Add a traced requirement",
  description: "Add a requirement only when it links to accepted decisions and has testable acceptance criteria.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    expectedRevision: z.number().int().positive(),
    statement: z.string().min(1),
    decisionIds: z.array(z.string()).min(1),
    acceptanceCriteria: z.array(z.string()).min(1),
  },
  annotations: writeAnnotations(true),
}, async (input) => {
  const { workspaceRoot, expectedRevision, ...requirementInput } = input;
  const mutation = await mutateState(workspaceRoot, {
    expectedRevision,
    eventType: "requirement_added",
    eventPayload: { decisionIds: requirementInput.decisionIds },
    mutate: (current) => addRequirement(current, requirementInput),
  });
  return entityResult(mutation, "requirement", "Traced requirement added.");
});

register("planning_capture_change", {
  title: "Capture additional planning",
  description: "Capture a planning delta discovered during implementation and identify the affected decisions or requirements.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    expectedRevision: z.number().int().positive(),
    summary: z.string().min(1),
    reason: z.string().optional(),
    affectedIds: z.array(z.string()).default([]),
    blocking: z.boolean(),
  },
  annotations: writeAnnotations(true),
}, async (input) => {
  const { workspaceRoot, expectedRevision, ...changeInput } = input;
  const mutation = await mutateState(workspaceRoot, {
    expectedRevision,
    eventType: "change_captured",
    eventPayload: { affectedIds: changeInput.affectedIds, blocking: changeInput.blocking },
    mutate: (current) => createChange(current, changeInput),
  });
  return entityResult(mutation, "change", "Planning delta captured for impact review.");
});

register("planning_validate", {
  title: "Validate planning integrity",
  description: "Check structural traceability and readiness without changing planning state.",
  inputSchema: { workspaceRoot: z.string().min(1) },
  annotations: readAnnotations(),
}, async ({ workspaceRoot }) => {
  const state = await readState(workspaceRoot);
  const validation = validateState(state);
  const currentReadiness = readiness(state);
  const structuredContent = { revision: state.revision, validation, readiness: currentReadiness };
  return { structuredContent, content: [{ type: "text", text: summarizeValidation(structuredContent) }] };
});

register("planning_get_manifest", {
  title: "Create a planning manifest snapshot",
  description: "Project the current authoritative state into an immutable, validated manifest snapshot. This data tool does not render UI.",
  inputSchema: { workspaceRoot: z.string().min(1) },
  annotations: readAnnotations(),
}, async ({ workspaceRoot }) => {
  const snapshot = await createManifestSnapshot(workspaceRoot);
  return {
    structuredContent: snapshot,
    content: [{ type: "text", text: `Created ${snapshot.snapshotId} from revision ${snapshot.manifest.projectRevision}.` }],
  };
});

register("planning_render_manifest", {
  title: "Render a planning manifest",
  description: "Render an existing immutable manifest snapshot. Call planning_get_manifest first and pass only its snapshotId; never reconstruct the manifest in the model.",
  inputSchema: {
    workspaceRoot: z.string().min(1),
    snapshotId: z.string().regex(/^manifest-r\d+-[a-f0-9]{12}$/),
  },
  annotations: readAnnotations(),
  _meta: {
    ui: { resourceUri: MANIFEST_TEMPLATE_URI },
    "openai/outputTemplate": MANIFEST_TEMPLATE_URI,
    "openai/toolInvocation/invoking": "Rendering planning manifest…",
    "openai/toolInvocation/invoked": "Planning manifest ready",
  },
}, async ({ workspaceRoot, snapshotId }) => {
  const snapshot = await readManifestSnapshot(workspaceRoot, snapshotId);
  return {
    structuredContent: snapshot,
    content: [{ type: "text", text: `Showing planning revision ${snapshot.manifest.projectRevision}.` }],
  };
});

await server.connect(new StdioServerTransport());

function register(name, descriptor, handler) {
  server.registerTool(name, descriptor, async (input) => {
    try {
      return await handler(input);
    } catch (error) {
      const normalized = normalizeError(error);
      return {
        isError: true,
        structuredContent: normalized,
        content: [{ type: "text", text: `${normalized.code}: ${normalized.message}` }],
      };
    }
  });
}

function stateResult(state, message) {
  return {
    structuredContent: { state, readiness: readiness(state) },
    content: [{ type: "text", text: `${message} Revision ${state.revision}.` }],
  };
}

function entityResult(mutation, key, message) {
  const entity = mutation.result?.[key] ?? null;
  return {
    structuredContent: { [key]: entity, revision: mutation.state.revision, readiness: readiness(mutation.state) },
    content: [{ type: "text", text: `${message} Revision ${mutation.state.revision}.` }],
  };
}

function readAnnotations() {
  return { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true };
}

function writeAnnotations(idempotent) {
  return { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: idempotent };
}

function normalizeError(error) {
  if (error instanceof PlanningError) return { code: error.code, message: error.message, details: error.details };
  return { code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : String(error), details: {} };
}

function summarizeValidation(result) {
  const status = result.readiness.status.toUpperCase();
  return `Planning revision ${result.revision}: ${status}. ${result.validation.errors.length} errors, ${result.validation.warnings.length} warnings.`;
}
