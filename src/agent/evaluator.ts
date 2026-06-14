import type { DiscoveryRunResult } from "../discovery/discovery-pass";
import {
  finishAgentExperiment,
  listAgentSteps,
  recordAgentEvaluation,
  recordAgentExperiment,
  recordAgentPlaybookEntry,
  recordAgentReflection,
  recordAgentStep,
  type AgentEvaluationVerdict,
  type AgentExperiment,
  type AgentExperimentStatus,
  type AgentGuardrailDecision,
  type AgentOperatorReview,
  type AgentPlaybookEntry,
  type AgentPlaybookEntryKind,
  type AgentReflectionOutcome,
  type AgentRun,
  type AgentRunContext,
  type AgentRunPlan,
  type AgentStep,
  type AgentWorkingMemory,
} from "../storage/agent";
import {
  compactResponseTrace,
  functionCalls,
  type OpenAIResponse,
  type OpenAIResponseOutputItem,
  type OpenAIResponsesClient,
  type OpenAIResponsesConfig,
} from "./openai";
import { operatorReviewForPrompt, reflectionInstructions, reflectionToolDefinitions } from "./prompts";

type GuardrailEventSummary = {
  toolName: string;
  decision: AgentGuardrailDecision;
  reason: string;
};

export async function evaluateCompletedRun(input: {
  run: AgentRun;
  summary: string;
  discoveryResult: DiscoveryRunResult | null;
  toolCalls: Array<{ name: string; ok: boolean }>;
  guardrailEvents: GuardrailEventSummary[];
  episodePlan: AgentRunPlan | null;
  workingMemory: AgentWorkingMemory | null;
  recommendationsRecorded: number;
  operatorReviewsRecorded: number;
  activeExperiment: AgentExperiment | null;
  resumedOperatorReview: AgentOperatorReview | null;
  runContext: AgentRunContext | null;
  activePlaybookEntries: AgentPlaybookEntry[];
  stepIndex: number;
  client: OpenAIResponsesClient;
  config: OpenAIResponsesConfig;
}) {
  try {
    const steps = listAgentSteps(input.run.id).slice(-24);
    const response = await input.client.createResponse({
      model: input.config.model,
      instructions: reflectionInstructions(),
      input: [{
        role: "user",
        content: [{
          type: "input_text",
          text: JSON.stringify(evaluationPayload(input, steps)),
        }],
      }],
      tools: reflectionToolDefinitions(),
      tool_choice: "required",
      parallel_tool_calls: false,
      reasoning: {
        effort: "low",
      },
      text: {
        verbosity: "low",
      },
      store: false,
      metadata: {
        app: "nyc-apt-radar",
        agent_run_id: input.run.id,
        phase: "episode_evaluation",
      },
    });

    recordAgentStep({
      runId: input.run.id,
      stepIndex: input.stepIndex,
      kind: "model_response",
      input: { phase: "episode_evaluation" },
      output: compactResponseTrace(response),
    });

    const draft = episodeEvaluationDraftFromResponse(response);
    const reflection = recordAgentReflection({
      runId: input.run.id,
      score: draft.reflection.score,
      outcome: draft.reflection.outcome,
      summary: draft.reflection.summary,
      lessons: draft.reflection.lessons,
      nextRunGuidance: draft.reflection.nextRunGuidance,
    });
    const evaluation = recordAgentEvaluation({
      runId: input.run.id,
      verdict: draft.verdict,
      objectiveAlignment: draft.objectiveAlignment,
      evidenceGrounding: draft.evidenceGrounding,
      toolDiscipline: draft.toolDiscipline,
      safetyDiscipline: draft.safetyDiscipline,
      operatorValue: draft.operatorValue,
      learningQuality: draft.learningQuality,
      findings: draft.findings,
      nextExperiment: draft.nextExperiment,
    });
    const playbookEntries = draft.playbookUpdates.map((update) => recordAgentPlaybookEntry({
      sourceRunId: input.run.id,
      kind: update.kind,
      instruction: update.instruction,
      rationale: update.rationale,
    }));
    const completedExperiment = input.activeExperiment
      ? finishAgentExperiment(input.activeExperiment.id, {
        status: experimentCompletionStatus(draft.experimentResult.status),
        completedRunId: input.run.id,
        resultSummary: draft.experimentResult.summary,
      })
      : null;
    const queuedExperiment = draft.nextExperiment.trim()
      ? recordAgentExperiment({
        sourceRunId: input.run.id,
        description: draft.nextExperiment,
      })
      : null;

    return { reflection, evaluation, playbookEntries, completedExperiment, queuedExperiment };
  } catch (error) {
    recordAgentStep({
      runId: input.run.id,
      stepIndex: input.stepIndex,
      kind: "model_response",
      input: { phase: "episode_evaluation" },
      output: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    const completedExperiment = input.activeExperiment
      ? finishAgentExperiment(input.activeExperiment.id, {
        status: "failed",
        completedRunId: input.run.id,
        resultSummary: "Episode evaluation failed before the active experiment could be judged.",
      })
      : null;

    return { reflection: null, evaluation: null, playbookEntries: [], completedExperiment, queuedExperiment: null };
  }
}

function evaluationPayload(
  input: Parameters<typeof evaluateCompletedRun>[0],
  steps: AgentStep[],
) {
  return {
    objective: input.run.objective,
    status: input.run.status,
    summary: input.summary,
    iterations: input.run.iterations,
    toolCalls: input.toolCalls,
    guardrails: input.guardrailEvents,
    episodePlan: input.episodePlan,
    workingMemory: input.workingMemory,
    recommendationsRecorded: input.recommendationsRecorded,
    operatorReviewsRecorded: input.operatorReviewsRecorded,
    activePlaybookEntries: input.activePlaybookEntries.map((entry) => ({
      kind: entry.kind,
      instruction: entry.instruction,
      rationale: entry.rationale,
      sourceRunId: entry.sourceRunId,
    })),
    activeExperiment: input.activeExperiment ? {
      id: input.activeExperiment.id,
      description: input.activeExperiment.description,
      sourceRunId: input.activeExperiment.sourceRunId,
    } : null,
    resumedOperatorReview: input.resumedOperatorReview ? operatorReviewForPrompt(input.resumedOperatorReview) : null,
    runContext: input.runContext,
    discovery: input.discoveryResult ? {
      searchesChecked: input.discoveryResult.searchesChecked,
      documentsSeen: input.discoveryResult.documentsSeen,
      duplicateDocuments: input.discoveryResult.duplicateDocuments,
      listingsFound: input.discoveryResult.listingsFound,
      notificationsSent: input.discoveryResult.notificationsSent,
      notificationsSkipped: input.discoveryResult.notificationsSkipped,
      notificationsFailed: input.discoveryResult.notificationsFailed,
      errors: input.discoveryResult.errors,
    } : null,
    trace: steps.map(compactStepForReflection),
  };
}

function compactStepForReflection(step: AgentStep) {
  return {
    kind: step.kind,
    toolName: step.toolName,
    input: parseJsonField(step.inputJson),
    output: summarizeJson(parseJsonField(step.outputJson)),
  };
}

function episodeEvaluationDraftFromResponse(response: OpenAIResponse) {
  const calls = functionCalls(response).filter((item) => item.name === "record_episode_evaluation");
  if (!calls.length) {
    throw new Error("Evaluation response did not call record_episode_evaluation.");
  }

  if (calls.length > 1) {
    throw new Error("Evaluation response called record_episode_evaluation more than once.");
  }

  const call = calls[0];
  const parsed = parseToolArguments(call);
  const reflection = requiredRecord(parsed.reflection, "reflection");
  const experimentResult = requiredRecord(parsed.experimentResult, "experimentResult");

  return {
    verdict: requiredEvaluationVerdict(parsed.verdict, "verdict"),
    objectiveAlignment: requiredScore(parsed.objectiveAlignment, "objectiveAlignment"),
    evidenceGrounding: requiredScore(parsed.evidenceGrounding, "evidenceGrounding"),
    toolDiscipline: requiredScore(parsed.toolDiscipline, "toolDiscipline"),
    safetyDiscipline: requiredScore(parsed.safetyDiscipline, "safetyDiscipline"),
    operatorValue: requiredScore(parsed.operatorValue, "operatorValue"),
    learningQuality: requiredScore(parsed.learningQuality, "learningQuality"),
    findings: requiredStringArray(parsed.findings, "findings", 1, 5),
    nextExperiment: requiredString(parsed.nextExperiment, "nextExperiment"),
    playbookUpdates: requiredPlaybookUpdates(parsed.playbookUpdates),
    experimentResult: {
      status: requiredExperimentEvaluationStatus(experimentResult.status, "experimentResult.status"),
      summary: requiredString(experimentResult.summary, "experimentResult.summary"),
    },
    reflection: {
      score: requiredScore(reflection.score, "reflection.score"),
      outcome: requiredReflectionOutcome(reflection.outcome, "reflection.outcome"),
      summary: requiredString(reflection.summary, "reflection.summary"),
      lessons: requiredStringArray(reflection.lessons, "reflection.lessons", 1, 4),
      nextRunGuidance: requiredString(reflection.nextRunGuidance, "reflection.nextRunGuidance"),
    },
  };
}

function parseToolArguments(call: OpenAIResponseOutputItem) {
  try {
    const parsed = JSON.parse(call.arguments ?? "{}") as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function requiredPlaybookUpdates(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Evaluation field playbookUpdates must be an array.");
  }

  if (value.length < 1 || value.length > 5) {
    throw new Error("Evaluation field playbookUpdates must contain 1-5 item(s).");
  }

  return value.flatMap((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Evaluation field playbookUpdates[${index}] must be an object.`);
    }

    return [{
      kind: requiredPlaybookEntryKind(item.kind, `playbookUpdates[${index}].kind`),
      instruction: requiredString(item.instruction, `playbookUpdates[${index}].instruction`),
      rationale: requiredString(item.rationale, `playbookUpdates[${index}].rationale`),
    }];
  });
}

function requiredRecord(value: unknown, field: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`Evaluation field ${field} must be an object.`);
  }

  return value;
}

function requiredString(value: unknown, field: string) {
  const parsed = stringField(value);
  if (!parsed) {
    throw new Error(`Evaluation field ${field} must be a non-empty string.`);
  }

  return parsed;
}

function requiredStringArray(value: unknown, field: string, minItems: number, maxItems: number): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`Evaluation field ${field} must be an array.`);
  }

  const parsed = value.map((item, index) => {
    if (typeof item !== "string" || !item.trim()) {
      throw new Error(`Evaluation field ${field}[${index}] must be a non-empty string.`);
    }

    return item.trim();
  });

  if (parsed.length < minItems || parsed.length > maxItems) {
    throw new Error(`Evaluation field ${field} must contain ${minItems}-${maxItems} item(s).`);
  }

  return parsed;
}

function requiredScore(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) {
    throw new Error(`Evaluation field ${field} must be an integer from 0 to 100.`);
  }

  return value;
}

function requiredPlaybookEntryKind(value: unknown, field: string): AgentPlaybookEntryKind {
  if (value === "policy"
    || value === "heuristic"
    || value === "anti_pattern"
    || value === "operator_preference") {
    return value;
  }

  throw new Error(`Evaluation field ${field} must be policy, heuristic, anti_pattern, or operator_preference.`);
}

function requiredExperimentEvaluationStatus(value: unknown, field: string): "succeeded" | "failed" | "skipped" | "not_applicable" {
  if (value === "succeeded" || value === "failed" || value === "skipped" || value === "not_applicable") {
    return value;
  }

  throw new Error(`Evaluation field ${field} must be succeeded, failed, skipped, or not_applicable.`);
}

function requiredReflectionOutcome(value: unknown, field: string): AgentReflectionOutcome {
  if (value === "useful" || value === "blocked" || value === "no_signal" || value === "unsafe" || value === "failed") {
    return value;
  }

  throw new Error(`Evaluation field ${field} must be useful, blocked, no_signal, unsafe, or failed.`);
}

function requiredEvaluationVerdict(value: unknown, field: string): AgentEvaluationVerdict {
  if (value === "strong" || value === "useful" || value === "weak" || value === "unsafe" || value === "failed") {
    return value;
  }

  throw new Error(`Evaluation field ${field} must be strong, useful, weak, unsafe, or failed.`);
}

function experimentCompletionStatus(status: "succeeded" | "failed" | "skipped" | "not_applicable"): Exclude<AgentExperimentStatus, "pending" | "running"> {
  return status === "not_applicable" ? "skipped" : status;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseJsonField(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const objectMatch = text.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return null;
    }

    try {
      return JSON.parse(objectMatch[0]) as unknown;
    } catch {
      return null;
    }
  }
}

function summarizeJson(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if (isRecord(value.data)) {
    return {
      ok: value.ok,
      error: value.error,
      dataKeys: Object.keys(value.data),
      counts: isRecord(value.data.counts) ? value.data.counts : undefined,
      errors: Array.isArray(value.data.errors) ? value.data.errors.slice(0, 5) : undefined,
    };
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

