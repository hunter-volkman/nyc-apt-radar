import fs from "node:fs";
import path from "node:path";

export const loadedEnvFiles = shouldAutoLoadLocalEnv() ? loadLocalEnv() : [];

export function loadLocalEnv(files = [".env.local", ".env"]) {
  const loaded: string[] = [];

  for (const file of files) {
    const filePath = path.isAbsolute(file) ? file : path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    for (const [key, value] of parseEnvFile(fs.readFileSync(filePath, "utf8"))) {
      process.env[key] ??= value;
    }
    loaded.push(filePath);
  }

  return loaded;
}

export function parseEnvFile(contents: string) {
  const entries: Array<[string, string]> = [];

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquote(trimmed.slice(separatorIndex + 1).trim());
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      entries.push([key, value]);
    }
  }

  return entries;
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function shouldAutoLoadLocalEnv() {
  return process.env.NODE_ENV !== "test" && process.env.VITEST !== "true";
}
