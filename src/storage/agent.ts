import { randomUUID } from "node:crypto";
import { ensureDatabase, sqlite } from "./database";

export type AgentRunMode = "openai";
export type AgentRunStatus = "running" | "completed" | "failed" | "skipped";
export type AgentStepKind = "model_response" | "tool_call" | "tool_result" | "final";
export type AgentGuardrailDecision = "allowed" | "rewritten" | "blocked";
export type AgentRecommendationPriority = "low" | "medium" | "high" | "urgent";
export type AgentRecommendationAction =
  | "inspect_listing"
  | "draft_outreach"
  | "status_update"
  | "search_adjustment"
  | "operator_review"
  | "config_change";
export type AgentReflectionOutcome = "useful" | "blocked" | "no_signal" | "unsafe" | "failed";
export type AgentEvaluationVerdict = "strong" | "useful" | "weak" | "unsafe" | "failed";
export type AgentContractAuditStatus = "pass" | "warn" | "fail";
export type AgentExperimentStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";
export type AgentPlaybookEntryKind = "policy" | "heuristic" | "anti_pattern" | "operator_preference";

export type AgentContractCheck = {
  id: string;
  label: string;
  status: AgentContractAuditStatus;
  detail: string;
};

export type AgentRecommendationEvidenceKind =
  | "listing"
  | "score"
  | "commute"
  | "notification"
  | "source_event"
  | "failure"
  | "working_memory"
  | "operator_constraint"
  | "model_observation";

export type AgentRecommendationEvidence = {
  kind: AgentRecommendationEvidenceKind;
  ref: string;
  detail: string;
};

export type AgentRun = {
  id: string;
  objective: string;
  mode: AgentRunMode;
  model: string | null;
  status: AgentRunStatus;
  iterations: number;
  summary: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
};

export type AgentStep = {
  id: string;
  runId: string;
  stepIndex: number;
  kind: AgentStepKind;
  toolName: string | null;
  inputJson: string;
  outputJson: string;
  createdAt: string;
};

export type AgentRecommendation = {
  id: string;
  runId: string;
  listingId: string | null;
  priority: AgentRecommendationPriority;
  actionType: AgentRecommendationAction;
  title: string;
  rationale: string;
  evidence: AgentRecommendationEvidence[];
  proposedStatus: string | null;
  status: "open" | "accepted" | "dismissed";
  createdAt: string;
};

export type AgentOperatorReviewOption = {
  label: string;
  description: string;
};

export type AgentOperatorReview = {
  id: string;
  runId: string;
  listingId: string | null;
  urgency: AgentRecommendationPriority;
  question: string;
  options: AgentOperatorReviewOption[];
  recommendedOption: string;
  rationale: string;
  evidence: AgentRecommendationEvidence[];
  blocking: boolean;
  selectedOption: string | null;
  operatorNote: string | null;
  resolvedAt: string | null;
  resumeRunId: string | null;
  resumeClaimedAt: string | null;
  status: "open" | "answered" | "dismissed";
  createdAt: string;
};

export type AgentReflection = {
  id: string;
  runId: string;
  score: number;
  outcome: AgentReflectionOutcome;
  summary: string;
  lessons: string[];
  nextRunGuidance: string;
  createdAt: string;
};

export type AgentEpisodeEvaluation = {
  id: string;
  runId: string;
  overallScore: number;
  verdict: AgentEvaluationVerdict;
  objectiveAlignment: number;
  evidenceGrounding: number;
  toolDiscipline: number;
  safetyDiscipline: number;
  operatorValue: number;
  learningQuality: number;
  findings: string[];
  nextExperiment: string;
  createdAt: string;
};

export type AgentContractAudit = {
  id: string;
  runId: string;
  status: AgentContractAuditStatus;
  score: number;
  checks: AgentContractCheck[];
  createdAt: string;
};

