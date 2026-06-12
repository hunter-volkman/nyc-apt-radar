import fs from "node:fs";
import path from "node:path";
import "../src/config/env";
import { appendMissingEnvValues, generateNtfyTopic } from "../src/config/ntfy-setup";

const envPath = path.join(process.cwd(), ".env.local");
const shouldWrite = process.argv.includes("--write");
const existingTopic = process.env.NYC_APT_RADAR_NTFY_TOPIC?.trim();
const topic = existingTopic || generateNtfyTopic();
const values = {
  NYC_APT_RADAR_NTFY_TOPIC: topic,
  NYC_APT_RADAR_NTFY_BASE_URL: process.env.NYC_APT_RADAR_NTFY_BASE_URL ?? "https://ntfy.sh",
};

if (!shouldWrite) {
  console.log("Generated ntfy configuration:");
  console.log(`NYC_APT_RADAR_NTFY_TOPIC=${topic}`);
  console.log(`NYC_APT_RADAR_NTFY_BASE_URL=${values.NYC_APT_RADAR_NTFY_BASE_URL}`);
  console.log("");
  console.log("Subscribe to this topic in the ntfy app, then write it with:");
  console.log("npm run ntfy:setup -- --write");
  process.exit(0);
}

if (existingTopic) {
  console.log("NYC_APT_RADAR_NTFY_TOPIC is already configured. Leaving .env.local unchanged.");
  console.log("Run npm run notify:test to verify phone delivery.");
  process.exit(0);
}

const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
fs.writeFileSync(envPath, appendMissingEnvValues(current, values));

console.log(`Wrote ntfy topic to ${envPath}`);
console.log("Subscribe to the topic in the ntfy app, then run:");
console.log("npm run notify:test");
console.log("npm run doctor");
