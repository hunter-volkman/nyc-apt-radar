import "../src/config/env";
import { listSourceEvents } from "../src/storage/discovery";

const limit = readLimit();
const events = listSourceEvents(limit);

if (!events.length) {
  console.log("No source events recorded yet.");
  console.log("Run: npm run agent:run -- --no-notify");
  process.exit(0);
}

console.log(`NYC Apt Radar source events - latest ${events.length}`);
console.log("");

for (const event of events) {
  console.log(`${event.status.toUpperCase()} ${event.sourceId} ${event.sourceType}`);
  console.log(`    Ref: ${event.sourceRef}`);
  console.log(`    Listings: ${event.listingsFound}`);
  console.log(`    Discovered: ${formatDateTime(event.discoveredAt)}`);

  if (event.processedAt) {
    console.log(`    Processed: ${formatDateTime(event.processedAt)}`);
  }

  if (event.errorMessage) {
    console.log(`    Error: ${event.errorMessage}`);
  }

  console.log(`    Fingerprint: ${event.fingerprint.slice(0, 12)}`);
  console.log("");
}

function readLimit() {
  const raw = process.argv.find((argument) => argument.startsWith("--limit="));
  const value = Number(raw?.slice("--limit=".length) ?? "20");
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 20;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}
