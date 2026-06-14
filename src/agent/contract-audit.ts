import type { DiscoveryRunResult } from "../discovery/discovery-pass";
import type {
  AgentContractAuditStatus,
  AgentContractCheck,
  AgentEpisodeEvaluation,
  AgentExperiment,
  AgentGuardrailDecision,
  AgentOperatorReview,
  AgentPlaybookEntry,
  AgentRecommendation,
  AgentReflection,
  AgentRun,
  AgentRunContext,
  AgentRunPlan,
  AgentStep,
  AgentWorkingMemory,
} from "../storage/agent";
import {
  createAgentEvidenceLedger,
  recommendationProvenanceViolation,
  toolProvenanceViolation,
  updateAgentEvidenceLedger,
  type AgentEvidenceLedger,
} from "./provenance";

export type AgentContractAuditDraft = {
  status: AgentContractAuditStatus;
  score: number;
  checks: AgentContractCheck[];
};

const allowedTools = new Set([
  "get_radar_state",
  "update_working_memory",
  "set_episode_plan",
  "run_discovery_pass",
  "inspect_listing",
  "draft_outreach",
  "inspect_recent_failures",
  "request_operator_review",
  "record_recommendation",
  "stop_agent",
]);

const observationTools = new Set([
  "get_radar_state",
  "run_discovery_pass",
  "inspect_listing",
  "inspect_recent_failures",
]);

export function auditAgentContract(input: {
  run: AgentRun;
  steps: AgentStep[];
  toolCalls: Array<{ name: string; ok: boolean }>;
  guardrailEvents: Array<{ toolName: string; decision: AgentGuardrailDecision; reason: string }>;
  episodePlan: AgentRunPlan | null;
  workingMemory: AgentWorkingMemory | null;
  recommendations: AgentRecommendation[];
  operatorReviews: AgentOperatorReview[];
  playbookEntries: AgentPlaybookEntry[];
  recommendationsRecorded: number;
  operatorReviewsRecorded: number;
  discoveryResult: DiscoveryRunResult | null;
  runContext: AgentRunContext | null;
  activeExperiment: AgentExperiment | null;
  reflection: AgentReflection | null;
  evaluation: AgentEpisodeEvaluation | null;
}): AgentContractAuditDraft {
  const checks: AgentContractCheck[] = [
    checkObjective(input.run),
    checkRunContext(input.run, input.runContext),
    checkActiveExperimentAttention(input.run, input.runContext, input.activeExperiment, input.episodePlan, input.workingMemory),
    checkToolControl(input.toolCalls),
    checkActionIntent(input.steps),
    checkGroundTruthObservation(input.toolCalls),
    checkEpisodePlan(input.episodePlan, input.run.status),
    checkTraceIntegrity(input.steps),
    checkLoopCausality(input.run, input.steps),
    checkWorkingMemory(input.workingMemory, input.run.status),
    checkGuardrails(input.toolCalls, input.guardrailEvents),
    checkSideEffectSafety(input.guardrailEvents),
    checkOperatorValue(input.run, input.steps, input.workingMemory, input.toolCalls, input.recommendationsRecorded, input.operatorReviewsRecorded, input.discoveryResult),
    checkRecommendationGrounding(input.recommendations, input.operatorReviews),
    checkRecommendationProvenance(input.steps, input.recommendations, input.operatorReviews),
    checkEpisodeEvaluation(input.reflection, input.evaluation),
    checkPlaybookLearning(input.reflection, input.evaluation, input.playbookEntries),
    checkStop(input.run, input.toolCalls, input.steps, input.episodePlan),
  ];
  const score = scoreChecks(checks);
  const status = checks.some((check) => check.status === "fail")
    ? "fail"
    : checks.some((check) => check.status === "warn") ? "warn" : "pass";

  return { status, score, checks };
}