export type AgentExperiment = {
  id: string;
  sourceRunId: string;
  description: string;
  status: AgentExperimentStatus;
  startedRunId: string | null;
  completedRunId: string | null;
  resultSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AgentPlaybookEntry = {
  id: string;
  sourceRunId: string;
  kind: AgentPlaybookEntryKind;
  instruction: string;
  rationale: string;
  status: "active" | "superseded";
  createdAt: string;
};

export type AgentGuardrailEvent = {
  id: string;
  runId: string;
  stepIndex: number;
  toolName: string;
  decision: AgentGuardrailDecision;
  reason: string;
  inputJson: string;
  effectiveInputJson: string;
  createdAt: string;
};

export type AgentWorkingMemory = {
  id: string;
  runId: string;
  revision: number;
  focus: string;
  hypotheses: string[];
  nextActions: string[];
  openQuestions: string[];
  confidence: number;
  createdAt: string;
};

export type AgentRunPlan = {
  id: string;
  runId: string;
  objective: string;
  successCriteria: string[];
  plannedSteps: string[];
  stopConditions: string[];
  riskChecks: string[];
  confidence: number;
  createdAt: string;
};

export type AgentRunContext = {
  id: string;
  runId: string;
  objective: string;
  notificationMode: "send" | "dry-run" | "off";
  maxIterations: number;
  activeExperimentId: string | null;
  resumedOperatorReviewId: string | null;
  activePlaybookEntryIds: string[];
  recentReflectionIds: string[];
  recentEvaluationIds: string[];
  recentContractAuditIds: string[];
  createdAt: string;
};

type AgentRunRow = {
  id: string;
  objective: string;
  mode: AgentRunMode;
  model: string | null;
  status: AgentRunStatus;
  iterations: number;
  summary: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
};

type AgentStepRow = {
  id: string;
  run_id: string;
  step_index: number;
  kind: AgentStepKind;
  tool_name: string | null;
  input_json: string;
  output_json: string;
  created_at: string;
};

type AgentRunContextRow = {
  id: string;
  run_id: string;
  objective: string;
  notification_mode: "send" | "dry-run" | "off";
  max_iterations: number;
  active_experiment_id: string | null;
  resumed_operator_review_id: string | null;
  active_playbook_entry_ids_json: string;
  recent_reflection_ids_json: string;
  recent_evaluation_ids_json: string;
  recent_contract_audit_ids_json: string;
  created_at: string;
};

type AgentRecommendationRow = {
  id: string;
  run_id: string;
  listing_id: string | null;
  priority: AgentRecommendationPriority;
  action_type: AgentRecommendationAction;
  title: string;
  rationale: string;
  evidence_json: string;
  proposed_status: string | null;
  status: "open" | "accepted" | "dismissed";
  created_at: string;
};

type AgentOperatorReviewRow = {
  id: string;
  run_id: string;
  listing_id: string | null;
  urgency: AgentRecommendationPriority;
  question: string;
  options_json: string;
  recommended_option: string;
  rationale: string;
  evidence_json: string;
  blocking: 0 | 1;
  selected_option: string | null;
  operator_note: string | null;
  resolved_at: string | null;
  resume_run_id: string | null;
  resume_claimed_at: string | null;
  status: "open" | "answered" | "dismissed";
  created_at: string;
};

type AgentReflectionRow = {
  id: string;
  run_id: string;
  score: number;
  outcome: AgentReflectionOutcome;
  summary: string;
  lessons_json: string;
  next_run_guidance: string;
  created_at: string;
};

type AgentEpisodeEvaluationRow = {
  id: string;
  run_id: string;
  overall_score: number;
  verdict: AgentEvaluationVerdict;
  objective_alignment: number;
  evidence_grounding: number;
  tool_discipline: number;
  safety_discipline: number;
  operator_value: number;
  learning_quality: number;
  findings_json: string;
  next_experiment: string;
  created_at: string;
};

type AgentContractAuditRow = {
  id: string;
  run_id: string;
  status: AgentContractAuditStatus;
  score: number;
  checks_json: string;
  created_at: string;
};

type AgentExperimentRow = {
  id: string;
  source_run_id: string;
  description: string;
  status: AgentExperimentStatus;
  started_run_id: string | null;
  completed_run_id: string | null;
  result_summary: string | null;
  created_at: string;
  updated_at: string;
};

type AgentPlaybookEntryRow = {
  id: string;
  source_run_id: string;
  kind: AgentPlaybookEntryKind;
  instruction: string;
  rationale: string;
  status: "active" | "superseded";
  created_at: string;
};

type AgentGuardrailEventRow = {
  id: string;
  run_id: string;
  step_index: number;
  tool_name: string;
  decision: AgentGuardrailDecision;
  reason: string;
  input_json: string;
  effective_input_json: string;
  created_at: string;
};

type AgentWorkingMemoryRow = {
  id: string;
  run_id: string;
  revision: number;
  focus: string;
  hypotheses_json: string;
  next_actions_json: string;
  open_questions_json: string;
  confidence: number;
  created_at: string;
};

type AgentRunPlanRow = {
  id: string;
  run_id: string;
  objective: string;
  success_criteria_json: string;
  planned_steps_json: string;
  stop_conditions_json: string;
  risk_checks_json: string;
  confidence: number;
  created_at: string;
};

export function startAgentRun(input: {
  objective: string;
  mode: AgentRunMode;
  model?: string | null;
  now?: Date;
}) {
  ensureDatabase();
  const run: AgentRun = {
    id: `agent-run-${randomUUID()}`,
    objective: input.objective,
    mode: input.mode,
    model: input.model ?? null,
    status: "running",
    iterations: 0,
    summary: null,
    errorMessage: null,
    startedAt: (input.now ?? new Date()).toISOString(),
    completedAt: null,
  };

  sqlite.prepare(`
    INSERT INTO agent_runs (
      id,
      objective,
      mode,
      model,
      status,
      iterations,
      summary,
      error_message,
      started_at,
      completed_at
    ) VALUES (
      @id,
      @objective,
      @mode,
      @model,
      @status,
      @iterations,
      @summary,
      @errorMessage,
      @startedAt,
      @completedAt
    )
  `).run(run);

  return run;
}

export function finishAgentRun(
  id: string,
  input: {
    status: Exclude<AgentRunStatus, "running">;
    iterations: number;
    summary?: string | null;
    errorMessage?: string | null;
    now?: Date;
  },
) {
  ensureDatabase();
  sqlite.prepare(`
    UPDATE agent_runs
    SET
      status = ?,
      iterations = ?,
      summary = ?,
      error_message = ?,
      completed_at = ?
    WHERE id = ?
  `).run(
    input.status,
    input.iterations,
    input.summary ?? null,
    input.errorMessage ?? null,
    (input.now ?? new Date()).toISOString(),
    id,
  );

  return getAgentRun(id);
}

export function recordAgentStep(input: {
  runId: string;
  stepIndex: number;
  kind: AgentStepKind;
  toolName?: string | null;
  input: unknown;
  output: unknown;
  now?: Date;
}) {
  ensureDatabase();
  const step: AgentStep = {
    id: `agent-step-${randomUUID()}`,
    runId: input.runId,
    stepIndex: input.stepIndex,
    kind: input.kind,
    toolName: input.toolName ?? null,
    inputJson: stableJson(input.input),
    outputJson: stableJson(input.output),
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_steps (
      id,
      run_id,
      step_index,
      kind,
      tool_name,
      input_json,
      output_json,
      created_at
    ) VALUES (
      @id,
      @runId,
      @stepIndex,
      @kind,
      @toolName,
      @inputJson,
      @outputJson,
      @createdAt
    )
  `).run(step);

  return step;
}

export function recordAgentRunContext(input: {
  runId: string;
  objective: string;
  notificationMode: "send" | "dry-run" | "off";
  maxIterations: number;
  activeExperimentId?: string | null;
  resumedOperatorReviewId?: string | null;
  activePlaybookEntryIds: string[];
  recentReflectionIds: string[];
  recentEvaluationIds: string[];
  recentContractAuditIds: string[];
  now?: Date;
}) {
  ensureDatabase();
  const context: AgentRunContext = {
    id: `agent-context-${randomUUID()}`,
    runId: input.runId,
    objective: input.objective,
    notificationMode: input.notificationMode,
    maxIterations: Math.max(1, Math.round(input.maxIterations)),
    activeExperimentId: input.activeExperimentId ?? null,
    resumedOperatorReviewId: input.resumedOperatorReviewId ?? null,
    activePlaybookEntryIds: input.activePlaybookEntryIds,
    recentReflectionIds: input.recentReflectionIds,
    recentEvaluationIds: input.recentEvaluationIds,
    recentContractAuditIds: input.recentContractAuditIds,
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_run_context (
      id,
      run_id,
      objective,
      notification_mode,
      max_iterations,
      active_experiment_id,
      resumed_operator_review_id,
      active_playbook_entry_ids_json,
      recent_reflection_ids_json,
      recent_evaluation_ids_json,
      recent_contract_audit_ids_json,
      created_at
    ) VALUES (
      @id,
      @runId,
      @objective,
      @notificationMode,
      @maxIterations,
      @activeExperimentId,
      @resumedOperatorReviewId,
      @activePlaybookEntryIdsJson,
      @recentReflectionIdsJson,
      @recentEvaluationIdsJson,
      @recentContractAuditIdsJson,
      @createdAt
    )
  `).run({
    ...context,
    activePlaybookEntryIdsJson: stableJson(context.activePlaybookEntryIds),
    recentReflectionIdsJson: stableJson(context.recentReflectionIds),
    recentEvaluationIdsJson: stableJson(context.recentEvaluationIds),
    recentContractAuditIdsJson: stableJson(context.recentContractAuditIds),
  });

  return context;
}

export function recordAgentRecommendation(input: {
  runId: string;
  listingId?: string | null;
  priority: AgentRecommendationPriority;
  actionType: AgentRecommendationAction;
  title: string;
  rationale: string;
  evidence: AgentRecommendationEvidence[];
  proposedStatus?: string | null;
  now?: Date;
}) {
  ensureDatabase();
  const recommendation: AgentRecommendation = {
    id: `agent-rec-${randomUUID()}`,
    runId: input.runId,
    listingId: input.listingId ?? null,
    priority: input.priority,
    actionType: input.actionType,
    title: input.title,
    rationale: input.rationale,
    evidence: input.evidence,
    proposedStatus: input.proposedStatus ?? null,
    status: "open",
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_recommendations (
      id,
      run_id,
      listing_id,
      priority,
      action_type,
      title,
      rationale,
      evidence_json,
      proposed_status,
      status,
      created_at
    ) VALUES (
      @id,
      @runId,
      @listingId,
      @priority,
      @actionType,
      @title,
      @rationale,
      @evidenceJson,
      @proposedStatus,
      @status,
      @createdAt
    )
  `).run({
    ...recommendation,
    evidenceJson: stableJson(recommendation.evidence),
  });

  return recommendation;
}

export function recordAgentOperatorReview(input: {
  runId: string;
  listingId?: string | null;
  urgency: AgentRecommendationPriority;
  question: string;
  options: AgentOperatorReviewOption[];
  recommendedOption: string;
  rationale: string;
  evidence: AgentRecommendationEvidence[];
  blocking: boolean;
  now?: Date;
}) {
  ensureDatabase();
  const review: AgentOperatorReview = {
    id: `agent-review-${randomUUID()}`,
    runId: input.runId,
    listingId: input.listingId ?? null,
    urgency: input.urgency,
    question: input.question,
    options: input.options,
    recommendedOption: input.recommendedOption,
    rationale: input.rationale,
    evidence: input.evidence,
    blocking: input.blocking,
    selectedOption: null,
    operatorNote: null,
    resolvedAt: null,
    resumeRunId: null,
    resumeClaimedAt: null,
    status: "open",
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_operator_reviews (
      id,
      run_id,
      listing_id,
      urgency,
      question,
      options_json,
      recommended_option,
      rationale,
      evidence_json,
      blocking,
      selected_option,
      operator_note,
      resolved_at,
      status,
      created_at
    ) VALUES (
      @id,
      @runId,
      @listingId,
      @urgency,
      @question,
      @optionsJson,
      @recommendedOption,
      @rationale,
      @evidenceJson,
      @blockingValue,
      @selectedOption,
      @operatorNote,
      @resolvedAt,
      @status,
      @createdAt
    )
  `).run({
    ...review,
    optionsJson: stableJson(review.options),
    evidenceJson: stableJson(review.evidence),
    blockingValue: review.blocking ? 1 : 0,
  });

  return review;
}

export function getAgentOperatorReview(id: string) {
  ensureDatabase();
  const row = sqlite
    .prepare("SELECT * FROM agent_operator_reviews WHERE id = ?")
    .get(id) as AgentOperatorReviewRow | undefined;

  return row ? rowToAgentOperatorReview(row) : null;
}

export function answerAgentOperatorReview(input: {
  id: string;
  selectedOption: string;
  note?: string | null;
  now?: Date;
}) {
  ensureDatabase();
  const review = getAgentOperatorReview(input.id);
  if (!review) {
    return null;
  }

  if (review.status !== "open") {
    throw new Error(`Operator review is already ${review.status}: ${review.id}`);
  }

  if (!review.options.some((option) => option.label === input.selectedOption)) {
    throw new Error(`Answer must match one review option: ${review.options.map((option) => option.label).join(", ")}`);
  }

  const resolvedAt = (input.now ?? new Date()).toISOString();
  sqlite.prepare(`
    UPDATE agent_operator_reviews
    SET status = 'answered',
        selected_option = @selectedOption,
        operator_note = @operatorNote,
        resolved_at = @resolvedAt
    WHERE id = @id
  `).run({
    id: input.id,
    selectedOption: input.selectedOption,
    operatorNote: input.note ?? null,
    resolvedAt,
  });

  return getAgentOperatorReview(input.id);
}

export function dismissAgentOperatorReview(input: {
  id: string;
  note?: string | null;
  now?: Date;
}) {
  ensureDatabase();
  const review = getAgentOperatorReview(input.id);
  if (!review) {
    return null;
  }

  if (review.status !== "open") {
    throw new Error(`Operator review is already ${review.status}: ${review.id}`);
  }

  const resolvedAt = (input.now ?? new Date()).toISOString();
  sqlite.prepare(`
    UPDATE agent_operator_reviews
    SET status = 'dismissed',
        selected_option = NULL,
        operator_note = @operatorNote,
        resolved_at = @resolvedAt
    WHERE id = @id
  `).run({
    id: input.id,
    operatorNote: input.note ?? null,
    resolvedAt,
  });

  return getAgentOperatorReview(input.id);
}

export function claimNextAgentOperatorReviewContinuation(resumeRunId: string, now = new Date()) {
  ensureDatabase();
  const row = sqlite.prepare(`
    SELECT *
    FROM agent_operator_reviews
    WHERE blocking = 1
      AND status IN ('answered', 'dismissed')
      AND resume_run_id IS NULL
    ORDER BY resolved_at DESC, created_at DESC
    LIMIT 1
  `).get() as AgentOperatorReviewRow | undefined;

  if (!row) {
    return null;
  }

  const claimedAt = now.toISOString();
  sqlite.prepare(`
    UPDATE agent_operator_reviews
    SET resume_run_id = ?,
        resume_claimed_at = ?
    WHERE id = ? AND resume_run_id IS NULL
  `).run(resumeRunId, claimedAt, row.id);

  return getAgentOperatorReview(row.id);
}

export function getAgentOperatorReviewContinuationForRun(resumeRunId: string) {
  ensureDatabase();
  const row = sqlite.prepare(`
    SELECT *
    FROM agent_operator_reviews
    WHERE resume_run_id = ?
    ORDER BY resume_claimed_at DESC
    LIMIT 1
  `).get(resumeRunId) as AgentOperatorReviewRow | undefined;

  return row ? rowToAgentOperatorReview(row) : null;
}

export function recordAgentReflection(input: {
  runId: string;
  score: number;
  outcome: AgentReflectionOutcome;
  summary: string;
  lessons: string[];
  nextRunGuidance: string;
  now?: Date;
}) {
  ensureDatabase();
  const reflection: AgentReflection = {
    id: `agent-reflection-${randomUUID()}`,
    runId: input.runId,
    score: clampScore(input.score),
    outcome: input.outcome,
    summary: input.summary,
    lessons: input.lessons,
    nextRunGuidance: input.nextRunGuidance,
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_reflections (
      id,
      run_id,
      score,
      outcome,
      summary,
      lessons_json,
      next_run_guidance,
      created_at
    ) VALUES (
      @id,
      @runId,
      @score,
      @outcome,
      @summary,
      @lessonsJson,
      @nextRunGuidance,
      @createdAt
    )
  `).run({
    ...reflection,
    lessonsJson: stableJson(reflection.lessons),
  });

  return reflection;
}

export function recordAgentEvaluation(input: {
  runId: string;
  verdict: AgentEvaluationVerdict;
  objectiveAlignment: number;
  evidenceGrounding: number;
  toolDiscipline: number;
  safetyDiscipline: number;
  operatorValue: number;
  learningQuality: number;
  findings: string[];
  nextExperiment: string;
  now?: Date;
}) {
  ensureDatabase();
  const evaluation: AgentEpisodeEvaluation = {
    id: `agent-eval-${randomUUID()}`,
    runId: input.runId,
    overallScore: averageScores([
      input.objectiveAlignment,
      input.evidenceGrounding,
      input.toolDiscipline,
      input.safetyDiscipline,
      input.operatorValue,
      input.learningQuality,
    ]),
    verdict: input.verdict,
    objectiveAlignment: clampScore(input.objectiveAlignment),
    evidenceGrounding: clampScore(input.evidenceGrounding),
    toolDiscipline: clampScore(input.toolDiscipline),
    safetyDiscipline: clampScore(input.safetyDiscipline),
    operatorValue: clampScore(input.operatorValue),
    learningQuality: clampScore(input.learningQuality),
    findings: input.findings,
    nextExperiment: input.nextExperiment,
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_evaluations (
      id,
      run_id,
      overall_score,
      verdict,
      objective_alignment,
      evidence_grounding,
      tool_discipline,
      safety_discipline,
      operator_value,
      learning_quality,
      findings_json,
      next_experiment,
      created_at
    ) VALUES (
      @id,
      @runId,
      @overallScore,
      @verdict,
      @objectiveAlignment,
      @evidenceGrounding,
      @toolDiscipline,
      @safetyDiscipline,
      @operatorValue,
      @learningQuality,
      @findingsJson,
      @nextExperiment,
      @createdAt
    )
  `).run({
    ...evaluation,
    findingsJson: stableJson(evaluation.findings),
  });

  return evaluation;
}

export function recordAgentExperiment(input: {
  sourceRunId: string;
  description: string;
  now?: Date;
}) {
  ensureDatabase();
  const now = (input.now ?? new Date()).toISOString();
  const experiment: AgentExperiment = {
    id: `agent-experiment-${randomUUID()}`,
    sourceRunId: input.sourceRunId,
    description: input.description.trim(),
    status: "pending",
    startedRunId: null,
    completedRunId: null,
    resultSummary: null,
    createdAt: now,
    updatedAt: now,
  };

  sqlite.prepare(`
    INSERT INTO agent_experiments (
      id,
      source_run_id,
      description,
      status,
      started_run_id,
      completed_run_id,
      result_summary,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @sourceRunId,
      @description,
      @status,
      @startedRunId,
      @completedRunId,
      @resultSummary,
      @createdAt,
      @updatedAt
    )
  `).run(experiment);

  return experiment;
}

export function recordAgentPlaybookEntry(input: {
  sourceRunId: string;
  kind: AgentPlaybookEntryKind;
  instruction: string;
  rationale: string;
  now?: Date;
}) {
  ensureDatabase();
  const entry: AgentPlaybookEntry = {
    id: `agent-playbook-${randomUUID()}`,
    sourceRunId: input.sourceRunId,
    kind: input.kind,
    instruction: input.instruction.trim(),
    rationale: input.rationale.trim(),
    status: "active",
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_playbook_entries (
      id,
      source_run_id,
      kind,
      instruction,
      rationale,
      status,
      created_at
    ) VALUES (
      @id,
      @sourceRunId,
      @kind,
      @instruction,
      @rationale,
      @status,
      @createdAt
    )
  `).run(entry);

  return entry;
}

export function getPendingAgentExperiment() {
  ensureDatabase();
  const row = sqlite
    .prepare("SELECT * FROM agent_experiments WHERE status = 'pending' ORDER BY created_at DESC LIMIT 1")
    .get() as AgentExperimentRow | undefined;

  return row ? rowToAgentExperiment(row) : null;
}

export function startAgentExperiment(id: string, startedRunId: string, now = new Date()) {
  ensureDatabase();
  sqlite.prepare(`
    UPDATE agent_experiments
    SET
      status = 'running',
      started_run_id = ?,
      updated_at = ?
    WHERE id = ? AND status = 'pending'
  `).run(startedRunId, now.toISOString(), id);

  return getAgentExperiment(id);
}

export function finishAgentExperiment(
  id: string,
  input: {
    status: Exclude<AgentExperimentStatus, "pending" | "running">;
    completedRunId: string;
    resultSummary: string;
    now?: Date;
  },
) {
  ensureDatabase();
  sqlite.prepare(`
    UPDATE agent_experiments
    SET
      status = ?,
      completed_run_id = ?,
      result_summary = ?,
      updated_at = ?
    WHERE id = ?
  `).run(
    input.status,
    input.completedRunId,
    input.resultSummary,
    (input.now ?? new Date()).toISOString(),
    id,
  );

  return getAgentExperiment(id);
}

export function recordAgentContractAudit(input: {
  runId: string;
  status: AgentContractAuditStatus;
  score: number;
  checks: AgentContractCheck[];
  now?: Date;
}) {
  ensureDatabase();
  const audit: AgentContractAudit = {
    id: `agent-contract-${randomUUID()}`,
    runId: input.runId,
    status: input.status,
    score: clampScore(input.score),
    checks: input.checks,
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_contract_audits (
      id,
      run_id,
      status,
      score,
      checks_json,
      created_at
    ) VALUES (
      @id,
      @runId,
      @status,
      @score,
      @checksJson,
      @createdAt
    )
  `).run({
    ...audit,
    checksJson: stableJson(audit.checks),
  });

  return audit;
}

export function recordAgentGuardrailEvent(input: {
  runId: string;
  stepIndex: number;
  toolName: string;
  decision: AgentGuardrailDecision;
  reason: string;
  input: unknown;
  effectiveInput: unknown;
  now?: Date;
}) {
  ensureDatabase();
  const event: AgentGuardrailEvent = {
    id: `agent-guardrail-${randomUUID()}`,
    runId: input.runId,
    stepIndex: input.stepIndex,
    toolName: input.toolName,
    decision: input.decision,
    reason: input.reason,
    inputJson: stableJson(input.input),
    effectiveInputJson: stableJson(input.effectiveInput),
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_guardrail_events (
      id,
      run_id,
      step_index,
      tool_name,
      decision,
      reason,
      input_json,
      effective_input_json,
      created_at
    ) VALUES (
      @id,
      @runId,
      @stepIndex,
      @toolName,
      @decision,
      @reason,
      @inputJson,
      @effectiveInputJson,
      @createdAt
    )
  `).run(event);

  return event;
}

export function recordAgentWorkingMemory(input: {
  runId: string;
  focus: string;
  hypotheses: string[];
  nextActions: string[];
  openQuestions: string[];
  confidence: number;
  now?: Date;
}) {
  ensureDatabase();
  const revision = nextWorkingMemoryRevision(input.runId);
  const memory: AgentWorkingMemory = {
    id: `agent-memory-${randomUUID()}`,
    runId: input.runId,
    revision,
    focus: input.focus,
    hypotheses: input.hypotheses,
    nextActions: input.nextActions,
    openQuestions: input.openQuestions,
    confidence: clampConfidence(input.confidence),
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_working_memory (
      id,
      run_id,
      revision,
      focus,
      hypotheses_json,
      next_actions_json,
      open_questions_json,
      confidence,
      created_at
    ) VALUES (
      @id,
      @runId,
      @revision,
      @focus,
      @hypothesesJson,
      @nextActionsJson,
      @openQuestionsJson,
      @confidence,
      @createdAt
    )
  `).run({
    ...memory,
    hypothesesJson: stableJson(memory.hypotheses),
    nextActionsJson: stableJson(memory.nextActions),
    openQuestionsJson: stableJson(memory.openQuestions),
  });

  return memory;
}

export function recordAgentRunPlan(input: {
  runId: string;
  objective: string;
  successCriteria: string[];
  plannedSteps: string[];
  stopConditions: string[];
  riskChecks: string[];
  confidence: number;
  now?: Date;
}) {
  ensureDatabase();
  const plan: AgentRunPlan = {
    id: `agent-plan-${randomUUID()}`,
    runId: input.runId,
    objective: input.objective,
    successCriteria: input.successCriteria,
    plannedSteps: input.plannedSteps,
    stopConditions: input.stopConditions,
    riskChecks: input.riskChecks,
    confidence: clampConfidence(input.confidence),
    createdAt: (input.now ?? new Date()).toISOString(),
  };

  sqlite.prepare(`
    INSERT INTO agent_run_plans (
      id,
      run_id,
      objective,
      success_criteria_json,
      planned_steps_json,
      stop_conditions_json,
      risk_checks_json,
      confidence,
      created_at
    ) VALUES (
      @id,
      @runId,
      @objective,
      @successCriteriaJson,
      @plannedStepsJson,
      @stopConditionsJson,
      @riskChecksJson,
      @confidence,
      @createdAt
    )
  `).run({
    ...plan,
    successCriteriaJson: stableJson(plan.successCriteria),
    plannedStepsJson: stableJson(plan.plannedSteps),
    stopConditionsJson: stableJson(plan.stopConditions),
    riskChecksJson: stableJson(plan.riskChecks),
  });

  return plan;
}

export function getAgentRun(id: string) {
  ensureDatabase();
  const row = sqlite.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as AgentRunRow | undefined;
  return row ? rowToAgentRun(row) : null;
}

export function listAgentRuns(limit = 20) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?")
    .all(limit) as AgentRunRow[];

  return rows.map(rowToAgentRun);
}

