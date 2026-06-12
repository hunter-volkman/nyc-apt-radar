import "../src/config/env";
import { generateOutreachDraft } from "../src/core/outreach";
import { loadPreferenceProfile } from "../src/core/preferences";
import { getListing } from "../src/storage/listings";

const [id] = process.argv.slice(2);

if (!id) {
  console.log("Usage: npm run listing:draft -- <listing-id>");
  process.exit(1);
}

const listing = getListing(id);

if (!listing) {
  console.log(`Listing not found: ${id}`);
  process.exit(1);
}

console.log(generateOutreachDraft(listing, loadPreferenceProfile()));