function checkActiveExperimentAttention(
  run: AgentRun,
  context: AgentRunContext | null,
  activeExperiment: AgentExperiment | null,
  plan: AgentRunPlan | null,
  memory: AgentWorkingMemory | null,
): AgentContractCheck {
  if (!context?.activeExperimentId && !activeExperiment) {
    return pass("active_experiment_attention", "Active experiment attention", "No active experiment was assigned to this run.");
  }

  if (!activeExperiment || context?.activeExperimentId !== activeExperiment.id) {
    return fail("active_experiment_attention", "Active experiment attention", "Run context references an active experiment that is not available to audit.");
  }

  const terms = significantTerms(activeExperiment.description);
  if (!terms.length) {
    return warn("active_experiment_attention", "Active experiment attention", "Active experiment description has no specific terms to audit.");
  }

  const evidenceText = normalizeText([
    plan?.objective,
    ...(plan?.successCriteria ?? []),
    ...(plan?.plannedSteps ?? []),
    ...(plan?.stopConditions ?? []),
    ...(plan?.riskChecks ?? []),
    memory?.focus,
    ...(memory?.hypotheses ?? []),
    ...(memory?.nextActions ?? []),
    ...(memory?.openQuestions ?? []),
  ].filter((item): item is string => Boolean(item)));
  const matched = terms.filter((term) => evidenceText.includes(term));
  const needed = Math.min(2, terms.length);

  if (matched.length < needed) {
    if (run.status === "failed") {
      return warn("active_experiment_attention", "Active experiment attention", "Run failed before it could operationalize the active experiment.");
    }

    return fail("active_experiment_attention", "Active experiment attention", `Active experiment was not reflected in plan or working memory; matched ${matched.length}/${needed} required term(s).`);
  }

  return pass("active_experiment_attention", "Active experiment attention", `Plan or memory reflected active experiment terms: ${matched.slice(0, 4).join(", ")}.`);
}

function checkRunContext(run: AgentRun, context: AgentRunContext | null): AgentContractCheck {
  if (!context) {
    if (run.status === "failed") {
      return warn("run_context", "Run context", "Run failed before initial context was persisted.");
    }

    return fail("run_context", "Run context", "Run did not persist the initial objective, memory, experiment, and continuation context.");
  }

  if (context.runId !== run.id) {
    return fail("run_context", "Run context", `Run context points at ${context.runId}, not ${run.id}.`);
  }

  if (context.objective.trim() !== run.objective.trim()) {
    return fail("run_context", "Run context", "Run context objective does not match the run objective.");
  }

  const memoryInputs = context.activePlaybookEntryIds.length
    + context.recentReflectionIds.length
    + context.recentEvaluationIds.length
    + context.recentContractAuditIds.length
    + (context.activeExperimentId ? 1 : 0)
    + (context.resumedOperatorReviewId ? 1 : 0);

  return pass("run_context", "Run context", `Persisted start context with ${memoryInputs} memory/continuation input(s), notification mode ${context.notificationMode}, max ${context.maxIterations} iteration(s).`);
}

function checkObjective(run: AgentRun): AgentContractCheck {
  if (!run.objective.trim()) {
    return fail("objective", "Objective", "Run has no explicit objective.");
  }

  if (run.mode !== "openai" || !run.model) {
    return fail("objective", "Objective", "Run is not tied to an OpenAI model-directed supervisor.");
  }

  return pass("objective", "Objective", `Objective present; model supervisor is ${run.model}.`);
}

function checkToolControl(toolCalls: Array<{ name: string; ok: boolean }>): AgentContractCheck {
  if (!toolCalls.length) {
    return fail("tool_control", "Tool control", "No tool calls were executed, so the model did not act through the bounded surface.");
  }

  const names = unique(toolCalls.map((call) => call.name));
  return pass("tool_control", "Tool control", `Executed ${toolCalls.length} tool call(s): ${names.join(", ")}.`);
}

function checkActionIntent(steps: AgentStep[]): AgentContractCheck {
  const toolCallSteps = steps.filter((step) => step.kind === "tool_call");
  if (!toolCallSteps.length) {
    return fail("action_intent", "Action intent", "No tool-call trace records exist to inspect for intent.");
  }

  const missing = toolCallSteps.filter((step) => {
    const input = parseStepInput(step);
    return !input || typeof input.intent !== "string" || input.intent.trim().length < 8;
  });

  if (missing.length) {
    return fail("action_intent", "Action intent", `${missing.length} tool call(s) are missing a specific intent.`);
  }

  return pass("action_intent", "Action intent", `${toolCallSteps.length} tool call(s) declared specific intent.`);
}