export function listAgentSteps(runId: string) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_steps WHERE run_id = ? ORDER BY step_index ASC")
    .all(runId) as AgentStepRow[];

  return rows.map(rowToAgentStep);
}

export function getAgentRunContext(runId: string) {
  ensureDatabase();
  const row = sqlite
    .prepare("SELECT * FROM agent_run_context WHERE run_id = ?")
    .get(runId) as AgentRunContextRow | undefined;

  return row ? rowToAgentRunContext(row) : null;
}

export function listAgentRecommendations(limit = 20) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_recommendations ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentRecommendationRow[];

  return rows.map(rowToAgentRecommendation);
}

export function listAgentOperatorReviews(limit = 20) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_operator_reviews ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentOperatorReviewRow[];

  return rows.map(rowToAgentOperatorReview);
}

export function listAgentOperatorReviewsForRun(runId: string) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_operator_reviews WHERE run_id = ? ORDER BY created_at ASC")
    .all(runId) as AgentOperatorReviewRow[];

  return rows.map(rowToAgentOperatorReview);
}

export function listAgentReflections(limit = 10) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_reflections ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentReflectionRow[];

  return rows.map(rowToAgentReflection);
}

export function listAgentEvaluations(limit = 10) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_evaluations ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentEpisodeEvaluationRow[];

  return rows.map(rowToAgentEpisodeEvaluation);
}

