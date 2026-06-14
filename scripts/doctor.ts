import "../src/config/env";
import path from "node:path";
import { getRadarReadiness, type ReadinessStatus } from "../src/diagnostics/readiness";

const report = getRadarReadiness();

console.log(`NYC Apt Radar doctor: ${report.ready ? "ready" : "needs attention"}`);
console.log(`Database: ${report.databasePath}`);
console.log(`Profile: ${report.profileName ?? "unavailable"}`);
console.log(`Searches: ${report.searchCount}`);
console.log(`Commute targets: ${report.commuteTargetCount}`);
console.log(`ntfy: ${report.ntfyConfigured ? "configured" : "missing"}`);
console.log(`OpenAI supervisor: ${report.openAIConfigured ? "configured" : "missing"}`);
console.log(`Env files: ${formatEnvFiles(report.loadedEnvFiles)}`);
console.log("");

for (const check of report.checks) {
  console.log(`${symbol(check.status)} ${check.name}: ${check.detail}`);
}

console.log("");
console.log(`Next: ${report.nextCommand}`);

process.exit(report.ready ? 0 : 1);

function symbol(status: ReadinessStatus) {
  if (status === "ok") {
    return "OK";
  }

  if (status === "warn") {
    return "WARN";
  }

  return "FAIL";
}

function formatEnvFiles(files: string[]) {
  return files.length
    ? files.map((file) => path.relative(process.cwd(), file)).join(", ")
    : "none";
}