function checkGroundTruthObservation(toolCalls: Array<{ name: string; ok: boolean }>): AgentContractCheck {
  const observations = toolCalls.filter((call) => observationTools.has(call.name));
  if (!observations.length) {
    return fail("ground_truth", "Ground-truth observation", "Run did not observe radar state, discovery, listing detail, or failures through tools.");
  }

  if (!observations.some((call) => call.ok)) {
    return warn("ground_truth", "Ground-truth observation", "Run attempted observation tools, but none returned successfully.");
  }

  return pass("ground_truth", "Ground-truth observation", `Observed through ${unique(observations.map((call) => call.name)).join(", ")}.`);
}

function checkEpisodePlan(plan: AgentRunPlan | null, runStatus: string): AgentContractCheck {
  if (!plan) {
    if (runStatus === "failed") {
      return warn("episode_plan", "Episode plan", "Run failed before an explicit episode plan was recorded.");
    }

    return fail("episode_plan", "Episode plan", "Run did not persist explicit success criteria, planned steps, stop conditions, and risk checks.");
  }

  const missing: string[] = [];
  if (!plan.objective.trim()) {
    missing.push("objective");
  }
  if (!plan.successCriteria.length) {
    missing.push("success criteria");
  }
  if (!plan.plannedSteps.length) {
    missing.push("planned steps");
  }
  if (!plan.stopConditions.length) {
    missing.push("stop conditions");
  }
  if (!plan.riskChecks.length) {
    missing.push("risk checks");
  }

  if (missing.length) {
    return fail("episode_plan", "Episode plan", `Plan is missing ${missing.join(", ")}.`);
  }

  return pass("episode_plan", "Episode plan", `${plan.successCriteria.length} success criteria; ${plan.stopConditions.length} stop condition(s); confidence ${Math.round(plan.confidence * 100)}%.`);
}

function checkTraceIntegrity(steps: AgentStep[]): AgentContractCheck {
  const modelResponses = steps.filter((step) => step.kind === "model_response").length;
  const toolCallSteps = steps.filter((step) => step.kind === "tool_call").length;
  const toolResultSteps = steps.filter((step) => step.kind === "tool_result").length;
  const finalSteps = steps.filter((step) => step.kind === "final").length;

  if (!modelResponses || !finalSteps) {
    return fail("trace_integrity", "Trace integrity", "Trace is missing model response or final summary records.");
  }

  if (toolCallSteps !== toolResultSteps) {
    return fail("trace_integrity", "Trace integrity", `Trace has ${toolCallSteps} tool call step(s) but ${toolResultSteps} tool result step(s).`);
  }

  return pass("trace_integrity", "Trace integrity", `${modelResponses} model response(s), ${toolCallSteps} tool call/result pair(s), ${finalSteps} final record(s).`);
}

