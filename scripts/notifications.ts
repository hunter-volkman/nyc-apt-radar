import "../src/config/env";
import { listNotifications } from "../src/storage/notifications";

const notifications = listNotifications();

if (!notifications.length) {
  console.log("No notifications recorded yet.");
  console.log("Run: npm run discover");
  process.exit(0);
}

console.log(`NYC Apt Radar notifications - ${notifications.length}`);
console.log("");

for (const notification of notifications) {
  console.log(`${notification.status.toUpperCase()} ${notification.channel} ${notification.title}`);
  console.log(`    Listing: ${notification.listingId}`);
  console.log(`    Created: ${formatDateTime(notification.createdAt)}`);

  if (notification.sentAt) {
    console.log(`    Sent: ${formatDateTime(notification.sentAt)}`);
  }

  if (notification.errorMessage) {
    console.log(`    Error: ${notification.errorMessage}`);
  }

  console.log(`    ${firstLine(notification.body)}`);
  console.log("");
}

function firstLine(value: string) {
  return value.split("\n").find(Boolean) ?? "";
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
