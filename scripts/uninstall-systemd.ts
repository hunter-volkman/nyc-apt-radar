import { execFileSync } from "node:child_process";
import "../src/config/env";
import { defaultSystemdServicePath, defaultSystemdTimerPath, validateSystemdUnitName } from "../src/automation/systemd";

const unitName = validateSystemdUnitName(readStringFlag("--unit-name") ?? "nyc-apt-radar");
const servicePath = defaultSystemdServicePath(unitName);
const timerPath = defaultSystemdTimerPath(unitName);
const dryRun = process.argv.includes("--dry-run");

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function main() {
  if (dryRun) {
    console.log(`Would disable and stop ${unitName}.timer.`);
    console.log(`Would remove ${servicePath}.`);
    console.log(`Would remove ${timerPath}.`);
    return;
  }

  if (process.platform !== "linux") {
    throw new Error("systemd deployment is only supported on Linux.");
  }

  runSystemctl(["disable", "--now", `${unitName}.timer`], true);
  runPrivileged("rm", ["-f", servicePath, timerPath]);
  runSystemctl(["daemon-reload"]);
  runSystemctl(["reset-failed", `${unitName}.service`, `${unitName}.timer`], true);

  console.log(`Uninstalled ${unitName}.timer.`);
  console.log(`Removed ${servicePath}.`);
  console.log(`Removed ${timerPath}.`);
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
