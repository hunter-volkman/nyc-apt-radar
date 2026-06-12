import "../src/config/env";
import { parseStatus } from "../src/core/status";
import { updateListingStatus } from "../src/storage/listings";

const [id, statusValue] = process.argv.slice(2);

if (!id || !statusValue) {
  console.log("Usage: npm run listing:status -- <listing-id> <status>");
  console.log("Statuses: new, interested, contacted, scheduled, rejected, viewed, applied");
  process.exit(1);
}

const status = parseStatus(statusValue);
const listing = updateListingStatus(id, status);

console.log(`Updated ${listing.id} to ${listing.status}.`);
