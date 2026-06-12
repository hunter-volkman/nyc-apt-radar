import "../src/config/env";
import { getRadarReadiness } from "../src/diagnostics/readiness";
import { runDiscoveryOnce } from "../src/discovery/agent-loop";

const intervalMinutes = readIntervalMinutes();
const runOnce = process.argv.includes("--once");
const readiness = getRadarReadiness();
const blockingFailures = readiness.checks.filter((check) => check.status === "fail");

console.log(`NYC Apt Radar watch loop running every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}.`);
console.log(`Preflight: ${readiness.ready ? "ready" : "needs attention"} (${readiness.sourceCount} source${readiness.sourceCount === 1 ? "" : "s"}, ${readiness.commuteTargetCount} commute target${readiness.commuteTargetCount === 1 ? "" : "s"}, OpenAI ${readiness.openaiConfigured ? "configured" : "missing"}, ntfy ${readiness.ntfyConfigured ? "configured" : "missing"})`);

if (blockingFailures.length) {
  console.error("Watch preflight failed:");
  for (const check of blockingFailures) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  console.error("Fix the failing checks before starting the unattended loop.");
  process.exit(1);
}

console.log(runOnce ? "Running one discovery cycle." : "Press Ctrl+C to stop.");

void runLoop().catch((error: unknown) => {
  console.error(errorMessage(error));
  process.exit(1);
});

async function runLoop() {
  while (true) {
    await runIteration();
    if (runOnce) {
      break;
    }
    await sleep(intervalMinutes * 60_000);
  }
}

async function runIteration() {
  const startedAt = new Date();

  try {
    const result = await runDiscoveryOnce();
    console.log(
      `${startedAt.toISOString()} checked=${result.sourcesChecked} docs=${result.documentsSeen} duplicates=${result.duplicateDocuments} listings=${result.listingsSaved.length} sent=${result.notificationsSent} failed=${result.notificationsFailed} errors=${result.errors.length}`,
    );

    for (const error of result.errors) {
      console.log(`  error: ${error}`);
    }
  } catch (error) {
    console.error(`${startedAt.toISOString()} loop failed: ${errorMessage(error)}`);
  }
}

function readIntervalMinutes() {
  const value = Number(process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES ?? "10");
  return Number.isFinite(value) && value > 0 ? value : 10;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
