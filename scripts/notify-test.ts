import "../src/config/env";
import { loadPreferenceProfile } from "../src/core/preferences";
import { ntfyMessageForListing, sendNtfyMessage } from "../src/notifications/ntfy";
import { listRankedListings } from "../src/storage/listings";

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const listingId = readListingId();

  if (listingId) {
    const profile = loadPreferenceProfile();
    const listing = listRankedListings(profile).find((candidate) => candidate.id === listingId);

    if (!listing) {
      throw new Error(`Listing not found: ${listingId}. Run npm run discover or check npm run radar.`);
    }

    await sendNtfyMessage(ntfyMessageForListing(listing, profile));
    console.log(`Sent ntfy listing test notification for ${listing.id}.`);
    return;
  }

  await sendNtfyMessage({
    title: "NYC Apt Radar test",
    body: `ntfy is connected at ${new Date().toISOString()}.`,
    priority: "default",
    tags: "house,white_check_mark",
  });

  console.log("Sent ntfy test notification.");
}

function readListingId() {
  const equalsArg = process.argv.find((argument) => argument.startsWith("--listing="));
  if (equalsArg) {
    return equalsArg.slice("--listing=".length);
  }

  const index = process.argv.indexOf("--listing");
  return index >= 0 ? process.argv[index + 1] : null;
}
