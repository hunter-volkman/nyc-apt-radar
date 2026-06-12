import { randomBytes } from "node:crypto";
import { parseEnvFile } from "./env";

export function generateNtfyTopic() {
  return `nyc-apt-radar-${randomBytes(24).toString("hex")}`;
}

export function appendMissingEnvValues(contents: string, values: Record<string, string>) {
  const existingKeys = new Set(parseEnvFile(contents).map(([key]) => key));
  const additions = Object.entries(values).filter(([key]) => !existingKeys.has(key));

  if (!additions.length) {
    return contents;
  }

  const prefix = contents.trimEnd();
  const block = [
    "# NYC Apt Radar push notifications",
    ...additions.map(([key, value]) => `${key}=${value}`),
  ].join("\n");

  return `${prefix ? `${prefix}\n\n` : ""}${block}\n`;
}
