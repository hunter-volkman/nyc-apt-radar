import fs from "node:fs";
import path from "node:path";
import { loadPreferenceProfile } from "../core/preferences";
import { loadSourceConfigs, type SourceConfig } from "../discovery/sources";
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
  sourceCount: number;
  openaiConfigured: boolean;
  ntfyConfigured: boolean;
  watchIntervalMinutes: number;
  checks: ReadinessCheck[];
};

export function getRadarReadiness(): ReadinessReport {
  const checks: ReadinessCheck[] = [];
  const databasePath = getDatabasePath();
  let profileName: string | null = null;
  let commuteTargetCount = 0;
  let sourceCount = 0;

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
    const sources = loadSourceConfigs();
    sourceCount = sources.length;
    checks.push({
      name: "sources",
      status: sources.length ? "ok" : "fail",
      detail: `${sources.length} source${sources.length === 1 ? "" : "s"} configured`,
    });
    checks.push(...sources.map(sourceReadiness));
  } catch (error) {
    checks.push({ name: "sources", status: "fail", detail: errorMessage(error) });
  }

  const ntfyTopic = process.env.NYC_APT_RADAR_NTFY_TOPIC?.trim();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  checks.push({
    name: "openai",
    status: openaiApiKey ? "ok" : "fail",
    detail: openaiApiKey ? "OPENAI_API_KEY configured for listing extraction." : "Missing OPENAI_API_KEY; unstructured source extraction cannot run.",
  });

  checks.push({
    name: "ntfy",
    status: ntfyTopic ? "ok" : "fail",
    detail: ntfyTopic ? "Topic configured; run npm run notify:test for live phone verification." : "Missing NYC_APT_RADAR_NTFY_TOPIC; hot matches cannot be pushed.",
  });

  const watchIntervalMinutes = readIntervalMinutes();
  checks.push({
    name: "watch",
    status: watchIntervalMinutes > 0 ? "ok" : "fail",
    detail: `Loop interval ${watchIntervalMinutes} minute${watchIntervalMinutes === 1 ? "" : "s"}`,
  });

  return {
    ready: checks.every((check) => check.status !== "fail"),
    databasePath,
    profileName,
    commuteTargetCount,
    sourceCount,
    openaiConfigured: Boolean(openaiApiKey),
    ntfyConfigured: Boolean(ntfyTopic),
    watchIntervalMinutes,
    checks,
  };
}

function sourceReadiness(source: SourceConfig): ReadinessCheck {
  if (source.type === "url") {
    return {
      name: `source:${source.id}`,
      status: source.url ? "ok" : "fail",
      detail: source.url ? `url ${source.url}` : "URL source is missing url.",
    };
  }

  if (source.type === "file") {
    const filePath = resolvePath(source.path ?? "");
    return {
      name: `source:${source.id}`,
      status: source.path && fs.existsSync(filePath) ? "ok" : "fail",
      detail: source.path ? `file ${filePath}` : "File source is missing path.",
    };
  }

  const directory = resolvePath(source.path ?? "data/source-events");
  if (!fs.existsSync(directory)) {
    return {
      name: `source:${source.id}`,
      status: "warn",
      detail: `directory ${directory} does not exist yet; discovery will create it`,
    };
  }

  const supportedFiles = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .filter((entry) => /\.(txt|eml|html|json|md)$/i.test(entry.name))
    .length;

  return {
    name: `source:${source.id}`,
    status: "ok",
    detail: `directory ${directory}; ${supportedFiles} supported file${supportedFiles === 1 ? "" : "s"}`,
  };
}

function readIntervalMinutes() {
  const value = Number(process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES ?? "10");
  return Number.isFinite(value) && value > 0 ? value : 10;
}

function resolvePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
