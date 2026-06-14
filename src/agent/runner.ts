import { readPositiveIntegerEnv } from "../config/timeouts";
import { loadPreferenceProfile, type PreferenceProfile } from "../core/preferences";
import type { DiscoveryRunResult } from "../discovery/discovery-pass";
import {
  claimNextAgentOperatorReviewContinuation,
  finishAgentRun,
  getLatestAgentRunPlan,
  getLatestAgentWorkingMemory,
  getPendingAgentExperiment,
  listActiveAgentPlaybookEntries,
  listAgentContractAudits,
  listAgentOperatorReviews,
  listAgentOperatorReviewsForRun,
  listAgentPlaybookEntriesForRun,
  listAgentRecommendations,
  listAgentEvaluations,
  listAgentReflections,
  listAgentSteps,
  recordAgentContractAudit,
  recordAgentRunContext,
  recordAgentGuardrailEvent,
  recordAgentStep,
  finishAgentExperiment,
  startAgentExperiment,
  type AgentContractAudit,
  type AgentEpisodeEvaluation,
  type AgentExperiment,
  type AgentPlaybookEntry,
  startAgentRun,
  type AgentGuardrailDecision,
  type AgentOperatorReview,
  type AgentReflection,
  type AgentRun,
  type AgentRunContext,
  type AgentRunPlan,
  type AgentWorkingMemory,
} from "../storage/agent";
import {
  compactResponseTrace,
  createOpenAIResponsesClient,
  functionCalls,
  outputText,
  readOpenAIResponsesConfig,
  type OpenAIResponse,
  type OpenAIResponseOutputItem,
  type OpenAIResponsesClient,
  type OpenAIResponsesConfig,
} from "./openai";
import { auditAgentContract } from "./contract-audit";
import {
  createAgentEvidenceLedger,
  updateAgentEvidenceLedger,
} from "./provenance";
import { agentToolDefinitions, executeAgentTool, type AgentToolResult } from "./tools";
import {
  batchedToolCallPolicy,
  evaluateToolCallPolicy,
  guardrailBlockedResult,
  withGuardrailFeedback,
} from "./guardrails";
import {
  agentInstructions,
  initialUserMessage,
} from "./prompts";
import { evaluateCompletedRun } from "./evaluator";

export type AgentNotificationMode = "send" | "dry-run" | "off";

export type AgentRunOptions = {
  objective?: string;
  profile?: PreferenceProfile;
  notificationMode?: AgentNotificationMode;
  maxIterations?: number;
  openAIConfig?: OpenAIResponsesConfig | null;
  client?: OpenAIResponsesClient;
};

export type AgentRunResult = {
  run: AgentRun;
  mode: "openai";
  iterations: number;
  summary: string;
  discoveryResult: DiscoveryRunResult | null;
  toolCalls: Array<{
    name: string;
    ok: boolean;
  }>;
  guardrailEvents: Array<{
    toolName: string;
    decision: AgentGuardrailDecision;
    reason: string;
  }>;
  episodePlan: AgentRunPlan | null;
  workingMemory: AgentWorkingMemory | null;
  recommendationsRecorded: number;
  operatorReviewsRecorded: number;
  playbookEntriesRecorded: number;
  activePlaybookEntries: AgentPlaybookEntry[];
  reflection: AgentReflection | null;
  evaluation: AgentEpisodeEvaluation | null;
  contractAudit: AgentContractAudit | null;
  activeExperiment: AgentExperiment | null;
  completedExperiment: AgentExperiment | null;
  queuedExperiment: AgentExperiment | null;
  resumedOperatorReview: AgentOperatorReview | null;
  runContext: AgentRunContext | null;
};

const defaultObjective = [
  "Discover and triage NYC apartment listings for the local operator.",
  "Use the local tools to gather ground truth, decide which listings deserve attention, record high-signal recommendations, and stop when the next operator actions are clear.",
].join(" ");