function checkLoopCausality(run: AgentRun, steps: AgentStep[]): AgentContractCheck {
  const multiActionTurns = modelActionSegments(steps).filter((segment) => segment.toolCalls.length > 1);
  if (multiActionTurns.length) {
    return fail("loop_causality", "Loop causality", `${multiActionTurns.length} model turn(s) requested multiple tools before receiving tool feedback.`);
  }

  const successfulToolResults = steps
    .filter((step) => step.kind === "tool_result")
    .filter((step) => parseStepOutput(step)?.ok === true);
  const observations = successfulToolResults.filter((step) => step.toolName && observationTools.has(step.toolName));
  if (!observations.length) {
    if (run.status === "failed") {
      return warn("loop_causality", "Loop causality", "Run failed before a successful observation could drive a later action.");
    }

    return fail("loop_causality", "Loop causality", "No successful observation result exists to drive later planning or action.");
  }

  const firstObservationIndex = Math.min(...observations.map((step) => step.stepIndex));
  const plan = successfulToolResults.find((step) => step.toolName === "set_episode_plan") ?? null;
  const firstMemoryAfterObservation = successfulToolResults.find((step) => step.toolName === "update_working_memory" && step.stepIndex > firstObservationIndex) ?? null;
  const firstOperatorWrite = successfulToolResults.find((step) => step.toolName === "record_recommendation" || step.toolName === "request_operator_review") ?? null;
  const stop = successfulToolResults.filter((step) => step.toolName === "stop_agent").at(-1) ?? null;

  if (!plan) {
    if (run.status === "failed") {
      return warn("loop_causality", "Loop causality", "Run failed before it could plan from observation.");
    }

    return fail("loop_causality", "Loop causality", "No successful episode plan was recorded after observation.");
  }

  if (plan.stepIndex <= firstObservationIndex) {
    return fail("loop_causality", "Loop causality", "Episode plan was recorded before a successful observation result.");
  }

  if (!firstMemoryAfterObservation) {
    if (run.status === "failed") {
      return warn("loop_causality", "Loop causality", "Run failed before working memory could adapt after observation.");
    }

    return fail("loop_causality", "Loop causality", "No working-memory update occurred after a successful observation result.");
  }

  if (firstOperatorWrite && firstOperatorWrite.stepIndex <= firstMemoryAfterObservation.stepIndex) {
    return fail("loop_causality", "Loop causality", "Operator-facing write occurred before post-observation working memory.");
  }

  if (stop && stop.stepIndex <= firstMemoryAfterObservation.stepIndex) {
    return fail("loop_causality", "Loop causality", "The run stopped before post-observation working memory could shape the decision.");
  }

  return pass("loop_causality", "Loop causality", "Each model turn took one tool action, then planned and updated memory after observation before writing or stopping.");
}

function checkWorkingMemory(memory: AgentWorkingMemory | null, runStatus: string): AgentContractCheck {
  if (memory) {
    return pass("working_memory", "Working memory", `Recorded r${memory.revision}: ${memory.focus}`);
  }

  if (runStatus === "failed") {
    return warn("working_memory", "Working memory", "Run failed before working memory was recorded.");
  }

  return fail("working_memory", "Working memory", "Completed run did not externalize focus, hypotheses, next actions, or confidence.");
}

function checkGuardrails(
  toolCalls: Array<{ name: string; ok: boolean }>,
  guardrailEvents: Array<{ toolName: string; decision: AgentGuardrailDecision; reason: string }>,
): AgentContractCheck {
  if (guardrailEvents.length < toolCalls.length) {
    return fail("guardrails", "Guardrails", `Only ${guardrailEvents.length}/${toolCalls.length} tool call(s) have guardrail decisions.`);
  }

  if (guardrailEvents.some((event) => event.decision !== "allowed")) {
    return warn("guardrails", "Guardrails", guardrailSummary(guardrailEvents));
  }

  return pass("guardrails", "Guardrails", guardrailSummary(guardrailEvents));
}

function checkSideEffectSafety(guardrailEvents: Array<{ toolName: string; decision: AgentGuardrailDecision; reason: string }>): AgentContractCheck {
  const unknownTools = guardrailEvents.filter((event) => !allowedTools.has(event.toolName));
  if (unknownTools.length) {
    return fail("side_effect_safety", "Side-effect safety", `Model requested tool(s) outside the bounded surface: ${unique(unknownTools.map((event) => event.toolName)).join(", ")}.`);
  }

  const blocked = guardrailEvents.filter((event) => event.decision === "blocked");
  if (blocked.length) {
    return warn("side_effect_safety", "Side-effect safety", `${blocked.length} tool call(s) were blocked by runtime policy.`);
  }

  return pass("side_effect_safety", "Side-effect safety", "All requested tools stayed inside the bounded side-effect surface.");
}

