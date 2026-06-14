import {
  getAgentContractAuditForRun,
  getAgentEvaluationForRun,
  getAgentRunContext,
  listAgentExperiments,
  listAgentGuardrailEvents,
  listAgentPlaybookEntriesForRun,
  listAgentReflections,
  listAgentRuns,
  listAgentSteps,
} from "../storage/agent";

export type AgentLoopVerificationStatus = "pass" | "warn" | "fail";

export type AgentLoopVerificationCheck = {
  name: string;
  status: AgentLoopVerificationStatus;
  detail: string;
};

export type AgentLoopVerificationReport = {
  verified: boolean;
  runId: string | null;
  checks: AgentLoopVerificationCheck[];
  nextCommand: string;
};

export function verifyAgentLoopEvidence(): AgentLoopVerificationReport {
  const checks: AgentLoopVerificationCheck[] = [];
  const run = listAgentRuns(20).find((candidate) => candidate.status === "completed") ?? null;

  if (!run) {
    checks.push(fail("completed run", "No completed OpenAI agent run is recorded."));
    return report(null, checks);
  }

  checks.push(run.mode === "openai" && Boolean(run.model)
    ? pass("model supervisor", `Run ${run.id} used ${run.model}.`)
    : fail("model supervisor", `Run ${run.id} is not tied to an OpenAI model supervisor.`));

  const steps = listAgentSteps(run.id);
  const stepKinds = new Set(steps.map((step) => step.kind));
  const toolCallCount = steps.filter((step) => step.kind === "tool_call").length;
  const toolResultCount = steps.filter((step) => step.kind === "tool_result").length;
  checks.push(stepKinds.has("model_response") && stepKinds.has("tool_call") && stepKinds.has("tool_result") && stepKinds.has("final") && toolCallCount === toolResultCount
    ? pass("trace", `${steps.length} step(s); ${toolCallCount} tool call/result pair(s).`)
    : fail("trace", `Trace must include model response, tool calls, tool results, final record, and balanced tool pairs; saw ${steps.length} step(s).`));

  const guardrails = listAgentGuardrailEvents(run.id);
  checks.push(guardrails.length >= toolCallCount && guardrails.length > 0
    ? pass("guardrails", `${guardrails.length} persisted guardrail decision(s).`)
    : fail("guardrails", `Expected guardrail decisions for ${toolCallCount} tool call(s); found ${guardrails.length}.`));

  const audit = getAgentContractAuditForRun(run.id);
  checks.push(audit?.status === "pass"
    ? pass("contract audit", `Contract audit passed at ${audit.score}/100.`)
    : fail("contract audit", audit ? `Contract audit is ${audit.status} at ${audit.score}/100.` : "No contract audit recorded for latest completed run."));
  const runContext = getAgentRunContext(run.id);
  const runContextAudit = audit?.checks.find((check) => check.id === "run_context");
  checks.push(runContext && runContextAudit?.status === "pass"
    ? pass("run context", `${runContextAudit.detail}`)
    : fail("run context", runContextAudit ? runContextAudit.detail : "No persisted initial run context recorded for latest completed run."));
  const causalityCheck = audit?.checks.find((check) => check.id === "loop_causality");
  checks.push(causalityCheck?.status === "pass"
    ? pass("adaptive loop", causalityCheck.detail)
    : fail("adaptive loop", causalityCheck ? causalityCheck.detail : "Contract audit does not include the adaptive loop causality check."));

  const evaluation = getAgentEvaluationForRun(run.id);
  checks.push(evaluation
    ? pass("episode evaluation", `Evaluation ${evaluation.overallScore}/100 ${evaluation.verdict}; next experiment: ${evaluation.nextExperiment}`)
    : fail("episode evaluation", "No structured episode evaluation recorded."));

  const reflection = listAgentReflections(20).find((item) => item.runId === run.id) ?? null;
  checks.push(reflection
    ? pass("reflection", `Reflection ${reflection.score}/100 ${reflection.outcome}; next run: ${reflection.nextRunGuidance}`)
    : fail("reflection", "No compact run reflection recorded."));

  const playbookEntries = listAgentPlaybookEntriesForRun(run.id);
  checks.push(playbookEntries.length
    ? pass("playbook learning", `${playbookEntries.length} durable playbook directive(s) recorded.`)
    : fail("playbook learning", "No durable playbook directive recorded for this run."));

  const experiments = listAgentExperiments(50);
  const queuedExperiment = experiments.find((experiment) => experiment.sourceRunId === run.id);
  const completedExperiment = experiments.find((experiment) => experiment.completedRunId === run.id);
  checks.push(queuedExperiment || completedExperiment
    ? pass("experiment loop", queuedExperiment
      ? `Queued next experiment: ${queuedExperiment.description}`
      : `Completed active experiment: ${completedExperiment?.resultSummary ?? completedExperiment?.status}`)
    : fail("experiment loop", "Run neither queued a next experiment nor completed an active experiment."));

  return report(run.id, checks);
}

function report(runId: string | null, checks: AgentLoopVerificationCheck[]): AgentLoopVerificationReport {
  const verified = checks.every((check) => check.status !== "fail");
  return {
    verified,
    runId,
    checks,
    nextCommand: verified ? "npm run agent:recommendations" : "npm run agent:dry-run",
  };
}

function pass(name: string, detail: string): AgentLoopVerificationCheck {
  return { name, status: "pass", detail };
}

function fail(name: string, detail: string): AgentLoopVerificationCheck {
  return { name, status: "fail", detail };
}