export function getAgentEvaluationForRun(runId: string) {
  ensureDatabase();
  const row = sqlite
    .prepare("SELECT * FROM agent_evaluations WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(runId) as AgentEpisodeEvaluationRow | undefined;

  return row ? rowToAgentEpisodeEvaluation(row) : null;
}

export function getAgentExperiment(id: string) {
  ensureDatabase();
  const row = sqlite.prepare("SELECT * FROM agent_experiments WHERE id = ?").get(id) as AgentExperimentRow | undefined;
  return row ? rowToAgentExperiment(row) : null;
}

export function listAgentExperiments(limit = 10) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_experiments ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentExperimentRow[];

  return rows.map(rowToAgentExperiment);
}

export function listAgentPlaybookEntries(limit = 20) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_playbook_entries ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentPlaybookEntryRow[];

  return rows.map(rowToAgentPlaybookEntry);
}

export function listActiveAgentPlaybookEntries(limit = 20) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_playbook_entries WHERE status = 'active' ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentPlaybookEntryRow[];

  return rows.map(rowToAgentPlaybookEntry);
}

export function listAgentPlaybookEntriesForRun(runId: string) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_playbook_entries WHERE source_run_id = ? ORDER BY created_at ASC")
    .all(runId) as AgentPlaybookEntryRow[];

  return rows.map(rowToAgentPlaybookEntry);
}