function checkOperatorValue(
  run: AgentRun,
  steps: AgentStep[],
  memory: AgentWorkingMemory | null,
  toolCalls: Array<{ name: string; ok: boolean }>,
  recommendationsRecorded: number,
  operatorReviewsRecorded: number,
  discoveryResult: DiscoveryRunResult | null,
): AgentContractCheck {
  if (recommendationsRecorded > 0) {
    return pass("operator_value", "Operator value", `Recorded ${recommendationsRecorded} recommendation(s).`);
  }

  if (operatorReviewsRecorded > 0) {
    return pass("operator_value", "Operator value", `Recorded ${operatorReviewsRecorded} structured operator review request(s).`);
  }

  const noDuplicateReason = deliberateNoDuplicateWriteReason(run, steps, memory, toolCalls);
  if (noDuplicateReason) {
    return pass("operator_value", "Operator value", noDuplicateReason);
  }

  if (discoveryResult?.errors.length) {
    return warn("operator_value", "Operator value", `No recommendation recorded, but discovery surfaced ${discoveryResult.errors.length} issue(s).`);
  }

  if (toolCalls.some((call) => call.name === "inspect_recent_failures" || call.name === "run_discovery_pass")) {
    return warn("operator_value", "Operator value", "Run gathered fresh evidence but did not record an operator-facing recommendation.");
  }

  return fail("operator_value", "Operator value", "Run produced no recommendation, discovery finding, or failure review for the operator.");
}

function checkRecommendationGrounding(recommendations: AgentRecommendation[], operatorReviews: AgentOperatorReview[]): AgentContractCheck {
  if (!recommendations.length && !operatorReviews.length) {
    return pass("recommendation_grounding", "Operator write grounding", "No operator-facing writes were recorded, so grounding was not required.");
  }

  const ungrounded = recommendations.filter((recommendation) => !recommendation.evidence.length);
  const ungroundedReviews = operatorReviews.filter((review) => !review.evidence.length);
  if (ungrounded.length || ungroundedReviews.length) {
    return fail("recommendation_grounding", "Operator write grounding", `${ungrounded.length} recommendation(s) and ${ungroundedReviews.length} review request(s) have no structured evidence.`);
  }

  const listingMismatches = recommendations.filter((recommendation) => {
    if (!recommendation.listingId) {
      return false;
    }

    return !recommendation.evidence.some((item) => item.ref.includes(recommendation.listingId ?? ""));
  });
  const reviewListingMismatches = operatorReviews.filter((review) => {
    if (!review.listingId) {
      return false;
    }

    return !review.evidence.some((item) => item.ref.includes(review.listingId ?? ""));
  });
  if (listingMismatches.length || reviewListingMismatches.length) {
    return fail("recommendation_grounding", "Operator write grounding", `${listingMismatches.length} listing recommendation(s) and ${reviewListingMismatches.length} review request(s) do not cite their listing id.`);
  }

  return pass("recommendation_grounding", "Operator write grounding", `${recommendations.length} recommendation(s) and ${operatorReviews.length} review request(s) include structured evidence.`);
}

function checkRecommendationProvenance(
  steps: AgentStep[],
  recommendations: AgentRecommendation[],
  operatorReviews: AgentOperatorReview[],
): AgentContractCheck {
  if (!recommendations.length && !operatorReviews.length) {
    return pass("recommendation_provenance", "Operator write provenance", "No operator-facing writes required in-run provenance.");
  }

  const ledger = createAgentEvidenceLedger();
  const violations: string[] = [];
  let recommendationWrites = 0;
  let reviewWrites = 0;

  for (const step of steps) {
    if (step.kind !== "tool_result") {
      continue;
    }

    const output = parseStepOutput(step);
    if (step.toolName === "record_recommendation" && output?.ok === true) {
      recommendationWrites += 1;
      const args = parseStepInput(step) ?? {};
      const violation = recommendationProvenanceViolation(args, ledger);
      if (violation) {
        violations.push(violation);
      }
    }

    if (step.toolName === "request_operator_review" && output?.ok === true) {
      reviewWrites += 1;
      const args = parseStepInput(step) ?? {};
      const violation = toolProvenanceViolation("request_operator_review", args, ledger);
      if (violation) {
        violations.push(violation);
      }
    }

    updateLedgerFromStep(step.toolName, output, ledger);
  }

  if (violations.length) {
    return fail("recommendation_provenance", "Operator write provenance", unique(violations).join(" "));
  }

  if (recommendationWrites < recommendations.length || reviewWrites < operatorReviews.length) {
    return warn("recommendation_provenance", "Operator write provenance", `Found ${recommendationWrites}/${recommendations.length} recommendation write(s) and ${reviewWrites}/${operatorReviews.length} review request(s) in the trace.`);
  }

  return pass("recommendation_provenance", "Operator write provenance", `${recommendationWrites} recommendation write(s) and ${reviewWrites} review request(s) were backed by prior in-run observations.`);
}

