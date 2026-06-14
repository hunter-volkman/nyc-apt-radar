import "../src/config/env";
import {
  getAgentContractAuditForRun,
  getAgentEvaluationForRun,
  getAgentRun,
  getAgentRunContext,
  getLatestAgentRunPlan,
  getLatestAgentWorkingMemory,
  listAgentGuardrailEvents,
  listAgentReflections,
  listAgentRuns,
  listAgentSteps,
  type AgentStep,
} from "../src/storage/agent";

type TraceCliOptions = {
  help: boolean;
  runId: string | null;
};

const options = parseOptions(process.argv.slice(2));

if (options.help) {
  console.log(usage());
  process.exit(0);
}

const run = options.runId
  ? getAgentRun(options.runId)
  : listAgentRuns(1)[0] ?? null;

if (!run) {
  console.log(options.runId ? `No agent run found: ${options.runId}` : "No agent runs recorded yet.");
  console.log("Next: npm run agent:dry-run");
  process.exit(options.runId ? 1 : 0);
}

const steps = listAgentSteps(run.id);
const guardrails = listAgentGuardrailEvents(run.id);
const plan = getLatestAgentRunPlan(run.id);
const memory = getLatestAgentWorkingMemory(run.id);
const context = getAgentRunContext(run.id);
const audit = getAgentContractAuditForRun(run.id);
const evaluation = getAgentEvaluationForRun(run.id);
const reflection = listAgentReflections(20).find((item) => item.runId === run.id) ?? null;

console.log("NYC Apt Radar agent trace");
console.log("");
console.log(`${run.status.toUpperCase()} ${run.mode} ${run.id}`);
console.log(`Model: ${run.model ?? "unknown"}`);
console.log(`Objective: ${run.objective}`);
console.log(`Iterations: ${run.iterations}; steps: ${steps.length}`);
if (run.summary) {
  console.log(`Summary: ${run.summary}`);
}
if (run.errorMessage) {
  console.log(`Error: ${run.errorMessage}`);
}
if (context) {
  console.log(`Start context: ${context.notificationMode}; max ${context.maxIterations}; ${context.activePlaybookEntryIds.length} playbook; ${context.recentReflectionIds.length} reflection; ${context.recentEvaluationIds.length} evaluation; ${context.recentContractAuditIds.length} audit input(s)`);
  if (context.activeExperimentId) {
    console.log(`Active experiment at start: ${context.activeExperimentId}`);
  }
  if (context.resumedOperatorReviewId) {
    console.log(`Resumed operator review: ${context.resumedOperatorReviewId}`);
  }
}
if (plan) {
  console.log(`Plan: ${plan.objective}`);
  console.log(`Success criteria: ${plan.successCriteria.join("; ")}`);
  console.log(`Stop conditions: ${plan.stopConditions.join("; ")}`);
}
if (memory) {
  console.log(`Working memory: r${memory.revision} ${memory.focus} (${Math.round(memory.confidence * 100)}% confidence)`);
}

console.log("");
console.log("Timeline");
console.log("");

for (const step of steps) {
  console.log(formatStep(step));
}

if (audit || evaluation || reflection) {
  console.log("");
  console.log("Post-run");
  console.log("");
}

if (audit) {
  console.log(`Contract audit: ${audit.score}/100 ${audit.status}`);
  for (const check of audit.checks.filter((item) => item.status !== "pass")) {
    console.log(`  ${check.status.toUpperCase()} ${check.label}: ${check.detail}`);
  }
}
if (evaluation) {
  console.log(`Episode evaluation: ${evaluation.overallScore}/100 ${evaluation.verdict}`);
  console.log(`Next experiment: ${evaluation.nextExperiment}`);
}
if (reflection) {
  console.log(`Reflection: ${reflection.score}/100 ${reflection.outcome}`);
  console.log(`Next run guidance: ${reflection.nextRunGuidance}`);
}

function formatStep(step: AgentStep) {
  const label = `${String(step.stepIndex).padStart(2, "0")} ${step.kind.replace("_", " ")}`;
  const input = parseJson(step.inputJson);
  const output = parseJson(step.outputJson);

  if (step.kind === "model_response") {
    return `${label}${modelResponseSummary(input, output)}`;
  }

  if (step.kind === "tool_call") {
    const guardrail = guardrails.find((event) => event.stepIndex === step.stepIndex && event.toolName === step.toolName);
    const intent = isRecord(input) && typeof input.intent === "string" ? input.intent : null;
    const suffix = guardrail ? ` [${guardrail.decision}]` : "";
    return [
      `${label} ${step.toolName ?? "unknown"}${suffix}`,
      intent ? `   intent: ${intent}` : null,
      guardrail && guardrail.decision !== "allowed" ? `   guardrail: ${guardrail.reason}` : null,
    ].filter((line): line is string => Boolean(line)).join("\n");
  }

  if (step.kind === "tool_result") {
    return `${label} ${step.toolName ?? "unknown"}: ${toolResultSummary(step.toolName, output)}`;
  }

  if (step.kind === "final") {
    const summary = isRecord(output) && typeof output.summary === "string" ? output.summary : null;
    const error = isRecord(output) && typeof output.error === "string" ? output.error : null;
    return `${label}: ${summary ?? error ?? "recorded"}`;
  }

  return label;
}