export function listAgentContractAudits(limit = 10) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_contract_audits ORDER BY created_at DESC LIMIT ?")
    .all(limit) as AgentContractAuditRow[];

  return rows.map(rowToAgentContractAudit);
}

export function getAgentContractAuditForRun(runId: string) {
  ensureDatabase();
  const row = sqlite
    .prepare("SELECT * FROM agent_contract_audits WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(runId) as AgentContractAuditRow | undefined;

  return row ? rowToAgentContractAudit(row) : null;
}

export function listAgentGuardrailEvents(runId: string) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_guardrail_events WHERE run_id = ? ORDER BY step_index ASC")
    .all(runId) as AgentGuardrailEventRow[];

  return rows.map(rowToAgentGuardrailEvent);
}

export function listAgentWorkingMemory(runId: string) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_working_memory WHERE run_id = ? ORDER BY revision ASC")
    .all(runId) as AgentWorkingMemoryRow[];

  return rows.map(rowToAgentWorkingMemory);
}

export function getLatestAgentWorkingMemory(runId: string) {
  ensureDatabase();
  const row = sqlite
    .prepare("SELECT * FROM agent_working_memory WHERE run_id = ? ORDER BY revision DESC LIMIT 1")
    .get(runId) as AgentWorkingMemoryRow | undefined;

  return row ? rowToAgentWorkingMemory(row) : null;
}

