import "../src/config/env";
import {
  getAgentContractAuditForRun,
  getAgentEvaluationForRun,
  getLatestAgentRunPlan,
  getLatestAgentWorkingMemory,
  getAgentRunContext,
  listActiveAgentPlaybookEntries,
  listAgentGuardrailEvents,
  listAgentExperiments,
  listAgentOperatorReviews,
  listAgentRecommendations,
  listAgentReflections,
  listAgentRuns,
  listAgentSteps,
} from "../src/storage/agent";

const runs = listAgentRuns(5);
const recommendations = listAgentRecommendations(20);
const operatorReviews = listAgentOperatorReviews(20);
const reflections = listAgentReflections(5);
const experiments = listAgentExperiments(10);
const activePlaybook = listActiveAgentPlaybookEntries(12);

if (!runs.length) {
  console.log("No agent runs recorded yet.");
  console.log("Run: npm run agent:run -- --no-notify");
  process.exit(0);
}

console.log("NYC Apt Radar agent runs");
console.log("");

for (const run of runs) {
  const steps = listAgentSteps(run.id);
  const guardrails = listAgentGuardrailEvents(run.id);
  const plan = getLatestAgentRunPlan(run.id);
  const memory = getLatestAgentWorkingMemory(run.id);
  const runContext = getAgentRunContext(run.id);
  const contractAudit = getAgentContractAuditForRun(run.id);
  const evaluation = getAgentEvaluationForRun(run.id);
  const reflection = reflections.find((item) => item.runId === run.id);
  console.log(`${run.status.toUpperCase()} ${run.mode} ${run.id}`);
  console.log(`    Started: ${formatDateTime(run.startedAt)}`);
  if (run.completedAt) {
    console.log(`    Completed: ${formatDateTime(run.completedAt)}`);
  }
  if (run.model) {
    console.log(`    Model: ${run.model}`);
  }
  console.log(`    Iterations: ${run.iterations}; steps: ${steps.length}`);
  if (run.summary) {
    console.log(`    Summary: ${run.summary}`);
  }
  if (plan) {
    console.log(`    Plan: ${plan.objective}`);
    console.log(`    Success: ${plan.successCriteria.join("; ")}`);
  }
  if (memory) {
    console.log(`    Working memory: r${memory.revision} ${memory.focus}`);
    console.log(`    Confidence: ${Math.round(memory.confidence * 100)}%`);
  }
  if (runContext) {
    console.log(`    Start context: ${runContext.activePlaybookEntryIds.length} playbook; ${runContext.recentReflectionIds.length} reflection; ${runContext.recentEvaluationIds.length} evaluation; ${runContext.recentContractAuditIds.length} audit input(s)`);
    if (runContext.activeExperimentId) {
      console.log(`    Started with experiment: ${runContext.activeExperimentId}`);
    }
    if (runContext.resumedOperatorReviewId) {
      console.log(`    Resumed review: ${runContext.resumedOperatorReviewId}`);
    }
  }
  if (contractAudit) {
    console.log(`    Contract audit: ${contractAudit.score}/100 ${contractAudit.status}`);
    const nonPassing = contractAudit.checks.filter((check) => check.status !== "pass");
    if (nonPassing.length) {
      console.log(`    Audit notes: ${nonPassing.map((check) => `${check.status}:${check.label}`).join(", ")}`);
    }
  }
  if (evaluation) {
    console.log(`    Evaluation: ${evaluation.overallScore}/100 ${evaluation.verdict}`);
    console.log(`    Next experiment: ${evaluation.nextExperiment}`);
  }
  const activeExperiment = experiments.find((item) => item.startedRunId === run.id);
  const queuedExperiment = experiments.find((item) => item.sourceRunId === run.id);
  if (activeExperiment) {
    console.log(`    Active experiment: ${activeExperiment.status} ${activeExperiment.description}`);
    if (activeExperiment.resultSummary) {
      console.log(`    Experiment result: ${activeExperiment.resultSummary}`);
    }
  }
  if (queuedExperiment) {
    console.log(`    Queued experiment: ${queuedExperiment.description}`);
  }
  if (reflection) {
    console.log(`    Reflection: ${reflection.score}/100 ${reflection.outcome}`);
    console.log(`    Next run: ${reflection.nextRunGuidance}`);
  }
  if (guardrails.length) {
    console.log(`    Guardrails: ${guardrailSummary(guardrails)}`);
  }
  if (run.errorMessage) {
    console.log(`    Error: ${run.errorMessage}`);
  }
  console.log("");
}

