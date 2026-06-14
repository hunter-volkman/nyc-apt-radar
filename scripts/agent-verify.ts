import "../src/config/env";
import { verifyAgentLoopEvidence, type AgentLoopVerificationStatus } from "../src/diagnostics/agent-loop-verification";

const report = verifyAgentLoopEvidence();

console.log(`NYC Apt Radar agent-loop verification: ${report.verified ? "verified" : "needs evidence"}`);
if (report.runId) {
  console.log(`Run: ${report.runId}`);
}
console.log("");

for (const check of report.checks) {
  console.log(`${symbol(check.status)} ${check.name}: ${check.detail}`);
}

console.log("");
console.log(`Next: ${report.nextCommand}`);

process.exit(report.verified ? 0 : 1);

function symbol(status: AgentLoopVerificationStatus) {
  if (status === "pass") {
    return "PASS";
  }

  if (status === "warn") {
    return "WARN";
  }

  return "FAIL";
}
