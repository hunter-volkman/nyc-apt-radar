import type {
  AgentContractAudit,
  AgentEpisodeEvaluation,
  AgentExperiment,
  AgentOperatorReview,
  AgentPlaybookEntry,
  AgentReflection,
} from "../storage/agent";

type AgentNotificationMode = "send" | "dry-run" | "off";

export function agentInstructions() {
  return [
    "You are the autonomous supervisor for NYC Apt Radar, a private NYC apartment discovery system.",
    "Your job is not to parse data. Your job is to control a bounded loop: observe local state, choose tools with explicit intent, use tool results as ground truth, record high-signal recommendations or operator-review requests, and stop when the next operator actions are clear.",
    "Preserve these hard boundaries: no credentialed scraping, no CAPTCHA bypassing, no stealth browser automation, no automatic outreach, no fake listings, no public marketplace behavior, and no sensitive document storage.",
    "Do not invent listing facts. Unknown facts stay unknown until a tool result provides them or the operator updates them.",
    "Prefer a few high-value tool calls over exhaustive exploration. Record recommendations or operator-review requests only when they are backed by listing scores, statuses, failures, commute evidence, notification state, or explicit operator constraints.",
    "Take one tool action per model turn. Wait for the tool result before choosing the next tool.",
    "Use set_episode_plan after the first useful observation to make the objective, success criteria, planned steps, stop conditions, and risk checks explicit.",
    "Use draft_outreach only to create a human-editable draft. The operator sends messages manually.",
    "Use record_recommendation as your safe write path. It never changes listing status; it records what the operator should consider. Every recommendation must include structured evidence copied or summarized from tool outputs.",
    "Use request_operator_review when a decision should pause for human judgment. Ask one precise question, include bounded options, recommend one option, cite structured evidence, and stop if the review is blocking.",
    "If the first prompt says this run is resuming after an operator review, treat that answer or dismissal as current environment feedback before choosing fresh discovery.",
    "If the first prompt includes an active improvement experiment, operationalize it in the episode plan or working memory so the run actually tests it.",
    "Runtime guardrails may allow, rewrite, or block tool calls. Treat guardrail feedback as environment feedback and adapt the next call.",
    "After each meaningful observation or listing inspection, use update_working_memory before recording recommendations or operator-review requests.",
    "Use update_working_memory to externalize your current focus, hypotheses, next actions, open questions, and confidence as the run evolves.",
    "Stop with a structured stop_agent decision when success criteria are satisfied, no useful action remains, or the loop is blocked by source/notification failures.",
  ].join("\n");
}

export function reflectionInstructions() {
  return [
    "You are the episode evaluator for NYC Apt Radar.",
    "Evaluate the just-finished agent episode using only the provided trace summary.",
    "Call record_episode_evaluation exactly once with objective-aligned metric scores and the compact reflection.",
    "Each metric is an integer 0-100. verdict is one of strong, useful, weak, unsafe, failed.",
    "Findings are 1-5 short evidence-grounded observations. nextExperiment is one concrete next loop improvement.",
    "If an activeExperiment is provided, judge whether this episode succeeded, failed, or skipped it. If none is provided, use not_applicable.",
    "playbookUpdates are durable directives future supervisor runs should obey; avoid vague praise and write operational guidance.",
    "Reflection lessons are 1-4 short strings that should improve the next run's tool choices.",
  ].join("\n");
}

export function reflectionToolDefinitions() {
  return [{
    type: "function",
    name: "record_episode_evaluation",
    description: "Persist the critic's structured metric evaluation and compact reflection for the completed agent episode.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        verdict: {
          type: "string",
          enum: ["strong", "useful", "weak", "unsafe", "failed"],
          description: "Overall verdict for the episode.",
        },
        objectiveAlignment: metricProperty("How well the run pursued the stated apartment discovery objective instead of side paths."),
        evidenceGrounding: metricProperty("How strongly recommendations and conclusions were backed by local tool outputs."),
        toolDiscipline: metricProperty("How well the model chose minimal, ordered, useful tool calls and stopped appropriately."),
        safetyDiscipline: metricProperty("How well the run respected policy, source, notification, and outreach boundaries."),
        operatorValue: metricProperty("How actionable the run was for the local operator."),
        learningQuality: metricProperty("How useful the produced memory/reflection is for improving future runs."),
        findings: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 5,
          description: "Evidence-grounded observations about the episode.",
        },
        nextExperiment: {
          type: "string",
          description: "One concrete next loop improvement to try.",
        },
        playbookUpdates: {
          type: "array",
          minItems: 1,
          maxItems: 5,
          description: "Durable next-run directives distilled from this episode's evidence.",
          items: {
            type: "object",
            properties: {
              kind: {
                type: "string",
                enum: ["policy", "heuristic", "anti_pattern", "operator_preference"],
                description: "Type of durable guidance.",
              },
              instruction: {
                type: "string",
                description: "Concise directive future runs should follow.",
              },
              rationale: {
                type: "string",
                description: "Evidence-grounded reason this directive belongs in the playbook.",
              },
            },
            required: ["kind", "instruction", "rationale"],
            additionalProperties: false,
          },
        },
        experimentResult: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["succeeded", "failed", "skipped", "not_applicable"],
              description: "Result of the active improvement experiment, or not_applicable when there was no active experiment.",
            },
            summary: {
              type: "string",
              description: "Short evidence-grounded judgment of the active experiment result.",
            },
          },
          required: ["status", "summary"],
          additionalProperties: false,
        },
        reflection: {
          type: "object",
          properties: {
            score: metricProperty("Overall usefulness and discipline score for the run."),
            outcome: {
              type: "string",
              enum: ["useful", "blocked", "no_signal", "unsafe", "failed"],
              description: "Outcome classification for the run.",
            },
            summary: {
              type: "string",
              description: "Short evidence-grounded summary of what happened.",
            },
            lessons: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 4,
              description: "Lessons that should improve the next run.",
            },
            nextRunGuidance: {
              type: "string",
              description: "One concrete instruction to feed into the next run.",
            },
          },
          required: ["score", "outcome", "summary", "lessons", "nextRunGuidance"],
          additionalProperties: false,
        },
      },
      required: [
        "verdict",
        "objectiveAlignment",
        "evidenceGrounding",
        "toolDiscipline",
        "safetyDiscipline",
        "operatorValue",
        "learningQuality",
        "findings",
        "nextExperiment",
        "playbookUpdates",
        "experimentResult",
        "reflection",
      ],
      additionalProperties: false,
    },
  }];
}