export async function runApartmentRadarAgentOnce(options: AgentRunOptions = {}): Promise<AgentRunResult> {
  const profile = options.profile ?? loadPreferenceProfile();
  const objective = options.objective ?? defaultObjective;
  const notificationMode = options.notificationMode ?? "send";
  const maxIterations = options.maxIterations ?? readPositiveIntegerEnv("NYC_APT_RADAR_AGENT_MAX_ITERATIONS", 6);
  const config = options.openAIConfig === undefined ? readOpenAIResponsesConfig() : options.openAIConfig;
  const client = options.client ?? (config ? createOpenAIResponsesClient(config) : null);

  if (!client || !config) {
    throw new Error("OPENAI_API_KEY is required for the model-directed agent loop.");
  }

  return runOpenAIAgent({
    objective,
    profile,
    notificationMode,
    maxIterations,
    config,
    client,
  });
}

async function runOpenAIAgent(input: {
  objective: string;
  profile: PreferenceProfile;
  notificationMode: AgentNotificationMode;
  maxIterations: number;
  config: OpenAIResponsesConfig;
  client: OpenAIResponsesClient;
}): Promise<AgentRunResult> {
  const pendingExperiment = getPendingAgentExperiment();
  const run = startAgentRun({
    objective: input.objective,
    mode: "openai",
    model: input.config.model,
  });
  const resumedOperatorReview = claimNextAgentOperatorReviewContinuation(run.id);
  const activeExperiment = pendingExperiment ? startAgentExperiment(pendingExperiment.id, run.id) : null;
  const startedRecommendations = listAgentRecommendations(1000).length;
  const startedOperatorReviews = listAgentOperatorReviews(1000).length;
  const recentContractAudits = listAgentContractAudits(5);
  const recentReflections = listAgentReflections(5);
  const recentEvaluations = listAgentEvaluations(5);
  const activePlaybookEntries = listActiveAgentPlaybookEntries(12);
  const runContext = recordAgentRunContext({
    runId: run.id,
    objective: input.objective,
    notificationMode: input.notificationMode,
    maxIterations: input.maxIterations,
    activeExperimentId: activeExperiment?.id ?? null,
    resumedOperatorReviewId: resumedOperatorReview?.id ?? null,
    activePlaybookEntryIds: activePlaybookEntries.map((entry) => entry.id),
    recentReflectionIds: recentReflections.map((reflection) => reflection.id),
    recentEvaluationIds: recentEvaluations.map((evaluation) => evaluation.id),
    recentContractAuditIds: recentContractAudits.map((audit) => audit.id),
  });
  const toolCalls: Array<{ name: string; ok: boolean }> = [];
  const guardrailEvents: AgentRunResult["guardrailEvents"] = [];
  const evidenceLedger = createAgentEvidenceLedger();
  let needsMemoryBeforeOperatorWrite = false;
  let discoveryResult: DiscoveryRunResult | null = null;
  let stepIndex = 1;
  let conversation: unknown[] = [initialUserMessage(input.objective, input.notificationMode, input.maxIterations, activeExperiment, resumedOperatorReview, recentContractAudits, recentReflections, recentEvaluations, activePlaybookEntries)];

  try {
    for (let iteration = 1; iteration <= input.maxIterations; iteration += 1) {
      const response = await input.client.createResponse({
        model: input.config.model,
        instructions: agentInstructions(),
        input: conversation,
        tools: agentToolDefinitions(),
        tool_choice: iteration === 1 ? "required" : "auto",
        parallel_tool_calls: false,
        reasoning: {
          effort: input.config.reasoningEffort,
        },
        text: {
          verbosity: "low",
        },
        store: false,
        metadata: {
          app: "nyc-apt-radar",
          agent_run_id: run.id,
        },
      });

      recordAgentStep({
        runId: run.id,
        stepIndex,
        kind: "model_response",
        input: { iteration },
        output: compactResponseTrace(response),
      });
      stepIndex += 1;

      const calls = functionCalls(response);
      if (!calls.length) {
        const summary = outputText(response) || "Agent stopped without a final text summary.";
        return completeRun({
          run,
          iterations: iteration,
          summary,
          discoveryResult,
          toolCalls,
          guardrailEvents,
          startedRecommendations,
          startedOperatorReviews,
          activePlaybookEntries,
          activeExperiment,
          resumedOperatorReview,
          runContext,
          stepIndex,
          client: input.client,
          config: input.config,
        });
      }

      const toolOutputs: unknown[] = [];
      let pendingStopSummary: string | null = null;
      for (const [callIndex, call] of calls.entries()) {
        const args = parseToolArguments(call);
        const policy = callIndex > 0
          ? batchedToolCallPolicy(args)
          : evaluateToolCallPolicy(call.name ?? "", args, {
            allowLiveNotifications: input.notificationMode === "send",
            evidenceLedger,
            needsMemoryBeforeOperatorWrite,
          });
        const guardrail = recordAgentGuardrailEvent({
          runId: run.id,
          stepIndex,
          toolName: call.name ?? "unknown",
          decision: policy.decision,
          reason: policy.reason,
          input: args,
          effectiveInput: policy.effectiveArgs,
        });
        guardrailEvents.push({
          toolName: guardrail.toolName,
          decision: guardrail.decision,
          reason: guardrail.reason,
        });
        recordAgentStep({
          runId: run.id,
          stepIndex,
          kind: "tool_call",
          toolName: call.name ?? null,
          input: args,
          output: {
            callId: call.call_id,
            guardrail: {
              decision: policy.decision,
              reason: policy.reason,
              effectiveArgs: policy.effectiveArgs,
            },
          },
        });
        stepIndex += 1;

        const rawResult = policy.decision === "blocked"
          ? guardrailBlockedResult(policy)
          : await executeAgentTool(call.name ?? "", policy.effectiveArgs, {
            runId: run.id,
            profile: input.profile,
            allowLiveNotifications: input.notificationMode === "send",
          });
        const result = withGuardrailFeedback(rawResult, policy);
        toolCalls.push({ name: call.name ?? "unknown", ok: result.ok });
        discoveryResult = discoveryResultFromTool(call.name, result) ?? discoveryResult;
        updateAgentEvidenceLedger(call.name, result, evidenceLedger);
        if (result.ok) {
          if (call.name === "update_working_memory") {
            needsMemoryBeforeOperatorWrite = false;
          } else if (isObservationTool(call.name)) {
            needsMemoryBeforeOperatorWrite = true;
          }
        }

        recordAgentStep({
          runId: run.id,
          stepIndex,
          kind: "tool_result",
          toolName: call.name ?? null,
          input: args,
          output: result,
        });
        stepIndex += 1;

        toolOutputs.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify(result),
        });

        if (call.name === "stop_agent" && result.ok) {
          pendingStopSummary = stopSummary(result) ?? "Agent stopped.";
        }
      }

      if (pendingStopSummary) {
          return completeRun({
            run,
            iterations: iteration,
            summary: pendingStopSummary,
            discoveryResult,
            toolCalls,
            guardrailEvents,
            startedRecommendations,
            startedOperatorReviews,
            activePlaybookEntries,
            activeExperiment,
            resumedOperatorReview,
            runContext,
            stepIndex,
            client: input.client,
            config: input.config,
          });
      }

      conversation = [
        ...conversation,
        ...responseItemsForReplay(response),
        ...toolOutputs,
      ];
    }

    const summary = `Agent stopped after reaching the max iteration budget (${input.maxIterations}). Inspect recorded recommendations and trace before increasing the budget.`;
    return completeRun({
      run,
      iterations: input.maxIterations,
      summary,
      discoveryResult,
      toolCalls,
      guardrailEvents,
      startedRecommendations,
      startedOperatorReviews,
      activePlaybookEntries,
      activeExperiment,
      resumedOperatorReview,
      runContext,
      stepIndex,
      client: input.client,
      config: input.config,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordAgentStep({
      runId: run.id,
      stepIndex,
      kind: "final",
      input: null,
      output: { error: message },
    });
    const failed = finishAgentRun(run.id, {
      status: "failed",
      iterations: Math.max(0, toolCalls.length),
      summary: "Agent failed before completing its loop.",
      errorMessage: message,
    }) ?? run;

    const episodePlan = getLatestAgentRunPlan(run.id);
    const workingMemory = getLatestAgentWorkingMemory(run.id);
    const runRecommendations = listAgentRecommendations(1000).filter((recommendation) => recommendation.runId === failed.id);
    const runOperatorReviews = listAgentOperatorReviewsForRun(failed.id);
    const recommendationsRecorded = Math.max(0, listAgentRecommendations(1000).length - startedRecommendations);
    const operatorReviewsRecorded = Math.max(0, listAgentOperatorReviews(1000).length - startedOperatorReviews);
    const completedExperiment = activeExperiment ? finishAgentExperiment(activeExperiment.id, {
      status: "failed",
      completedRunId: failed.id,
      resultSummary: "Agent run failed before the active experiment could be evaluated.",
    }) : null;
    const contractAudit = recordAgentContractAudit({
      runId: failed.id,
      ...auditAgentContract({
        run: failed,
        steps: listAgentSteps(failed.id),
        toolCalls,
        guardrailEvents,
        episodePlan,
        workingMemory,
        recommendations: runRecommendations,
        operatorReviews: runOperatorReviews,
        playbookEntries: [],
        recommendationsRecorded,
        operatorReviewsRecorded,
        discoveryResult,
        runContext,
        activeExperiment,
        reflection: null,
        evaluation: null,
      }),
    });

    return {
      run: failed,
      mode: "openai",
      iterations: failed.iterations,
      summary: failed.summary ?? "Agent failed before completing its loop.",
      discoveryResult,
      toolCalls,
      guardrailEvents,
      episodePlan,
      workingMemory,
      recommendationsRecorded,
      operatorReviewsRecorded,
      playbookEntriesRecorded: 0,
      activePlaybookEntries,
      reflection: null,
      evaluation: null,
      contractAudit,
      activeExperiment,
      completedExperiment,
      queuedExperiment: null,
      resumedOperatorReview,
      runContext,
    };
  }
}

