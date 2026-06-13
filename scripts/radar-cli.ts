import "../src/config/env";
import { nextActionForListing } from "../src/core/ranking";
import { loadPreferenceProfile } from "../src/core/preferences";
import { estimateCommutes, type CommuteEstimate } from "../src/core/transit";
import { listRankedListings } from "../src/storage/listings";
import { getDatabasePath } from "../src/storage/database";

const profile = loadPreferenceProfile();
const listings = listRankedListings(profile);

if (!listings.length) {
  console.log("No listings yet.");
  console.log("Run: npm run agent:run -- --no-notify");
  console.log("Or intake a known listing URL: npm run intake -- https://streeteasy.com/building/...");
  process.exit(0);
}

console.log(`NYC Apt Radar - ${listings.length} listings`);
console.log(`Profile: ${profile.name}`);
console.log(`Database: ${getDatabasePath()}`);
console.log("");

for (const [index, listing] of listings.entries()) {
  console.log(`#${index + 1} ${listing.score}/100  ${money(listing.rent)}  ${listing.title}`);
  console.log(`    ID: ${listing.id}`);
  console.log(`    ${listing.neighborhood ?? "Neighborhood unknown"} | ${listing.status} | ${listing.source}`);
  console.log(`    ${listing.address ?? "Address unknown"}`);
  console.log(`    ${listing.scoreExplanation}`);
  for (const commute of estimateCommutes(listing, profile)) {
    printCommute(commute);
  }
  console.log(`    Next: ${nextActionForListing(listing)}`);
  if (listing.appointmentAt) {
    console.log(`    Appointment: ${formatAppointment(listing.appointmentAt)}`);
  }
  if (listing.sourceUrl) {
    console.log(`    URL: ${listing.sourceUrl}`);
  }
  console.log(`    Follow up: npm run listing:status -- ${listing.id} interested`);
  console.log(`               npm run listing:draft -- ${listing.id}`);
  console.log(`               npm run listing:update -- ${listing.id} --notes "Reached out; waiting on reply."`);
  console.log("");
}

function printCommute(commute: CommuteEstimate) {
  if (commute.confidence === "low") {
    console.log(`    Commute to ${commute.targetLabel}: unknown (${commute.targetAddress})`);
    console.log("        Needs coordinates or a known neighborhood.");
    return;
  }

  const confidence = commute.confidence === "high" ? "estimated" : "approximate";
  console.log(`    Commute to ${commute.targetLabel}: ${commute.totalMinutes} min ${confidence}`);
  console.log(`        Walk to train: ${commute.walkToTrainMinutes} min to ${commute.startStation}`);
  console.log(`        Train: ${commute.lines.join(" -> ")}; ${commute.transfers} transfer${commute.transfers === 1 ? "" : "s"}; ${commute.trainMinutes} min`);
  console.log(`        Walk from train: ${commute.walkFromTrainMinutes} min from ${commute.endStation}`);
}

function money(value: number | null) {
  return value === null ? "Rent unknown" : `$${value.toLocaleString("en-US")}`;
}

function formatAppointment(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
    timeZoneName: "short",
  }).format(date);
}
