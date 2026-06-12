import fs from "node:fs";
import path from "node:path";
import { fetchWithTimeout, readPositiveIntegerEnv } from "../config/timeouts";

export type SourceConfig = {
  id: string;
  type: "directory" | "file" | "url";
  path?: string;
  url?: string;
  sourceName?: string;
};

export type SourceDocument = {
  sourceId: string;
  sourceType: SourceConfig["type"];
  sourceName: string;
  sourceRef: string;
  rawText: string;
  discoveredAt: string;
};

export type SourceCollectionResult = {
  documents: SourceDocument[];
  errors: SourceCollectionError[];
};

export type SourceCollectionError = {
  sourceId: string;
  sourceType: SourceConfig["type"];
  sourceRef: string;
  message: string;
  discoveredAt: string;
};

type SourceConfigFile = {
  sources?: SourceConfig[];
};

const defaultSourceDirectory = "data/source-events";

export function loadSourceConfigs() {
  const configPath = process.env.NYC_APT_RADAR_SOURCES_PATH ?? "data/sources.json";
  const configs: SourceConfig[] = [];

  if (fs.existsSync(configPath)) {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf8")) as SourceConfigFile;
    configs.push(...parsed.sources ?? []);
  }

  const urls = (process.env.NYC_APT_RADAR_SOURCE_URLS ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  configs.push(...urls.map((url, index) => ({
    id: `env-url-${index + 1}`,
    type: "url" as const,
    url,
    sourceName: "Configured URL",
  })));

  if (!configs.length) {
    configs.push({
      id: "source-events",
      type: "directory",
      path: defaultSourceDirectory,
      sourceName: "Local source events",
    });
  }

  return configs;
}

export async function collectSourceDocuments(configs = loadSourceConfigs()) {
  const result = await collectSourceDocumentsWithErrors(configs);
  if (result.errors.length) {
    throw new Error(result.errors.map(formatSourceCollectionError).join("\n"));
  }

  return result.documents;
}

export async function collectSourceDocumentsWithErrors(configs = loadSourceConfigs()): Promise<SourceCollectionResult> {
  const concurrency = Math.min(readPositiveIntegerEnv("NYC_APT_RADAR_SOURCE_CONCURRENCY", 4), Math.max(1, configs.length));
  const results = await mapWithConcurrency(configs, concurrency, async (config) => {
    try {
      return {
        documents: await collectSource(config),
        errors: [],
      };
    } catch (error) {
      return {
        documents: [],
        errors: [{
          sourceId: config.id,
          sourceType: config.type,
          sourceRef: sourceRef(config),
          message: errorMessage(error),
          discoveredAt: new Date().toISOString(),
        }],
      };
    }
  });

  return {
    documents: results.flatMap((result) => result.documents),
    errors: results.flatMap((result) => result.errors),
  };
}

export function formatSourceCollectionError(error: SourceCollectionError) {
  return `${error.sourceId}: ${error.message}`;
}

async function collectSource(config: SourceConfig): Promise<SourceDocument[]> {
  if (config.type === "directory") {
    const directory = resolvePath(config.path ?? defaultSourceDirectory);
    fs.mkdirSync(directory, { recursive: true });
    const entries = fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .filter((entry) => /\.(txt|eml|html|json|md)$/i.test(entry.name));

    return entries.map((entry) => {
      const filePath = path.join(directory, entry.name);
      return {
        sourceId: config.id,
        sourceType: config.type,
        sourceName: config.sourceName ?? config.id,
        sourceRef: filePath,
        rawText: fs.readFileSync(filePath, "utf8"),
        discoveredAt: new Date(fs.statSync(filePath).mtime).toISOString(),
      };
    });
  }

  if (config.type === "file") {
    const filePath = resolvePath(requireValue(config.path, `Source ${config.id} is missing path.`));
    return [{
      sourceId: config.id,
      sourceType: config.type,
      sourceName: config.sourceName ?? config.id,
      sourceRef: filePath,
      rawText: fs.readFileSync(filePath, "utf8"),
      discoveredAt: new Date(fs.statSync(filePath).mtime).toISOString(),
    }];
  }

  const url = requireValue(config.url, `Source ${config.id} is missing url.`);
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": "nyc-apt-radar/0.1 local-first apartment search assistant",
      Accept: "text/html,application/rss+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
    },
  }, readPositiveIntegerEnv("NYC_APT_RADAR_FETCH_TIMEOUT_MS", 15000));

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return [{
    sourceId: config.id,
    sourceType: config.type,
    sourceName: config.sourceName ?? config.id,
    sourceRef: url,
    rawText: await response.text(),
    discoveredAt: new Date().toISOString(),
  }];
}

function resolvePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function requireValue(value: string | undefined, message: string) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function sourceRef(config: SourceConfig) {
  if (config.type === "url") {
    return config.url ?? config.id;
  }

  if (config.type === "file") {
    return config.path ? resolvePath(config.path) : config.id;
  }

  return resolvePath(config.path ?? defaultSourceDirectory);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index] as T);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
