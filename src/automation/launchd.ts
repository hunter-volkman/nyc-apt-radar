import os from "node:os";
import path from "node:path";

export type LaunchAgentOptions = {
  cwd: string;
  label?: string;
  intervalMinutes?: number;
  logDirectory?: string;
  npmScript?: string;
};

const defaultLabel = "com.hunter.nyc-apt-radar";
const defaultPath = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin";

export function defaultLaunchAgentPath(label = defaultLabel) {
  return path.join(os.homedir(), "Library", "LaunchAgents", `${label}.plist`);
}

export function buildLaunchAgentPlist(options: LaunchAgentOptions) {
  const label = options.label ?? defaultLabel;
  const intervalSeconds = Math.max(60, Math.round((options.intervalMinutes ?? 60) * 60));
  const logDirectory = options.logDirectory ?? path.join(options.cwd, "data", "logs");
  const npmScript = options.npmScript ?? "agent:run";

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">`,
    `<plist version="1.0">`,
    `<dict>`,
    plistKey("Label", label),
    `  <key>ProgramArguments</key>`,
    `  <array>`,
    plistString("/usr/bin/env"),
    plistString(`PATH=${defaultPath}`),
    plistString("npm"),
    plistString("run"),
    plistString(npmScript),
    `  </array>`,
    plistKey("WorkingDirectory", options.cwd),
    `  <key>RunAtLoad</key>`,
    `  <true/>`,
    `  <key>StartInterval</key>`,
    `  <integer>${intervalSeconds}</integer>`,
    plistKey("StandardOutPath", path.join(logDirectory, "agent.log")),
    plistKey("StandardErrorPath", path.join(logDirectory, "agent.err.log")),
    `</dict>`,
    `</plist>`,
    "",
  ].join("\n");
}

function plistKey(key: string, value: string) {
  return [`  <key>${escapeXml(key)}</key>`, plistString(value)].join("\n");
}

function plistString(value: string) {
  return `  <string>${escapeXml(value)}</string>`;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}
