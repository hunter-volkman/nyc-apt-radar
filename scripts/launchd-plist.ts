import fs from "node:fs";
import path from "node:path";
import "../src/config/env";
import { buildLaunchAgentPlist, defaultLaunchAgentPath } from "../src/automation/launchd";
import { getRadarReadiness } from "../src/diagnostics/readiness";

const label = readStringFlag("--label") ?? "com.nyc-apt-radar.loop";
const intervalMinutes = readNumberFlag("--interval-minutes") ?? readWatchIntervalMinutes();
const outputPath = readStringFlag("--output") ?? defaultLaunchAgentPath(label);
const shouldWrite = process.argv.includes("--write");
const plist = buildLaunchAgentPlist({
  cwd: process.cwd(),
  label,
  intervalMinutes,
});

if (!shouldWrite) {
  console.log(plist);
  console.log(`# To write it: npm run watch:plist -- --write`);
  console.log(`# Target: ${outputPath}`);
  process.exit(0);
}

const readiness = getRadarReadiness();
const blockingFailures = readiness.checks.filter((check) => check.status === "fail");

if (blockingFailures.length) {
  console.error("Refusing to write LaunchAgent because watch preflight is not ready:");
  for (const check of blockingFailures) {
    console.error(`- ${check.name}: ${check.detail}`);
  }
  console.error("Fix the failing checks before writing the LaunchAgent.");
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.mkdirSync(path.join(process.cwd(), "data", "logs"), { recursive: true });
fs.writeFileSync(outputPath, plist);

console.log(`Wrote ${outputPath}`);
console.log("Load it with:");
console.log(`launchctl unload ${outputPath} 2>/dev/null || true`);
console.log(`launchctl load ${outputPath}`);
console.log(`launchctl start ${label}`);

function readStringFlag(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

function readNumberFlag(name: string) {
  const value = Number(readStringFlag(name));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readWatchIntervalMinutes() {
  const value = Number(process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES ?? "10");
  return Number.isFinite(value) && value > 0 ? value : 10;
}