async function completeRun(input: {
  run: AgentRun;
  iterations: number;
  summary: string;
  discoveryResult: DiscoveryRunResult | null;
  toolCalls: Array<{ name: string; ok: boolean }>;
  guardrailEvents: AgentRunResult["guardrailEvents"];
  startedRecommendations: number;
  startedOperatorReviews: number;
  activePlaybookEntries: AgentPlaybookEntry[];
  activeExperiment: AgentExperiment | null;
  resumedOperatorReview: AgentOperatorReview | null;
  runContext: AgentRunContext | null;
  stepIndex: number;
  client: OpenAIResponsesClient;
  config: OpenAIResponsesConfig;
}): Promise<AgentRunResult> {
  recordAgentStep({
    runId: input.run.id,
    stepIndex: input.stepIndex,
    kind: "final",
    input: null,
    output: { summary: input.summary },
  });
  const finished = finishAgentRun(input.run.id, {
    status: "completed",
    iterations: input.iterations,
    summary: input.summary,
  }) ?? input.run;
  const recommendationsRecorded = Math.max(0, listAgentRecommendations(1000).length - input.startedRecommendations);
  const operatorReviewsRecorded = Math.max(0, listAgentOperatorReviews(1000).length - input.startedOperatorReviews);
  const runRecommendations = listAgentRecommendations(1000).filter((recommendation) => recommendation.runId === finished.id);
  const runOperatorReviews = listAgentOperatorReviewsForRun(finished.id);
  const episodePlan = getLatestAgentRunPlan(input.run.id);
  const workingMemory = getLatestAgentWorkingMemory(input.run.id);
  const critique = await evaluateCompletedRun({
    run: finished,
    summary: input.summary,
    discoveryResult: input.discoveryResult,
    toolCalls: input.toolCalls,
    guardrailEvents: input.guardrailEvents,
    episodePlan,
    workingMemory,
    recommendationsRecorded,
    operatorReviewsRecorded,
    activeExperiment: input.activeExperiment,
    resumedOperatorReview: input.resumedOperatorReview,
    runContext: input.runContext,
    activePlaybookEntries: input.activePlaybookEntries,
    stepIndex: input.stepIndex + 1,
    client: input.client,
    config: input.config,
  });
  const reflection = critique.reflection;
  const evaluation = critique.evaluation;
  const completedExperiment = critique.completedExperiment;
  const queuedExperiment = critique.queuedExperiment;
  const runPlaybookEntries = listAgentPlaybookEntriesForRun(finished.id);
  const contractAudit = recordAgentContractAudit({
    runId: finished.id,
    ...auditAgentContract({
      run: finished,
      steps: listAgentSteps(finished.id),
      toolCalls: input.toolCalls,
      guardrailEvents: input.guardrailEvents,
      episodePlan,
      workingMemory,
      recommendations: runRecommendations,
      operatorReviews: runOperatorReviews,
      playbookEntries: runPlaybookEntries,
      recommendationsRecorded,
      operatorReviewsRecorded,
      discoveryResult: input.discoveryResult,
      runContext: input.runContext,
      activeExperiment: input.activeExperiment,
      reflection,
      evaluation,
    }),
  });

  return {
    run: finished,
    mode: "openai",
    iterations: input.iterations,
    summary: input.summary,
    discoveryResult: input.discoveryResult,
    toolCalls: input.toolCalls,
    guardrailEvents: input.guardrailEvents,
    episodePlan,
    workingMemory,
    recommendationsRecorded,
    operatorReviewsRecorded,
    playbookEntriesRecorded: runPlaybookEntries.length,
    activePlaybookEntries: input.activePlaybookEntries,
    reflection,
    evaluation,
    contractAudit,
    activeExperiment: input.activeExperiment,
    completedExperiment,
    queuedExperiment,
    resumedOperatorReview: input.resumedOperatorReview,
    runContext: input.runContext,
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

function responseItemsForReplay(response: OpenAIResponse) {
  return (response.output ?? []).filter((item) => item.type === "function_call" || item.type === "message");
}

function isObservationTool(name: string | undefined) {
  return name === "get_radar_state"
    || name === "run_discovery_pass"
    || name === "inspect_listing"
    || name === "draft_outreach"
    || name === "inspect_recent_failures";
}

function discoveryResultFromTool(name: string | undefined, result: AgentToolResult): DiscoveryRunResult | null {
  if (name !== "run_discovery_pass" || !result.ok || !isRecord(result.data)) {
    return null;
  }

  return {
    searchesChecked: numberField(result.data.searchesChecked),
    documentsSeen: numberField(result.data.documentsSeen),
    duplicateDocuments: numberField(result.data.duplicateDocuments),
    listingsFound: numberField(result.data.listingsFound),
    listingsSaved: [],
    notificationsSent: numberField(result.data.notificationsSent),
    notificationsSkipped: numberField(result.data.notificationsSkipped),
    notificationsFailed: numberField(result.data.notificationsFailed),
    errors: Array.isArray(result.data.errors) ? result.data.errors.filter((item): item is string => typeof item === "string") : [],
  };
}

function stopSummary(result: AgentToolResult) {
  if (!isRecord(result.data)) {
    return null;
  }

  return typeof result.data.summary === "string" ? result.data.summary : null;
}

function numberField(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
