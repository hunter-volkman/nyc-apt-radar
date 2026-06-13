import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { readAgentIntervalMinutes } from "../config/timeouts";
import { loadPreferenceProfile } from "../core/preferences";
import {
  activeSearchConfigs,
  hasSearchConfigFile,
  loadSearchConfigs,
  safeSearchUrl,
  searchSourceName,
  type SearchConfig,
} from "../discovery/searches";
import { ensureDatabase, getDatabasePath } from "../storage/database";

export type ReadinessStatus = "ok" | "warn" | "fail";

export type ReadinessCheck = {
  name: string;
  status: ReadinessStatus;
  detail: string;
};

export type ReadinessReport = {
  ready: boolean;
  databasePath: string;
  profileName: string | null;
  commuteTargetCount: number;
  searchCount: number;
  ntfyConfigured: boolean;
  agentIntervalMinutes: number;
  nextCommand: string;
  checks: ReadinessCheck[];
};

export type ReadinessOptions = {
  requireNtfy?: boolean;
};

export function getRadarReadiness(options: ReadinessOptions = {}): ReadinessReport {
  const checks: ReadinessCheck[] = [];
  const databasePath = getDatabasePath();
  let profileName: string | null = null;
  let commuteTargetCount = 0;
  let searchCount = 0;
  let searches: SearchConfig[] = [];

  checks.push(nodeReadiness());
  checks.push(npmReadiness());

  try {
    ensureDatabase();
    checks.push({ name: "database", status: "ok", detail: `SQLite ready at ${databasePath}` });
  } catch (error) {
    checks.push({ name: "database", status: "fail", detail: errorMessage(error) });
  }

  try {
    const profile = loadPreferenceProfile();
    profileName = profile.name;
    commuteTargetCount = profile.commuteTargets.length;
    checks.push({
      name: "preferences",
      status: profile.commuteTargets.length ? "ok" : "fail",
      detail: `${profile.name}; ${profile.commuteTargets.length} commute target${profile.commuteTargets.length === 1 ? "" : "s"}; hot score ${profile.hotScore}`,
    });

    for (const target of profile.commuteTargets) {
      checks.push({
        name: `commute:${target.label}`,
        status: "ok",
        detail: `${target.address}; max ${target.maxMinutes} min`,
      });
    }
  } catch (error) {
    checks.push({ name: "preferences", status: "fail", detail: errorMessage(error) });
  }

  try {
    const searchConfigExists = hasSearchConfigFile();
    searches = activeSearchConfigs(loadSearchConfigs());
    searchCount = searches.length;

    checks.push({
      name: "searches",
      status: searches.length ? "ok" : "fail",
      detail: searches.length
        ? `${searches.length} active StreetEasy search${searches.length === 1 ? "" : "es"} configured`
        : searchConfigExists
          ? "data/searches.json exists but has no active StreetEasy searches."
          : "Create data/searches.json with one active StreetEasy saved-search URL.",
    });
    checks.push(...searches.map(searchReadiness));
  } catch (error) {
    checks.push({ name: "searches", status: "fail", detail: errorMessage(error) });
  }

  const ntfyTopic = process.env.NYC_APT_RADAR_NTFY_TOPIC?.trim();
  const requireNtfy = options.requireNtfy ?? true;

  checks.push({
    name: "ntfy",
    status: ntfyTopic ? "ok" : requireNtfy ? "fail" : "warn",
    detail: ntfyTopic
      ? "Topic configured; run npm run notify:test for live phone verification."
      : requireNtfy
        ? "Missing NYC_APT_RADAR_NTFY_TOPIC; hot matches cannot be pushed."
        : "Missing NYC_APT_RADAR_NTFY_TOPIC; --no-notify smoke runs will record skipped decisions without pushing.",
  });

  const agentIntervalMinutes = readIntervalMinutes();
  checks.push({
    name: "agent interval",
    status: agentIntervalMinutes > 0 ? "ok" : "fail",
    detail: `Agent interval ${agentIntervalMinutes} minute${agentIntervalMinutes === 1 ? "" : "s"}`,
  });

  checks.push(localRuntimeIgnoreReadiness());

  const ready = checks.every((check) => check.status !== "fail");

  return {
    ready,
    databasePath,
    profileName,
    commuteTargetCount,
    searchCount,
    ntfyConfigured: Boolean(ntfyTopic),
    agentIntervalMinutes,
    nextCommand: nextCommandFor(checks, ready),
    checks,
  };
}

function searchReadiness(search: SearchConfig): ReadinessCheck {
  return {
    name: `search:${search.id}`,
    status: "ok",
    detail: `${search.provider} ${searchSourceName(search)} ${safeSearchUrl(search.searchUrl)}`,
  };
}

function nodeReadiness(): ReadinessCheck {
  return {
    name: "node",
    status: "ok",
    detail: `Node ${process.version}`,
  };
}

function npmReadiness(): ReadinessCheck {
  try {
    const version = execFileSync("npm", ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    return {
      name: "npm",
      status: "ok",
      detail: `npm ${version}`,
    };
  } catch {
    return {
      name: "npm",
      status: "warn",
      detail: "Could not verify npm from this process; npm scripts are already running under Node.",
    };
  }
}

function localRuntimeIgnoreReadiness(): ReadinessCheck {
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  if (!fs.existsSync(gitignorePath)) {
    return {
      name: "runtime ignores",
      status: "fail",
      detail: ".gitignore is missing; local database, logs, and env files could be committed.",
    };
  }

  const gitignore = fs.readFileSync(gitignorePath, "utf8");
  const required = [".env*", "/data/*.sqlite", "/data/*.sqlite-*", "/data/logs/"];
  const missing = required.filter((entry) => !gitignore.includes(entry));

  return {
    name: "runtime ignores",
    status: missing.length ? "fail" : "ok",
    detail: missing.length
      ? `Missing .gitignore entries: ${missing.join(", ")}`
      : "Local env, SQLite, and log files are ignored by git.",
  };
}

function nextCommandFor(checks: ReadinessCheck[], ready: boolean) {
  if (ready) {
    return "npm run agent:run -- --no-notify";
  }

  const failed = checks.find((check) => check.status === "fail");
  if (!failed) {
    return "npm run agent:run -- --no-notify";
  }

  if (failed.name === "preferences" || failed.name.startsWith("commute:")) {
    return "cp data/preferences.example.json data/preferences.json, edit commute targets, then npm run doctor";
  }

  if (failed.name === "searches" || failed.name.startsWith("search:")) {
    return "Create data/searches.json with an active StreetEasy search URL, then npm run doctor";
  }

  if (failed.name === "ntfy") {
    return "Set NYC_APT_RADAR_NTFY_TOPIC or run npm run ntfy:setup -- --write, then npm run notify:test";
  }

  if (failed.name === "runtime ignores") {
    return "Fix .gitignore for local runtime files, then npm run doctor";
  }

  return "Fix the failing check, then npm run doctor";
}

function readIntervalMinutes() {
  return readAgentIntervalMinutes();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
