import "../src/config/env";
import { listNotifications } from "../src/storage/notifications";

const notifications = listNotifications();

if (!notifications.length) {
  console.log("No notifications recorded yet.");
  console.log("Run: npm run agent:run -- --no-notify");
  process.exit(0);
}

console.log(`NYC Apt Radar notifications - ${notifications.length}`);
console.log(`Destination: ${destinationSummary()}`);
console.log("");

for (const notification of notifications) {
  console.log(`${notification.status.toUpperCase()} ${notification.channel} ${notification.title}`);
  console.log(`    Listing: ${notification.listingId}`);
  console.log(`    Score: ${scoreFromTitle(notification.title)}`);
  console.log(`    Created: ${formatDateTime(notification.createdAt)}`);

  if (notification.sentAt) {
    console.log(`    Sent: ${formatDateTime(notification.sentAt)}`);
  }

  console.log(`    Reason: ${reasonFor(notification)}`);

  console.log(`    Summary: ${firstLine(notification.body)}`);
  console.log("");
}

function firstLine(value: string) {
  return value.split("\n").find(Boolean) ?? "";
}

function scoreFromTitle(value: string) {
  const match = /^(\d+)\/100\b/.exec(value);
  return match ? `${match[1]}/100` : "unknown";
}

function reasonFor(notification: { status: string; errorMessage: string | null }) {
  if (notification.errorMessage) {
    return notification.errorMessage;
  }

  if (notification.status === "sent") {
    return "Delivered to ntfy.";
  }

  if (notification.status === "deduped") {
    return "Already sent for this listing score.";
  }

  if (notification.status === "skipped") {
    return "Skipped by notification rules.";
  }

  return "No reason recorded.";
}

function destinationSummary() {
  const topic = process.env.NYC_APT_RADAR_NTFY_TOPIC?.trim();
  const baseUrl = process.env.NYC_APT_RADAR_NTFY_BASE_URL?.trim() || "https://ntfy.sh";

  if (!topic) {
    return `${baseUrl} topic not configured`;
  }

  return `${baseUrl} topic ${redact(topic)}`;
}

function redact(value: string) {
  if (value.length <= 8) {
    return "[redacted]";
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
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