export function listAgentRunPlans(runId: string) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM agent_run_plans WHERE run_id = ? ORDER BY created_at ASC")
    .all(runId) as AgentRunPlanRow[];

  return rows.map(rowToAgentRunPlan);
}

export function getLatestAgentRunPlan(runId: string) {
  ensureDatabase();
  const row = sqlite
    .prepare("SELECT * FROM agent_run_plans WHERE run_id = ? ORDER BY created_at DESC LIMIT 1")
    .get(runId) as AgentRunPlanRow | undefined;

  return row ? rowToAgentRunPlan(row) : null;
}

export function clearAgentState() {
  ensureDatabase();
  sqlite.prepare("DELETE FROM agent_run_context").run();
  sqlite.prepare("DELETE FROM agent_run_plans").run();
  sqlite.prepare("DELETE FROM agent_working_memory").run();
  sqlite.prepare("DELETE FROM agent_guardrail_events").run();
  sqlite.prepare("DELETE FROM agent_contract_audits").run();
  sqlite.prepare("DELETE FROM agent_playbook_entries").run();
  sqlite.prepare("DELETE FROM agent_experiments").run();
  sqlite.prepare("DELETE FROM agent_evaluations").run();
  sqlite.prepare("DELETE FROM agent_reflections").run();
  sqlite.prepare("DELETE FROM agent_operator_reviews").run();
  sqlite.prepare("DELETE FROM agent_recommendations").run();
  sqlite.prepare("DELETE FROM agent_steps").run();
  sqlite.prepare("DELETE FROM agent_runs").run();
}