function modelResponseSummary(input: unknown, output: unknown) {
  const phase = isRecord(input) && typeof input.phase === "string" ? ` ${input.phase}` : "";
  const iteration = isRecord(input) && typeof input.iteration === "number" ? ` iteration ${input.iteration}` : "";
  const types = isRecord(output) && Array.isArray(output.outputTypes)
    ? output.outputTypes.filter((item): item is string => typeof item === "string")
    : [];
  const text = isRecord(output) && typeof output.text === "string" && output.text.trim()
    ? `; text: ${compact(output.text)}`
    : "";
  const error = isRecord(output) && isRecord(output.error)
    ? "; error recorded"
    : isRecord(output) && typeof output.error === "string"
      ? `; error: ${compact(output.error)}`
      : "";

  return `${phase}${iteration}${types.length ? `; output: ${types.join(", ")}` : ""}${text}${error}`;
}

function toolResultSummary(toolName: string | null, output: unknown) {
  if (!isRecord(output)) {
    return compact(String(output));
  }

  if (output.ok !== true) {
    return `failed${typeof output.error === "string" ? ` - ${compact(output.error)}` : ""}`;
  }

  const data = isRecord(output.data) ? output.data : {};

  if (toolName === "get_radar_state" && isRecord(data.counts)) {
    return `ok - ${countSummary(data.counts)}`;
  }

  if (toolName === "run_discovery_pass") {
    return `ok - searches ${numberField(data.searchesChecked)}, listings ${numberField(data.listingsFound)}, notifications sent/skipped/failed ${numberField(data.notificationsSent)}/${numberField(data.notificationsSkipped)}/${numberField(data.notificationsFailed)}`;
  }

  if (toolName === "inspect_listing" && isRecord(data.listing)) {
    return `ok - ${listingSummary(data.listing)}`;
  }

  if (toolName === "update_working_memory" && isRecord(data.memory)) {
    return `ok - r${numberField(data.memory.revision)} ${stringField(data.memory.focus) ?? "memory recorded"}`;
  }

  if (toolName === "set_episode_plan" && isRecord(data.plan)) {
    return `ok - ${stringField(data.plan.objective) ?? "plan recorded"}`;
  }

  if (toolName === "record_recommendation" && isRecord(data.recommendation)) {
    return `ok - ${stringField(data.recommendation.priority) ?? "priority"} ${stringField(data.recommendation.actionType) ?? "recommendation"}: ${stringField(data.recommendation.title) ?? stringField(data.recommendation.id) ?? "recorded"}`;
  }

  if (toolName === "request_operator_review" && isRecord(data.review)) {
    return `ok - ${stringField(data.review.urgency) ?? "review"}${data.review.blocking === true ? " blocking" : ""}: ${stringField(data.review.question) ?? stringField(data.review.id) ?? "recorded"}`;
  }

  if (toolName === "stop_agent") {
    return `ok - ${stringField(data.outcome) ?? "stopped"}: ${stringField(data.summary) ?? "Agent stopped."}`;
  }

  return `ok - ${Object.keys(data).length ? `data keys ${Object.keys(data).join(", ")}` : "no data"}`;
}

function countSummary(counts: Record<string, unknown>) {
  const parts = [
    `listings ${numberField(counts.listings)}`,
    `open recs ${numberField(counts.openRecommendations)}`,
    `open reviews ${numberField(counts.openOperatorReviews)}`,
  ];
  return parts.join(", ");
}

function listingSummary(listing: Record<string, unknown>) {
  const score = numberField(listing.score);
  const title = stringField(listing.title) ?? stringField(listing.id) ?? "listing";
  const status = stringField(listing.status);
  return `${score}/100 ${title}${status ? ` (${status})` : ""}`;
}

function parseOptions(argv: string[]): TraceCliOptions {
  const options: TraceCliOptions = {
    help: false,
    runId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--run") {
      const runId = argv[index + 1];
      if (!runId) {
        throw new Error("--run requires an agent run id.");
      }
      options.runId = runId;
      index += 1;
      continue;
    }

    throw new Error(`Unknown trace option: ${arg}`);
  }

  return options;
}

function usage() {
  return [
    "Usage: npm run agent:trace -- [options]",
    "",
    "Options:",
    "  --run <id>             Show a specific agent run trace. Defaults to the latest run.",
    "  --help                 Show this help.",
  ].join("\n");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? compact(value) : null;
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
