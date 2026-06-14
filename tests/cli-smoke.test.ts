import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cwd = process.cwd();
let testWorkspace = "";

beforeEach(() => {
  vi.resetModules();
  testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-cli-"));
  process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "radar.sqlite");
  process.env.NYC_APT_RADAR_PREFERENCES_PATH = path.join(testWorkspace, "preferences.json");
  process.env.NYC_APT_RADAR_SEARCHES_PATH = path.join(testWorkspace, "searches.json");
  writePreferences();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NYC_APT_RADAR_DATABASE_PATH;
  delete process.env.NYC_APT_RADAR_PREFERENCES_PATH;
  delete process.env.NYC_APT_RADAR_SEARCHES_PATH;
});

describe("operator CLI smoke cases", () => {
  it("shows the one-shot agent command options", () => {
    const result = runTs(["scripts/loop-once.ts", "--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: npm run agent:run -- [options]");
    expect(result.stdout).toContain("--no-notify");
  });

  it("prints listing IDs, rankings, and recommendation handoff in radar output", async () => {
    await seedListing();

    const output = runTsx(["scripts/radar-cli.ts"]);

    expect(output).toContain("ID: cli-listing");
    expect(output).toContain("Next:");
    expect(output).toContain("Review agent recommendations: npm run agent:recommendations");
  });

  it("answers structured operator review handoffs from the terminal", async () => {
    const review = await seedOperatorReview();

    const result = runTs([
      "scripts/operator-review.ts",
      "--id",
      review.id,
      "--answer",
      "Keep active",
      "--note",
      "Fee uncertainty is acceptable for this lead.",
    ]);
    const { getAgentOperatorReview } = await import("../src/storage/agent.js");
    const answered = getAgentOperatorReview(review.id);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Answered operator review: ${review.id}`);
    expect(result.stdout).toContain("Selected option: Keep active");
    expect(result.stdout).toContain("resumes this review");
    expect(answered?.status).toBe("answered");
    expect(answered?.selectedOption).toBe("Keep active");
    expect(answered?.operatorNote).toContain("Fee uncertainty");
    expect(answered?.resolvedAt).toBeTruthy();
  });

  it("verifies persisted agent-loop evidence from the terminal", async () => {
    const empty = runTs(["scripts/agent-verify.ts"]);
    expect(empty.status).toBe(1);
    expect(empty.stdout).toContain("needs evidence");
    expect(empty.stdout).toContain("No completed OpenAI agent run");

    const run = await seedVerifiedAgentRun();
    const verified = runTs(["scripts/agent-verify.ts"]);

    expect(verified.status).toBe(0);
    expect(verified.stdout).toContain("agent-loop verification: verified");
    expect(verified.stdout).toContain(`Run: ${run.id}`);
    expect(verified.stdout).toContain("PASS contract audit");
    expect(verified.stdout).toContain("PASS run context");
    expect(verified.stdout).toContain("PASS adaptive loop");
    expect(verified.stdout).toContain("PASS playbook learning");
    expect(verified.stdout).toContain("PASS experiment loop");
  });

  it("prints the persisted model/tool/result timeline from the terminal", async () => {
    const run = await seedVerifiedAgentRun();
    const result = runTs(["scripts/agent-trace.ts", "--run", run.id]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("NYC Apt Radar agent trace");
    expect(result.stdout).toContain(`COMPLETED openai ${run.id}`);
    expect(result.stdout).toContain("Timeline");
    expect(result.stdout).toContain("tool call get_radar_state [allowed]");
    expect(result.stdout).toContain("intent: Observe state before acting.");
    expect(result.stdout).toContain("tool result get_radar_state: ok");
    expect(result.stdout).toContain("Contract audit: 100/100 pass");
    expect(result.stdout).toContain("Episode evaluation: 92/100 strong");
    expect(result.stdout).toContain("Next experiment: Use verifier before claiming the loop is proven.");
  });
});

async function seedListing() {
  const [{ upsertListing }, { defaultPreferenceProfile }] = await Promise.all([
    import("../src/storage/listings.js"),
    import("../src/core/preferences.js"),
  ]);

  upsertListing({
      id: "cli-listing",
      source: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/example/4b",
      title: "CLI Chelsea Lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      borough: "Manhattan",
      rent: 3700,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.7502,
      longitude: -73.9970,
    }, defaultPreferenceProfile);
}

async function seedOperatorReview() {
  const { recordAgentOperatorReview, startAgentRun } = await import("../src/storage/agent.js");
  const run = startAgentRun({
    objective: "Seed operator review",
    mode: "openai",
    model: "test-model",
  });

  return recordAgentOperatorReview({
    runId: run.id,
    listingId: null,
    urgency: "high",
    question: "Should this strong but fee-unknown lead stay active?",
    options: [
      {
        label: "Keep active",
        description: "Keep it in the active follow-up set.",
      },
      {
        label: "Reject for now",
        description: "Defer until fee status is clearer.",
      },
    ],
    recommendedOption: "Keep active",
    rationale: "The agent needs human fee tolerance before deciding the next action.",
    evidence: [{
      kind: "operator_constraint",
      ref: "fee-tolerance",
      detail: "Fee tolerance is subjective and requires operator feedback.",
    }],
    blocking: true,
  });
}

async function seedVerifiedAgentRun() {
  const {
    finishAgentRun,
    recordAgentContractAudit,
    recordAgentEvaluation,
    recordAgentExperiment,
    recordAgentGuardrailEvent,
    recordAgentPlaybookEntry,
    recordAgentReflection,
    recordAgentRunContext,
    recordAgentStep,
    startAgentRun,
  } = await import("../src/storage/agent.js");

  const run = startAgentRun({
    objective: "Verified agent loop seed",
    mode: "openai",
    model: "gpt-5.5",
  });
  recordAgentRunContext({
    runId: run.id,
    objective: run.objective,
    notificationMode: "dry-run",
    maxIterations: 1,
    activeExperimentId: null,
    resumedOperatorReviewId: null,
    activePlaybookEntryIds: [],
    recentReflectionIds: [],
    recentEvaluationIds: [],
    recentContractAuditIds: [],
  });
  recordAgentStep({
    runId: run.id,
    stepIndex: 1,
    kind: "model_response",
    input: { iteration: 1 },
    output: { output: "tool call" },
  });
  recordAgentGuardrailEvent({
    runId: run.id,
    stepIndex: 2,
    toolName: "get_radar_state",
    decision: "allowed",
    reason: "Tool call is within the configured runtime policy.",
    input: { intent: "Observe state before acting.", limit: 5 },
    effectiveInput: { intent: "Observe state before acting.", limit: 5 },
  });
  recordAgentStep({
    runId: run.id,
    stepIndex: 2,
    kind: "tool_call",
    toolName: "get_radar_state",
    input: { intent: "Observe state before acting.", limit: 5 },
    output: { guardrail: { decision: "allowed" } },
  });
  recordAgentStep({
    runId: run.id,
    stepIndex: 3,
    kind: "tool_result",
    toolName: "get_radar_state",
    input: { intent: "Observe state before acting.", limit: 5 },
    output: { ok: true, data: { counts: { listings: 0 } } },
  });
  recordAgentStep({
    runId: run.id,
    stepIndex: 4,
    kind: "final",
    input: null,
    output: { summary: "Verified seed run stopped." },
  });
  const finished = finishAgentRun(run.id, {
    status: "completed",
    iterations: 1,
    summary: "Verified seed run stopped.",
  }) ?? run;
  recordAgentEvaluation({
    runId: run.id,
    verdict: "strong",
    objectiveAlignment: 90,
    evidenceGrounding: 90,
    toolDiscipline: 90,
    safetyDiscipline: 100,
    operatorValue: 85,
    learningQuality: 95,
    findings: ["Seed run has all verifier artifacts."],
    nextExperiment: "Use verifier before claiming the loop is proven.",
  });
  recordAgentReflection({
    runId: run.id,
    score: 92,
    outcome: "useful",
    summary: "Seed run proves verifier wiring.",
    lessons: ["Keep the verifier green before handoff."],
    nextRunGuidance: "Check agent-loop evidence before expanding behavior.",
  });
  recordAgentPlaybookEntry({
    sourceRunId: run.id,
    kind: "policy",
    instruction: "Run agent-loop verification before claiming the loop contract is satisfied.",
    rationale: "Verifier requires persisted evidence for trace, guardrails, audit, evaluation, reflection, playbook, and experiment loop.",
  });
  recordAgentExperiment({
    sourceRunId: run.id,
    description: "Use verifier before claiming the loop is proven.",
  });
  recordAgentContractAudit({
    runId: run.id,
    status: "pass",
    score: 100,
    checks: [{
      id: "run_context",
      label: "Run context",
      status: "pass",
      detail: "Seed run recorded initial context.",
    }, {
      id: "loop_causality",
      label: "Loop causality",
      status: "pass",
      detail: "Seed run includes an adaptive loop causality check.",
    }, {
      id: "playbook_learning",
      label: "Playbook learning",
      status: "pass",
      detail: "Seed run recorded durable directive.",
    }],
  });

  return finished;
}

function writePreferences() {
  fs.writeFileSync(process.env.NYC_APT_RADAR_PREFERENCES_PATH!, JSON.stringify({
    name: "CLI profile",
    commuteTargets: [{
      label: "Bryant Park",
      address: "Bryant Park, New York, NY",
      latitude: 40.7536,
      longitude: -73.9832,
      maxMinutes: 35,
    }],
  }));
}

function runTsx(args: string[]) {
  return execFileSync(process.execPath, ["--import", "tsx", ...args], {
    cwd,
    env: childEnv(),
    encoding: "utf8",
  });
}

function runTs(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", ...args], {
    cwd,
    env: childEnv(),
    encoding: "utf8",
  });
}

function childEnv() {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    VITEST: "true",
    NYC_APT_RADAR_DATABASE_PATH: process.env.NYC_APT_RADAR_DATABASE_PATH!,
    NYC_APT_RADAR_PREFERENCES_PATH: process.env.NYC_APT_RADAR_PREFERENCES_PATH!,
    NYC_APT_RADAR_SEARCHES_PATH: process.env.NYC_APT_RADAR_SEARCHES_PATH!,
  };
  delete env.NYC_APT_RADAR_NTFY_TOPIC;
  return env;
}
