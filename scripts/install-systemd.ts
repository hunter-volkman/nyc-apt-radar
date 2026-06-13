import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "../src/config/env";
import { buildSystemdService, buildSystemdTimer, defaultSystemdServicePath, defaultSystemdTimerPath } from "../src/automation/systemd";
import { readAgentIntervalMinutes } from "../src/config/timeouts";
import { getRadarReadiness } from "../src/diagnostics/readiness";

const unitName = readStringFlag("--unit-name") ?? "nyc-apt-radar";
const intervalMinutes = readNumberFlag("--interval-minutes") ?? readAgentIntervalMinutes();
const repoDir = path.resolve(readStringFlag("--repo-dir") ?? process.cwd());
const serviceUser = readStringFlag("--user") ?? defaultServiceUser();
const serviceGroup = readStringFlag("--group") ?? undefined;
const servicePath = defaultSystemdServicePath(unitName);
const timerPath = defaultSystemdTimerPath(unitName);
const dryRun = process.argv.includes("--dry-run");
const noEnable = process.argv.includes("--no-enable");
const noStart = process.argv.includes("--no-start");

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function main() {
  const service = buildSystemdService({
    cwd: repoDir,
    unitName,
    user: serviceUser,
    group: serviceGroup,
    environmentFile: path.join(repoDir, ".env"),
  });
  const timer = buildSystemdTimer({ cwd: repoDir, unitName, intervalMinutes });

  if (dryRun) {
    console.log(service);
    console.log(`# Target: ${servicePath}`);
    console.log("");
    console.log(timer);
    console.log(`# Target: ${timerPath}`);
    console.log("# Dry run only; nothing was installed.");
    return;
  }

  if (process.platform !== "linux") {
    throw new Error("systemd deployment is only supported on Linux.");
  }

  const readiness = getRadarReadiness();
  const blockingFailures = readiness.checks.filter((check) => check.status === "fail");
  if (blockingFailures.length) {
    console.error("Refusing to install systemd timer because deployment preflight is not ready:");
    for (const check of blockingFailures) {
      console.error(`- ${check.name}: ${check.detail}`);
    }
    console.error(`Next: ${readiness.nextCommand}`);
    process.exit(1);
  }

  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-systemd-"));
  const tempServicePath = path.join(tempDirectory, `${unitName}.service`);
  const tempTimerPath = path.join(tempDirectory, `${unitName}.timer`);

  try {
    fs.writeFileSync(tempServicePath, service);
    fs.writeFileSync(tempTimerPath, timer);

    runPrivileged("install", ["-m", "0644", tempServicePath, servicePath]);
    runPrivileged("install", ["-m", "0644", tempTimerPath, timerPath]);
    runSystemctl(["daemon-reload"]);

    if (!noEnable) {
      runSystemctl(["enable", `${unitName}.timer`]);
    }

    if (!noStart) {
      runSystemctl(["start", `${unitName}.timer`]);
    }
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }

  console.log(`Installed ${unitName}.service and ${unitName}.timer.`);
  console.log(`Runs npm run agent:run every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}.`);
  console.log(`Status: systemctl status ${unitName}.timer`);
  console.log(`Logs: journalctl -u ${unitName}.service -n 80 --no-pager`);
}

function runSystemctl(args: string[], ignoreFailure = false) {
  runPrivileged("systemctl", args, ignoreFailure);
}

function runPrivileged(command: string, args: string[], ignoreFailure = false) {
  const isRoot = process.getuid?.() === 0;
  const executable = isRoot ? command : "sudo";
  const fullArgs = isRoot ? args : [command, ...args];

  try {
    execFileSync(executable, fullArgs, { stdio: ignoreFailure ? "ignore" : "inherit" });
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

function defaultServiceUser() {
  if (process.env.SUDO_USER && process.env.SUDO_USER !== "root") {
    return process.env.SUDO_USER;
  }

  if (process.env.USER) {
    return process.env.USER;
  }

  return os.userInfo().username;
}