function rowToAgentRun(row: AgentRunRow): AgentRun {
  return {
    id: row.id,
    objective: row.objective,
    mode: row.mode,
    model: row.model,
    status: row.status,
    iterations: row.iterations,
    summary: row.summary,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function rowToAgentStep(row: AgentStepRow): AgentStep {
  return {
    id: row.id,
    runId: row.run_id,
    stepIndex: row.step_index,
    kind: row.kind,
    toolName: row.tool_name,
    inputJson: row.input_json,
    outputJson: row.output_json,
    createdAt: row.created_at,
  };
}

function rowToAgentRunContext(row: AgentRunContextRow): AgentRunContext {
  return {
    id: row.id,
    runId: row.run_id,
    objective: row.objective,
    notificationMode: row.notification_mode,
    maxIterations: row.max_iterations,
    activeExperimentId: row.active_experiment_id,
    resumedOperatorReviewId: row.resumed_operator_review_id,
    activePlaybookEntryIds: parseStringArray(row.active_playbook_entry_ids_json),
    recentReflectionIds: parseStringArray(row.recent_reflection_ids_json),
    recentEvaluationIds: parseStringArray(row.recent_evaluation_ids_json),
    recentContractAuditIds: parseStringArray(row.recent_contract_audit_ids_json),
    createdAt: row.created_at,
  };
}

function rowToAgentRecommendation(row: AgentRecommendationRow): AgentRecommendation {
  return {
    id: row.id,
    runId: row.run_id,
    listingId: row.listing_id,
    priority: row.priority,
    actionType: row.action_type,
    title: row.title,
    rationale: row.rationale,
    evidence: parseRecommendationEvidence(row.evidence_json),
    proposedStatus: row.proposed_status,
    status: row.status,
    createdAt: row.created_at,
  };
}

function rowToAgentOperatorReview(row: AgentOperatorReviewRow): AgentOperatorReview {
  return {
    id: row.id,
    runId: row.run_id,
    listingId: row.listing_id,
    urgency: row.urgency,
    question: row.question,
    options: parseOperatorReviewOptions(row.options_json),
    recommendedOption: row.recommended_option,
    rationale: row.rationale,
    evidence: parseRecommendationEvidence(row.evidence_json),
    blocking: row.blocking === 1,
    selectedOption: row.selected_option,
    operatorNote: row.operator_note,
    resolvedAt: row.resolved_at,
    resumeRunId: row.resume_run_id,
    resumeClaimedAt: row.resume_claimed_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

function rowToAgentReflection(row: AgentReflectionRow): AgentReflection {
  return {
    id: row.id,
    runId: row.run_id,
    score: row.score,
    outcome: row.outcome,
    summary: row.summary,
    lessons: parseStringArray(row.lessons_json),
    nextRunGuidance: row.next_run_guidance,
    createdAt: row.created_at,
  };
}

function rowToAgentEpisodeEvaluation(row: AgentEpisodeEvaluationRow): AgentEpisodeEvaluation {
  return {
    id: row.id,
    runId: row.run_id,
    overallScore: row.overall_score,
    verdict: row.verdict,
    objectiveAlignment: row.objective_alignment,
    evidenceGrounding: row.evidence_grounding,
    toolDiscipline: row.tool_discipline,
    safetyDiscipline: row.safety_discipline,
    operatorValue: row.operator_value,
    learningQuality: row.learning_quality,
    findings: parseStringArray(row.findings_json),
    nextExperiment: row.next_experiment,
    createdAt: row.created_at,
  };
}

function rowToAgentExperiment(row: AgentExperimentRow): AgentExperiment {
  return {
    id: row.id,
    sourceRunId: row.source_run_id,
    description: row.description,
    status: row.status,
    startedRunId: row.started_run_id,
    completedRunId: row.completed_run_id,
    resultSummary: row.result_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAgentPlaybookEntry(row: AgentPlaybookEntryRow): AgentPlaybookEntry {
  return {
    id: row.id,
    sourceRunId: row.source_run_id,
    kind: row.kind,
    instruction: row.instruction,
    rationale: row.rationale,
    status: row.status,
    createdAt: row.created_at,
  };
}

function rowToAgentContractAudit(row: AgentContractAuditRow): AgentContractAudit {
  return {
    id: row.id,
    runId: row.run_id,
    status: row.status,
    score: row.score,
    checks: parseContractChecks(row.checks_json),
    createdAt: row.created_at,
  };
}

function rowToAgentGuardrailEvent(row: AgentGuardrailEventRow): AgentGuardrailEvent {
  return {
    id: row.id,
    runId: row.run_id,
    stepIndex: row.step_index,
    toolName: row.tool_name,
    decision: row.decision,
    reason: row.reason,
    inputJson: row.input_json,
    effectiveInputJson: row.effective_input_json,
    createdAt: row.created_at,
  };
}

function rowToAgentWorkingMemory(row: AgentWorkingMemoryRow): AgentWorkingMemory {
  return {
    id: row.id,
    runId: row.run_id,
    revision: row.revision,
    focus: row.focus,
    hypotheses: parseStringArray(row.hypotheses_json),
    nextActions: parseStringArray(row.next_actions_json),
    openQuestions: parseStringArray(row.open_questions_json),
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

function rowToAgentRunPlan(row: AgentRunPlanRow): AgentRunPlan {
  return {
    id: row.id,
    runId: row.run_id,
    objective: row.objective,
    successCriteria: parseStringArray(row.success_criteria_json),
    plannedSteps: parseStringArray(row.planned_steps_json),
    stopConditions: parseStringArray(row.stop_conditions_json),
    riskChecks: parseStringArray(row.risk_checks_json),
    confidence: row.confidence,
    createdAt: row.created_at,
  };
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function averageScores(values: number[]) {
  const clamped = values.map(clampScore);
  return clampScore(clamped.reduce((sum, value) => sum + value, 0) / clamped.length);
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function nextWorkingMemoryRevision(runId: string) {
  const row = sqlite
    .prepare("SELECT MAX(revision) AS revision FROM agent_working_memory WHERE run_id = ?")
    .get(runId) as { revision: number | null } | undefined;

  return (row?.revision ?? 0) + 1;
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseContractChecks(value: string): AgentContractCheck[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!isRecord(item) || typeof item.id !== "string" || typeof item.label !== "string" || typeof item.detail !== "string") {
        return [];
      }

      const status = item.status === "pass" || item.status === "warn" || item.status === "fail" ? item.status : null;
      if (!status) {
        return [];
      }

      return [{
        id: item.id,
        label: item.label,
        status,
        detail: item.detail,
      }];
    });
  } catch {
    return [];
  }
}

function parseRecommendationEvidence(value: string): AgentRecommendationEvidence[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!isRecord(item) || typeof item.ref !== "string" || typeof item.detail !== "string") {
        return [];
      }

      const kind = recommendationEvidenceKind(item.kind);
      if (!kind) {
        return [];
      }

      return [{
        kind,
        ref: item.ref,
        detail: item.detail,
      }];
    });
  } catch {
    return [];
  }
}

function parseOperatorReviewOptions(value: string): AgentOperatorReviewOption[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!isRecord(item) || typeof item.label !== "string" || typeof item.description !== "string") {
        return [];
      }

      return [{
        label: item.label,
        description: item.description,
      }];
    });
  } catch {
    return [];
  }
}

function recommendationEvidenceKind(value: unknown): AgentRecommendationEvidenceKind | null {
  return value === "listing"
    || value === "score"
    || value === "commute"
    || value === "notification"
    || value === "source_event"
    || value === "failure"
    || value === "working_memory"
    || value === "operator_constraint"
    || value === "model_observation"
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}
