import "../src/config/env";
import { nextActionForListing } from "../src/core/ranking";
import { loadPreferenceProfile } from "../src/core/preferences";
import { estimateCommutes } from "../src/core/transit";
import { listRankedListings } from "../src/storage/listings";
import { getDatabasePath } from "../src/storage/database";

const profile = loadPreferenceProfile();
const listings = listRankedListings(profile);

if (!listings.length) {
  console.log("No listings yet.");
  console.log("Run: npm run discover");
  console.log("Or add one: npm run listing:add -- --title \"...\" --rent 3995 --source-url \"...\"");
  process.exit(0);
}

console.log(`NYC Apt Radar - ${listings.length} listings`);
console.log(`Profile: ${profile.name}`);
console.log(`Database: ${getDatabasePath()}`);
console.log("");

for (const [index, listing] of listings.entries()) {
  console.log(`#${index + 1} ${listing.score}/100  ${money(listing.rent)}  ${listing.title}`);
  console.log(`    ${listing.neighborhood ?? "Neighborhood unknown"} | ${listing.status} | ${listing.source}`);
  console.log(`    ${listing.address ?? "Address unknown"}`);
  console.log(`    ${listing.scoreExplanation}`);
  for (const commute of estimateCommutes(listing, profile)) {
    console.log(`    Commute: ${commute.summary}`);
  }
  console.log(`    Next: ${nextActionForListing(listing)}`);
  if (listing.appointmentAt) {
    console.log(`    Appointment: ${formatAppointment(listing.appointmentAt)}`);
  }
  if (listing.sourceUrl) {
    console.log(`    Source: ${listing.sourceUrl}`);
  }
  console.log("");
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