function checkEpisodeEvaluation(reflection: AgentReflection | null, evaluation: AgentEpisodeEvaluation | null): AgentContractCheck {
  if (reflection && evaluation) {
    return pass("episode_evaluation", "Episode evaluation", `Evaluation ${evaluation.overallScore}/100 ${evaluation.verdict}; reflection ${reflection.score}/100 ${reflection.outcome}.`);
  }

  if (reflection || evaluation) {
    return warn("episode_evaluation", "Episode evaluation", "Run produced only one of evaluation or reflection memory.");
  }

  return fail("episode_evaluation", "Episode evaluation", "Run ended without persisted evaluation or reflection memory.");
}

function checkPlaybookLearning(
  reflection: AgentReflection | null,
  evaluation: AgentEpisodeEvaluation | null,
  playbookEntries: AgentPlaybookEntry[],
): AgentContractCheck {
  if (!reflection || !evaluation) {
    return fail("playbook_learning", "Playbook learning", "Run cannot update the durable playbook without persisted evaluation and reflection.");
  }

  if (!playbookEntries.length) {
    return fail("playbook_learning", "Playbook learning", "Completed evaluated run produced no durable playbook directive.");
  }

  const malformed = playbookEntries.filter((entry) => !entry.instruction.trim() || !entry.rationale.trim());
  if (malformed.length) {
    return fail("playbook_learning", "Playbook learning", `${malformed.length} playbook directive(s) are missing instruction or rationale.`);
  }

  const kinds = unique(playbookEntries.map((entry) => entry.kind));
  return pass("playbook_learning", "Playbook learning", `Recorded ${playbookEntries.length} durable directive(s): ${kinds.join(", ")}.`);
}

function checkStop(
  run: AgentRun,
  toolCalls: Array<{ name: string; ok: boolean }>,
  steps: AgentStep[],
  plan: AgentRunPlan | null,
): AgentContractCheck {
  if (run.status === "failed") {
    return fail("stop", "Stop condition", run.errorMessage ?? "Run failed before a clean stop.");
  }

  const stop = toolCalls.find((call) => call.name === "stop_agent");
  if (!stop?.ok) {
    if (run.status === "completed") {
      return warn("stop", "Stop condition", "Run completed without an explicit successful stop_agent call.");
    }

    return fail("stop", "Stop condition", `Run ended with status ${run.status}.`);
  }

  const stopStep = steps
    .filter((step) => step.kind === "tool_result" && step.toolName === "stop_agent")
    .at(-1);
  if (!stopStep) {
    return fail("stop", "Stop condition", "Successful stop_agent call is missing from the persisted trace.");
  }

  const stopInput = parseStepInput(stopStep);
  const decision = parseStopDecision(stopInput);
  if (!decision) {
    return fail("stop", "Stop condition", "stop_agent did not include structured outcome, criteria results, and next actions.");
  }

  if (plan && decision.criteriaResults.length < plan.successCriteria.length) {
    return fail("stop", "Stop condition", `Stop decision judged ${decision.criteriaResults.length}/${plan.successCriteria.length} plan success criteria.`);
  }

  const unsatisfiedSuccess = decision.criteriaResults.filter((item) => item.status === "unsatisfied");
  if (decision.outcome === "success" && unsatisfiedSuccess.length) {
    return fail("stop", "Stop condition", `Stop outcome was success but ${unsatisfiedSuccess.length} criterion result(s) were unsatisfied.`);
  }

  const partialSuccess = decision.criteriaResults.filter((item) => item.status === "partial");
  if (decision.outcome === "success" && partialSuccess.length && !partialCriteriaAreBounded(partialSuccess, decision)) {
    return fail("stop", "Stop condition", `Stop outcome was success but ${partialSuccess.length} partial criterion result(s) were not bounded by explicit data limitations and follow-up.`);
  }

  const partialDetail = partialSuccess.length
    ? `; ${partialSuccess.length} partial criterion result(s) carried explicit limitation/follow-up context`
    : "";
  return pass("stop", "Stop condition", `Stopped with outcome ${decision.outcome}; judged ${decision.criteriaResults.length} criterion result(s)${partialDetail}.`);
}

