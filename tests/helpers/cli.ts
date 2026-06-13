import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

export type CliRunOptions = {
  args?: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  preload?: string;
  stdin?: string;
  timeoutMs?: number;
};

export type CliRunResult = {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error: Error | undefined;
};

export function runCliScript(scriptPath: string, options: CliRunOptions = {}): CliRunResult {
  const cwd = options.cwd ?? process.cwd();
  const script = path.isAbsolute(scriptPath) ? scriptPath : path.join(cwd, scriptPath);
  const env = sanitizedProcessEnv(options.env);

  if (options.preload) {
    env.NODE_OPTIONS = appendNodeOption(env.NODE_OPTIONS, `--import=${pathToFileURL(options.preload).href}`);
  }

  const result = spawnSync(process.execPath, ["--import", "tsx", script, ...(options.args ?? [])], {
    cwd,
    env,
    input: options.stdin,
    encoding: "utf8",
    timeout: options.timeoutMs ?? 10000,
    windowsHide: true,
  });

  return {
    status: result.status,
    signal: result.signal,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    error: result.error,
  };
}

function sanitizedProcessEnv(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key.startsWith("NYC_APT_RADAR_") || key === "NODE_OPTIONS") {
      continue;
    }

    env[key] = value;
  }

  env.NODE_ENV = "test";
  env.VITEST = "true";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete env[key];
      continue;
    }

    env[key] = value;
  }

  return env;
}

function appendNodeOption(existing: string | undefined, option: string) {
  return existing ? `${existing} ${option}` : option;
}
