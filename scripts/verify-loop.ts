import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import "../src/config/env";

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-verify-"));
process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(tempDirectory, "verify.sqlite");
delete process.env.NYC_APT_RADAR_NTFY_TOPIC;

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  let sqlite: { close: () => void } | null = null;

  try {
    const [
      { runDiscoveryOnce },
      { loadPreferenceProfile },
      { generateOutreachDraft },
      { estimateCommutes },
      { listRankedListings },
      { listSourceEvents },
      database,
    ] = await Promise.all([
      import("../src/discovery/agent-loop.js"),
      import("../src/core/preferences.js"),
      import("../src/core/outreach.js"),
      import("../src/core/transit.js"),
      import("../src/storage/listings.js"),
      import("../src/storage/discovery.js"),
      import("../src/storage/database.js"),
    ]);

    sqlite = database.sqlite;
    const profile = loadPreferenceProfile();
    const result = await runDiscoveryOnce({ notify: false });
    const listings = listRankedListings(profile);
    const sourceEvents = listSourceEvents();
    const topListing = listings[0];

    assert(result.errors.length === 0, `Expected no discovery errors, got ${result.errors.join("; ")}`);
    assert(result.documentsSeen === 1, `Expected 1 source document, got ${result.documentsSeen}`);
    assert(result.listingsSaved.length === 3, `Expected 3 saved listings, got ${result.listingsSaved.length}`);
    assert(listings.length === 3, `Expected 3 ranked listings, got ${listings.length}`);
    assert(topListing !== undefined, "Expected a top ranked listing.");

    const commutes = estimateCommutes(topListing, profile);
    assert(commutes.length === profile.commuteTargets.length, "Expected commute estimates for every target.");

    for (const commute of commutes) {
      assert(commute.totalMinutes > 0, `Expected positive commute minutes for ${commute.targetLabel}.`);
      assert(commute.walkToTrainMinutes >= 0, `Expected walk-to-train minutes for ${commute.targetLabel}.`);
      assert(commute.walkFromTrainMinutes >= 0, `Expected walk-from-train minutes for ${commute.targetLabel}.`);
      assert(commute.lines.length > 0, `Expected train lines for ${commute.targetLabel}.`);
      assert(commute.summary.includes("min via"), `Expected useful commute summary for ${commute.targetLabel}.`);
    }

    assert(sourceEvents.some((event) => event.status === "processed" && event.listingsFound === 3), "Expected processed source event with 3 listings.");

    const ainslie = listings.find((listing) => listing.id === "56-ainslie-st-4g");
    assert(ainslie !== undefined, "Expected 56 Ainslie listing.");
    assert(generateOutreachDraft(ainslie, profile).includes("Is it still available?"), "Expected usable outreach draft.");

    console.log("NYC Apt Radar loop verification passed.");
    console.log(`Listings: ${listings.length}`);
    console.log(`Top listing: ${topListing.score}/100 ${topListing.title}`);
    console.log(`Commute targets: ${commutes.length}`);
    console.log("Notifications: skipped in isolated verification.");
    console.log(`Source events: ${sourceEvents.length}`);
  } finally {
    sqlite?.close();
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
