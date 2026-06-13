import fs from "node:fs";
import { execFileSync } from "node:child_process";
import "../src/config/env";
import { defaultLaunchAgentPath } from "../src/automation/launchd";

const label = readStringFlag("--label") ?? "com.hunter.nyc-apt-radar";
const outputPath = readStringFlag("--output") ?? defaultLaunchAgentPath(label);
const dryRun = process.argv.includes("--dry-run");

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

function main() {
  if (dryRun) {
    console.log(`Would unload ${label}.`);
    console.log(`Would remove ${outputPath}.`);
    return;
  }

  if (process.platform !== "darwin") {
    throw new Error("launchd deployment is only supported on macOS.");
  }

  launchctl(["unload", outputPath], true);
  fs.rmSync(outputPath, { force: true });

  console.log(`Uninstalled ${label}.`);
  console.log(`Removed ${outputPath}.`);
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