function scoreChecks(checks: AgentContractCheck[]) {
  const total = checks.reduce((sum, check) => {
    if (check.status === "pass") {
      return sum + 100;
    }

    if (check.status === "warn") {
      return sum + 60;
    }

    return sum;
  }, 0);

  return Math.round(total / checks.length);
}

function pass(id: string, label: string, detail: string): AgentContractCheck {
  return { id, label, status: "pass", detail };
}

function warn(id: string, label: string, detail: string): AgentContractCheck {
  return { id, label, status: "warn", detail };
}

function fail(id: string, label: string, detail: string): AgentContractCheck {
  return { id, label, status: "fail", detail };
}

function guardrailSummary(events: Array<{ decision: AgentGuardrailDecision }>) {
  const counts = events.reduce<Record<string, number>>((result, event) => {
    result[event.decision] = (result[event.decision] ?? 0) + 1;
    return result;
  }, {});

  return `${counts.allowed ?? 0} allowed, ${counts.rewritten ?? 0} rewritten, ${counts.blocked ?? 0} blocked.`;
}

function deliberateNoDuplicateWriteReason(
  run: AgentRun,
  steps: AgentStep[],
  memory: AgentWorkingMemory | null,
  toolCalls: Array<{ name: string; ok: boolean }>,
) {
  if (run.status !== "completed") {
    return null;
  }

  const observedCurrentState = toolCalls.some((call) => call.ok && (
    call.name === "get_radar_state"
    || call.name === "run_discovery_pass"
    || call.name === "inspect_recent_failures"
  ));
  const stoppedCleanly = toolCalls.some((call) => call.ok && call.name === "stop_agent");
  if (!observedCurrentState || !stoppedCleanly) {
    return null;
  }

  const stopStep = steps
    .filter((step) => step.kind === "tool_result" && step.toolName === "stop_agent")
    .at(-1);
  const stopInput = stopStep ? parseStepInput(stopStep) : null;
  const stopDecision = parseStopDecision(stopInput);
  if (!stopDecision) {
    return null;
  }

  const text = normalizeText([
    run.summary,
    memory?.focus,
    ...(memory?.hypotheses ?? []),
    ...(memory?.nextActions ?? []),
    ...(memory?.openQuestions ?? []),
    ...planTexts(steps),
    stopDecision.summary,
    ...stopDecision.nextActions,
    ...stopDecision.criteriaResults.flatMap((result) => [result.criterion, result.evidence]),
    ...stringList(stopInput?.unresolvedQuestions),
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim())));

  const duplicateAvoidanceSignals = [
    "already covered",
    "already covers",
    "already accounted",
    "already recommended",
    "covered by existing",
    "current recommendations cover",
    "existing open recommendation",
    "existing recommendation",
    "no additional recommendation",
    "no duplicate",
    "no new action",
    "no new recommendation",
    "open recommendation",
    "skip duplicate",
    "without duplicating",
  ].map((signal) => normalizeText([signal]));

  if (!duplicateAvoidanceSignals.some((signal) => text.includes(signal))) {
    return null;
  }

  return "Conserved operator attention after observing current state because existing recommendations already covered the decision set.";
}

function planTexts(steps: AgentStep[]) {
  return steps
    .filter((step) => step.kind === "tool_result" && step.toolName === "set_episode_plan" && parseStepOutput(step)?.ok === true)
    .flatMap((step) => {
      const input = parseStepInput(step);
      if (!input) {
        return [];
      }

      return [
        stringValue(input.objective),
        ...stringList(input.successCriteria),
        ...stringList(input.plannedSteps),
        ...stringList(input.stopConditions),
        ...stringList(input.riskChecks),
      ].filter((value): value is string => Boolean(value));
    });
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
}

function significantTerms(text: string) {
  const stopwords = new Set([
    "about",
    "active",
    "after",
    "again",
    "agent",
    "before",
    "check",
    "during",
    "episode",
    "experiment",
    "first",
    "from",
    "into",
    "next",
    "start",
    "that",
    "this",
    "with",
  ]);

  return unique(normalizeText([text])
    .split(/\s+/)
    .filter((term) => term.length >= 5 && !stopwords.has(term)))
    .slice(0, 8);
}

