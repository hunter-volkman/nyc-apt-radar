import "../src/config/env";
import path from "node:path";
import { loadPreferenceProfile } from "../src/core/preferences";
import { getRadarReadiness } from "../src/diagnostics/readiness";
import { runApartmentRadarAgentOnce, type AgentNotificationMode, type AgentRunResult } from "../src/agent/runner";
import { listRankedListings } from "../src/storage/listings";

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

type AgentCliOptions = {
  notificationMode: AgentNotificationMode;
  help: boolean;
};

async function main(argv: string[]) {
  const options = parseOptions(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  const readiness = getRadarReadiness({ requireNtfy: options.notificationMode === "send" });
  const failures = readiness.checks.filter((check) => check.status === "fail");

  console.log(`NYC Apt Radar agent run preflight ${readiness.ready ? "ready" : "needs attention"}`);
  console.log(`StreetEasy searches: ${readiness.searchCount}; commute targets: ${readiness.commuteTargetCount}; database: ${readiness.databasePath}`);
  console.log(`Env files: ${formatEnvFiles(readiness.loadedEnvFiles)}`);

  if (options.notificationMode !== "send") {
    console.log("Live ntfy delivery disabled; notification decisions will be recorded as skipped.");
  }

  console.log("OpenAI supervisor required for the main agent loop.");

  for (const check of readiness.checks.filter((candidate) => candidate.status !== "ok")) {
    console.log(`${check.status.toUpperCase()} ${check.name}: ${check.detail}`);
  }

  if (failures.length) {
    console.error("");
    console.error("Preflight failed:");
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.detail}`);
    }
    console.error(`Next: ${readiness.nextCommand}`);
    process.exit(1);
  }

  const result = await runApartmentRadarAgentOnce({
    notificationMode: options.notificationMode,
  });
  printRunSummary(result);
  printNextSteps(result.run.id);
}

function printRunSummary(result: AgentRunResult) {
  const discovery = result.discoveryResult;
  const profile = loadPreferenceProfile();
  const listings = listRankedListings(profile);

  console.log("");
  console.log("Agent loop summary");
  console.log(`Supervisor mode: ${result.mode}`);
  console.log(`Agent run: ${result.run.id}`);
  console.log(`Agent status: ${result.run.status}`);
  console.log(`Agent iterations: ${result.iterations}`);
  console.log(`Agent tool calls: ${result.toolCalls.length}`);
  console.log(`Guardrails: ${guardrailSummary(result.guardrailEvents)}`);
  console.log(`Episode plan: ${result.episodePlan ? `${result.episodePlan.objective} (${Math.round(result.episodePlan.confidence * 100)}% confidence)` : "not recorded"}`);
  if (result.episodePlan?.successCriteria.length) {
    console.log(`Success criteria: ${result.episodePlan.successCriteria.join("; ")}`);
  }
  console.log(`Working memory: ${result.workingMemory ? `r${result.workingMemory.revision} ${result.workingMemory.focus}` : "not recorded"}`);
  console.log(`Recommendations recorded: ${result.recommendationsRecorded}`);
  console.log(`Operator reviews recorded: ${result.operatorReviewsRecorded}`);
  console.log(`Playbook entries recorded: ${result.playbookEntriesRecorded}`);
  console.log(`Active playbook entries at start: ${result.activePlaybookEntries.length}`);
  console.log(`Run context: ${result.runContext ? `${result.runContext.activePlaybookEntryIds.length} playbook; ${result.runContext.recentReflectionIds.length} reflection; ${result.runContext.recentEvaluationIds.length} evaluation; ${result.runContext.recentContractAuditIds.length} audit input(s)` : "not recorded"}`);
  console.log(`Contract audit: ${result.contractAudit ? `${result.contractAudit.score}/100 ${result.contractAudit.status}` : "not recorded"}`);
  console.log(`Episode evaluation: ${result.evaluation ? `${result.evaluation.overallScore}/100 ${result.evaluation.verdict}` : "not recorded"}`);
  console.log(`Reflection: ${result.reflection ? `${result.reflection.score}/100 ${result.reflection.outcome}` : "not recorded"}`);
  console.log(`Active experiment: ${result.activeExperiment ? result.activeExperiment.description : "none"}`);
  console.log(`Resumed operator review: ${result.resumedOperatorReview ? `${result.resumedOperatorReview.id} (${result.resumedOperatorReview.status})` : "none"}`);
  console.log(`Experiment result: ${result.completedExperiment ? `${result.completedExperiment.status} - ${result.completedExperiment.resultSummary}` : "not recorded"}`);
  console.log(`Queued experiment: ${result.queuedExperiment ? result.queuedExperiment.description : "not recorded"}`);
  console.log(`StreetEasy searches checked: ${discovery?.searchesChecked ?? 0}`);
  console.log(`Documents seen: ${discovery?.documentsSeen ?? 0}`);
  console.log(`Duplicate documents: ${discovery?.duplicateDocuments ?? 0}`);
  console.log(`Listings found: ${discovery?.listingsFound ?? 0}`);
  console.log(`Ranked listings: ${listings.length}`);
  console.log(`Notifications sent: ${discovery?.notificationsSent ?? 0}`);
  console.log(`Notifications skipped: ${discovery?.notificationsSkipped ?? 0}`);
  console.log(`Notifications failed: ${discovery?.notificationsFailed ?? 0}`);

  if (listings[0]) {
    console.log(`Top listing: ${listings[0].score}/100 ${listings[0].title}`);
  }

  if (result.summary) {
    console.log(`Supervisor summary: ${result.summary}`);
  }

  if (result.reflection) {
    console.log(`Next-run guidance: ${result.reflection.nextRunGuidance}`);
  }

  if (result.evaluation) {
    console.log(`Next experiment: ${result.evaluation.nextExperiment}`);
  }

  if (result.contractAudit) {
    const nonPassing = result.contractAudit.checks.filter((check) => check.status !== "pass");
    if (nonPassing.length) {
      console.log("");
      console.log("Contract audit notes:");
      for (const check of nonPassing) {
        console.log(`- ${check.status.toUpperCase()} ${check.label}: ${check.detail}`);
      }
    }
  }

  if (discovery?.errors.length) {
    console.log("");
    console.log("Recorded issues:");
    for (const error of discovery.errors) {
      console.log(`- ${error}`);
    }
  }

  console.log("");
}

function printNextSteps(runId: string) {
  console.log("Next: npm run radar");
  console.log("      npm run agent:recommendations");
  console.log(`      npm run agent:trace -- --run ${runId}`);
  console.log("      npm run agent:verify");
}

function guardrailSummary(events: Array<{ decision: string }>) {
  const counts = events.reduce<Record<string, number>>((result, event) => {
    result[event.decision] = (result[event.decision] ?? 0) + 1;
    return result;
  }, {});

  return `${counts.allowed ?? 0} allowed, ${counts.rewritten ?? 0} rewritten, ${counts.blocked ?? 0} blocked`;
}

function parseOptions(argv: string[]): AgentCliOptions {
  const parsed: AgentCliOptions = {
    notificationMode: "send",
    help: false,
  };

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }

    if (arg === "--no-notify" || arg === "--dry-run") {
      parsed.notificationMode = "dry-run";
      continue;
    }

    throw new Error(`Unknown agent option: ${arg}`);
  }

  return parsed;
}

function usage() {
  return [
    "Usage: npm run agent:run -- [options]",
    "",
    "Options:",
    "  --no-notify            Run in dry-run notification mode.",
    "  --help                 Show this help.",
  ].join("\n");
}

function formatEnvFiles(files: string[]) {
  return files.length
    ? files.map((file) => path.relative(process.cwd(), file)).join(", ")
    : "none";
}