export function initialUserMessage(
  objective: string,
  notificationMode: AgentNotificationMode,
  maxIterations: number,
  activeExperiment: AgentExperiment | null,
  resumedOperatorReview: AgentOperatorReview | null,
  recentContractAudits: AgentContractAudit[],
  recentReflections: AgentReflection[],
  recentEvaluations: AgentEpisodeEvaluation[],
  activePlaybookEntries: AgentPlaybookEntry[],
) {
  return {
    role: "user",
    content: [{
      type: "input_text",
      text: [
        `Objective: ${objective}`,
        `Notification mode requested by runtime: ${notificationMode}.`,
        `Maximum iterations: ${maxIterations}.`,
        activeExperiment
          ? `Active improvement experiment: ${JSON.stringify({
            id: activeExperiment.id,
            description: activeExperiment.description,
            sourceRunId: activeExperiment.sourceRunId,
          })}`
          : "Active improvement experiment: none yet.",
        resumedOperatorReview
          ? `Resuming after operator review: ${JSON.stringify(operatorReviewForPrompt(resumedOperatorReview))}`
          : "Resuming after operator review: none.",
        activePlaybookEntries.length
          ? `Active playbook directives: ${JSON.stringify(activePlaybookEntries.map((entry) => ({
            kind: entry.kind,
            instruction: entry.instruction,
            rationale: entry.rationale,
            sourceRunId: entry.sourceRunId,
          })))}`
          : "Active playbook directives: none yet.",
        recentReflections.length
          ? `Recent run lessons: ${JSON.stringify(recentReflections.map((reflection) => ({
            score: reflection.score,
            outcome: reflection.outcome,
            lessons: reflection.lessons,
            nextRunGuidance: reflection.nextRunGuidance,
          })))}`
          : "Recent run lessons: none yet.",
        recentContractAudits.length
          ? `Recent contract audits: ${JSON.stringify(recentContractAudits.map((audit) => ({
            score: audit.score,
            status: audit.status,
            notes: audit.checks
              .filter((check) => check.status !== "pass")
              .map((check) => `${check.status}:${check.label}: ${check.detail}`)
              .slice(0, 4),
          })))}`
          : "Recent contract audits: none yet.",
        recentEvaluations.length
          ? `Recent episode evaluations: ${JSON.stringify(recentEvaluations.map((evaluation) => ({
            overallScore: evaluation.overallScore,
            verdict: evaluation.verdict,
            metrics: {
              objectiveAlignment: evaluation.objectiveAlignment,
              evidenceGrounding: evaluation.evidenceGrounding,
              toolDiscipline: evaluation.toolDiscipline,
              safetyDiscipline: evaluation.safetyDiscipline,
              operatorValue: evaluation.operatorValue,
              learningQuality: evaluation.learningQuality,
            },
            findings: evaluation.findings,
            nextExperiment: evaluation.nextExperiment,
          })))}`
          : "Recent episode evaluations: none yet.",
        "First gather current radar state or run discovery if it is useful. Then set an episode plan, inspect only the most relevant evidence, and record recommendations or structured operator-review requests for the operator.",
      ].join("\n"),
    }],
  };
}

export function operatorReviewForPrompt(review: AgentOperatorReview) {
  return {
    id: review.id,
    sourceRunId: review.runId,
    listingId: review.listingId,
    status: review.status,
    blocking: review.blocking,
    question: review.question,
    recommendedOption: review.recommendedOption,
    selectedOption: review.selectedOption,
    operatorNote: review.operatorNote,
    resolvedAt: review.resolvedAt,
    evidence: review.evidence,
  };
}

function metricProperty(description: string) {
  return {
    type: "integer",
    minimum: 0,
    maximum: 100,
    description,
  };
}
