import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import "../src/config/env";
import { readAgentIntervalMinutes } from "../src/config/timeouts";
import { buildLaunchAgentPlist, defaultLaunchAgentPath } from "../src/automation/launchd";
import { getRadarReadiness } from "../src/diagnostics/readiness";
import { ensureOwnerOnlyDirectory } from "../src/storage/permissions";

const label = readStringFlag("--label") ?? "com.hunter.nyc-apt-radar";
const intervalMinutes = readNumberFlag("--interval-minutes") ?? readWatchIntervalMinutes();
const outputPath = readStringFlag("--output") ?? defaultLaunchAgentPath(label);
const dryRun = process.argv.includes("--dry-run");
const noLoad = process.argv.includes("--no-load");

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function main() {
  const plist = buildLaunchAgentPlist({
    cwd: process.cwd(),
    label,
    intervalMinutes,
  });

  if (dryRun) {
    console.log(plist);
    console.log(`# Target: ${outputPath}`);
    console.log("# Dry run only; nothing was installed.");
    return;
  }

  if (process.platform !== "darwin") {
    throw new Error("launchd deployment is only supported on macOS.");
  }

  const readiness = getRadarReadiness();
  const blockingFailures = readiness.checks.filter((check) => check.status === "fail");
  if (blockingFailures.length) {
    console.error("Refusing to install LaunchAgent because deployment preflight is not ready:");
    for (const check of blockingFailures) {
      console.error(`- ${check.name}: ${check.detail}`);
    }
    console.error(`Next: ${readiness.nextCommand}`);
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  ensureOwnerOnlyDirectory(path.join(process.cwd(), "data", "logs"));
  fs.writeFileSync(outputPath, plist);

  console.log(`Wrote ${outputPath}`);

  if (noLoad) {
    console.log("Skipped launchctl load because --no-load was provided.");
    return;
  }

  launchctl(["unload", outputPath], true);
  launchctl(["load", outputPath]);
  launchctl(["start", label]);
  console.log(`Installed and started ${label} every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}.`);
  console.log("Logs: npm run agent:logs");
}

function launchctl(args: string[], ignoreFailure = false) {
  try {
    execFileSync("launchctl", args, { stdio: ignoreFailure ? "ignore" : "inherit" });
  } catch (error) {
    if (!ignoreFailure) {
      throw error;
    }
  }
}

function readStringFlag(name: string) {
  const prefix = `${name}=`;
  const equals = process.argv.find((argument) => argument.startsWith(prefix));
  if (equals) {
    return equals.slice(prefix.length);
  }

  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function readNumberFlag(name: string) {
  const value = Number(readStringFlag(name));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function readWatchIntervalMinutes() {
  return readAgentIntervalMinutes();
}