function guardrailSummary(events: Array<{ decision: string }>) {
  const counts = events.reduce<Record<string, number>>((result, event) => {
    result[event.decision] = (result[event.decision] ?? 0) + 1;
    return result;
  }, {});

  return `${counts.allowed ?? 0} allowed, ${counts.rewritten ?? 0} rewritten, ${counts.blocked ?? 0} blocked`;
}

if (activePlaybook.length) {
  console.log("Active playbook");
  console.log("");

  for (const entry of activePlaybook) {
    console.log(`${entry.kind.toUpperCase()}: ${entry.instruction}`);
    console.log(`    ${entry.rationale}`);
    console.log(`    Source run: ${entry.sourceRunId}`);
    console.log("");
  }
}

if (!operatorReviews.length && !recommendations.length && !activePlaybook.length) {
  console.log("No agent recommendations, operator review requests, or playbook entries recorded yet.");
  process.exit(0);
}

const openReviews = operatorReviews.filter((item) => item.status === "open");
if (openReviews.length) {
  console.log("Open operator reviews");
  console.log("");

  for (const review of openReviews) {
    console.log(`${review.urgency.toUpperCase()} ${review.blocking ? "BLOCKING" : "REVIEW"}: ${review.question}`);
    if (review.listingId) {
      console.log(`    Listing: ${review.listingId}`);
    }
    console.log(`    Recommended: ${review.recommendedOption}`);
    for (const option of review.options) {
      console.log(`    Option: ${option.label} - ${option.description}`);
    }
    console.log(`    ${review.rationale}`);
    for (const evidence of review.evidence.slice(0, 4)) {
      console.log(`    Evidence: ${evidence.kind} ${evidence.ref} - ${evidence.detail}`);
    }
    console.log(`    Run: ${review.runId}`);
    console.log(`    Answer: npm run agent:review -- --id ${review.id} --answer "${review.recommendedOption}"`);
    console.log("");
  }
}

const resumableReviews = operatorReviews.filter((item) => item.blocking && item.status !== "open" && !item.resumeRunId);
if (resumableReviews.length) {
  console.log("Resolved operator reviews ready to resume");
  console.log("");

  for (const review of resumableReviews) {
    console.log(`${review.status.toUpperCase()} ${review.question}`);
    if (review.listingId) {
      console.log(`    Listing: ${review.listingId}`);
    }
    if (review.selectedOption) {
      console.log(`    Selected: ${review.selectedOption}`);
    }
    if (review.operatorNote) {
      console.log(`    Note: ${review.operatorNote}`);
    }
    console.log(`    Source run: ${review.runId}`);
    console.log("    Next: npm run agent:dry-run");
    console.log("");
  }
}

if (!recommendations.filter((item) => item.status === "open").length) {
  process.exit(0);
}

console.log("Open recommendations");
console.log("");

for (const recommendation of recommendations.filter((item) => item.status === "open")) {
  console.log(`${recommendation.priority.toUpperCase()} ${recommendation.actionType}: ${recommendation.title}`);
  if (recommendation.listingId) {
    console.log(`    Listing: ${recommendation.listingId}`);
  }
  if (recommendation.proposedStatus) {
    console.log(`    Proposed status: ${recommendation.proposedStatus}`);
  }
  console.log(`    ${recommendation.rationale}`);
  for (const evidence of recommendation.evidence.slice(0, 4)) {
    console.log(`    Evidence: ${evidence.kind} ${evidence.ref} - ${evidence.detail}`);
  }
  console.log(`    Run: ${recommendation.runId}`);
  console.log("");
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