function normalizeText(values: string[]) {
  return values
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function modelActionSegments(steps: AgentStep[]) {
  const segments: Array<{ modelStepIndex: number; toolCalls: AgentStep[] }> = [];
  let current: { modelStepIndex: number; toolCalls: AgentStep[] } | null = null;

  for (const step of steps) {
    if (step.kind === "model_response") {
      current = {
        modelStepIndex: step.stepIndex,
        toolCalls: [],
      };
      segments.push(current);
      continue;
    }

    if (step.kind === "tool_call" && current) {
      current.toolCalls.push(step);
    }
  }

  return segments;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function parseStepInput(step: AgentStep) {
  try {
    const parsed = JSON.parse(step.inputJson) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function parseStepOutput(step: AgentStep) {
  try {
    const parsed = JSON.parse(step.outputJson) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as { ok?: unknown; data?: unknown; error?: unknown }
      : null;
  } catch {
    return null;
  }
}

function parseStopDecision(input: Record<string, unknown> | null) {
  if (!input) {
    return null;
  }

  const outcome = typeof input.outcome === "string" ? input.outcome : null;
  if (outcome !== "success" && outcome !== "blocked" && outcome !== "no_signal" && outcome !== "budget_exhausted") {
    return null;
  }

  const criteriaResults = Array.isArray(input.criteriaResults)
    ? input.criteriaResults
      .map(parseCriterionResult)
      .filter((item): item is { criterion: string; status: "satisfied" | "partial" | "unsatisfied" | "not_applicable"; evidence: string } => item !== null)
    : [];
  const nextActions = Array.isArray(input.nextActions)
    ? input.nextActions.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  const unresolvedQuestions = Array.isArray(input.unresolvedQuestions)
    ? input.unresolvedQuestions.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];
  const summary = typeof input.summary === "string" ? input.summary.trim() : "";

  if (!criteriaResults.length || !nextActions.length || !summary) {
    return null;
  }

  return { outcome, criteriaResults, nextActions, unresolvedQuestions, summary };
}

function partialCriteriaAreBounded(
  partialCriteria: Array<{ criterion: string; evidence: string }>,
  decision: {
    nextActions: string[];
    unresolvedQuestions: string[];
    summary: string;
  },
) {
  const followUpText = normalizeText([
    decision.summary,
    ...decision.nextActions,
    ...decision.unresolvedQuestions,
  ]);
  const hasFollowUp = [
    "before",
    "confirm",
    "exact",
    "external",
    "inspect",
    "manual",
    "next run",
    "operator",
    "required",
    "unresolved",
    "verify",
  ].some((signal) => followUpText.includes(signal));

  if (!hasFollowUp) {
    return false;
  }

  const limitationSignals = [
    "did not expose",
    "external",
    "limited",
    "limitation",
    "missing",
    "no exact",
    "not available",
    "not exposed",
    "not verified",
    "unavailable",
    "unknown",
    "unresolved",
  ].map((signal) => normalizeText([signal]));

  return partialCriteria.every((item) => {
    const criterionText = normalizeText([item.criterion, item.evidence]);
    return limitationSignals.some((signal) => criterionText.includes(signal));
  });
}

function parseCriterionResult(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const criterion = typeof record.criterion === "string" ? record.criterion.trim() : "";
  const evidence = typeof record.evidence === "string" ? record.evidence.trim() : "";
  const status = record.status;
  if (!criterion || !evidence) {
    return null;
  }

  if (status !== "satisfied" && status !== "partial" && status !== "unsatisfied" && status !== "not_applicable") {
    return null;
  }

  return { criterion, status, evidence };
}

function updateLedgerFromStep(toolName: string | null, output: { ok?: unknown; data?: unknown; error?: unknown } | null, ledger: AgentEvidenceLedger) {
  updateAgentEvidenceLedger(toolName, {
    ok: output?.ok === true,
    data: output?.data,
    error: typeof output?.error === "string" ? output.error : undefined,
  }, ledger);
}
