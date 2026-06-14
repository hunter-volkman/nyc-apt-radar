import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadedEnvFiles } from "../config/env";
import { getPreferencesPath, hasPreferenceConfigFile, loadPreferenceProfile } from "../core/preferences";
import { readOpenAIResponsesConfig } from "../agent/openai";
import {
  activeSearchConfigs,
  hasSearchConfigFile,
  loadSearchConfigs,
  safeSearchUrl,
  searchSourceName,
  type SearchConfig,
} from "../discovery/searches";
import { readNtfyConfig } from "../notifications/ntfy";
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
  openAIConfigured: boolean;
  loadedEnvFiles: string[];
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
  checks.push(envFileReadiness());

  try {
    ensureDatabase();
    checks.push({ name: "database", status: "ok", detail: `SQLite ready at ${databasePath}` });
  } catch (error) {
    checks.push({ name: "database", status: "fail", detail: errorMessage(error) });
  }

  try {
    if (!hasPreferenceConfigFile()) {
      checks.push({
        name: "preferences",
        status: "fail",
        detail: `Create ${getPreferencesPath()} from data/preferences.example.json before running the radar loop.`,
      });
    } else {
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

  const requireNtfy = options.requireNtfy ?? true;
  const ntfyCheck = ntfyReadiness(requireNtfy);
  checks.push(ntfyCheck);

  const openAICheck = openAIReadiness();
  checks.push(openAICheck);

  checks.push(localRuntimeIgnoreReadiness());

  const ready = checks.every((check) => check.status !== "fail");

  return {
    ready,
    databasePath,
    profileName,
    commuteTargetCount,
    searchCount,
    ntfyConfigured: ntfyCheck.status === "ok",
    openAIConfigured: openAICheck.status === "ok",
    loadedEnvFiles,
    nextCommand: nextCommandFor(checks, ready, requireNtfy),
    checks,
  };
}

function envFileReadiness(): ReadinessCheck {
  if (!loadedEnvFiles.length) {
    return {
      name: "env files",
      status: "warn",
      detail: "No .env.local or .env file was loaded; relying only on shell environment variables.",
    };
  }

  return {
    name: "env files",
    status: "ok",
    detail: `Loaded ${loadedEnvFiles.map((file) => path.relative(process.cwd(), file)).join(", ")}.`,
  };
}

function openAIReadiness(): ReadinessCheck {
  try {
    const config = readOpenAIResponsesConfig();
    if (!config) {
      return {
        name: "openai supervisor",
        status: "fail",
        detail: `OPENAI_API_KEY is required for the model-directed agent loop; checked shell env${loadedEnvFiles.length ? ` and ${loadedEnvFiles.map((file) => path.relative(process.cwd(), file)).join(", ")}` : ""}.`,
      };
    }

    return {
      name: "openai supervisor",
      status: "ok",
      detail: `Responses API configured with ${config.model}; reasoning ${config.reasoningEffort}.`,
    };
  } catch (error) {
    return {
      name: "openai supervisor",
      status: "fail",
      detail: errorMessage(error),
    };
  }
}

function ntfyReadiness(requireNtfy: boolean): ReadinessCheck {
  const ntfyTopic = process.env.NYC_APT_RADAR_NTFY_TOPIC?.trim();

  if (!ntfyTopic) {
    return {
      name: "ntfy",
      status: requireNtfy ? "fail" : "warn",
      detail: requireNtfy
        ? "Missing NYC_APT_RADAR_NTFY_TOPIC; hot matches cannot be pushed."
        : "Missing NYC_APT_RADAR_NTFY_TOPIC; --no-notify smoke runs will record skipped decisions without pushing.",
    };
  }

  try {
    const config = readNtfyConfig();
    return {
      name: "ntfy",
      status: "ok",
      detail: `Topic configured at ${config.baseUrl}; run npm run notify:test for live phone verification.`,
    };
  } catch (error) {
    return {
      name: "ntfy",
      status: "fail",
      detail: errorMessage(error),
    };
  }
}

function searchReadiness(search: SearchConfig): ReadinessCheck {
  return {
    name: `search:${search.id}`,
    status: "ok",
    detail: `${search.provider} ${searchSourceName(search)} ${safeSearchUrl(search.searchUrl)}`,
  };
}

export function nodeReadiness(version = process.versions.node): ReadinessCheck {
  const major = Number(version.split(".")[0]);
  const supported = Number.isInteger(major) && major >= 20;

  return {
    name: "node",
    status: supported ? "ok" : "fail",
    detail: supported
      ? `Node ${version}`
      : `Node ${version}; Node.js 20 or newer is required.`,
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
      detail: ".gitignore is missing; database and env files could be committed.",
    };
  }

  const gitignore = fs.readFileSync(gitignorePath, "utf8");
  const required = [".env*", "/data/*.sqlite", "/data/*.sqlite-*"];
  const missing = required.filter((entry) => !gitignore.includes(entry));

  return {
    name: "runtime ignores",
    status: missing.length ? "fail" : "ok",
    detail: missing.length
      ? `Missing .gitignore entries: ${missing.join(", ")}`
      : "Env and SQLite files are ignored by git.",
  };
}

function nextCommandFor(checks: ReadinessCheck[], ready: boolean, requireNtfy: boolean) {
  if (ready) {
    return requireNtfy ? "npm run agent:run" : "npm run agent:dry-run";
  }

  const failed = checks.find((check) => check.status === "fail");
  if (!failed) {
    return "npm run agent:dry-run";
  }

  if (failed.name === "preferences" || failed.name.startsWith("commute:")) {
    return "cp data/preferences.example.json data/preferences.json, edit commute targets, then npm run doctor";
  }

  if (failed.name === "searches" || failed.name.startsWith("search:")) {
    return "Create data/searches.json with an active StreetEasy search URL, then npm run doctor";
  }

  if (failed.name === "ntfy") {
    return "Set NYC_APT_RADAR_NTFY_TOPIC, then npm run notify:test";
  }

  if (failed.name === "openai supervisor") {
    return "Set OPENAI_API_KEY, then npm run doctor";
  }

  if (failed.name === "runtime ignores") {
    return "Fix .gitignore for local runtime files, then npm run doctor";
  }

  return "Fix the failing check, then npm run doctor";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
