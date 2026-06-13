import "../src/config/env";
import { loadPreferenceProfile } from "../src/core/preferences";
import { getRadarReadiness } from "../src/diagnostics/readiness";
import { runDiscoveryOnce } from "../src/discovery/agent-loop";
import { listRankedListings } from "../src/storage/listings";

const noNotify = process.argv.includes("--no-notify");

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const readiness = getRadarReadiness({ requireNtfy: !noNotify });
  const failures = readiness.checks.filter((check) => check.status === "fail");

  console.log(`NYC Apt Radar agent run preflight ${readiness.ready ? "ready" : "needs attention"}`);
  console.log(`StreetEasy searches: ${readiness.searchCount}; commute targets: ${readiness.commuteTargetCount}; database: ${readiness.databasePath}`);

  if (noNotify) {
    console.log("Live ntfy delivery disabled; notification decisions will be recorded as skipped.");
  }

  for (const check of readiness.checks.filter((candidate) => candidate.status !== "ok")) {
    console.log(`${check.status.toUpperCase()} ${check.name}: ${check.detail}`);
  }

  if (failures.length) {
    console.error("");
    console.error("Preflight failed:");
    for (const failure of failures) {
      console.error(`- ${failure.name}: ${failure.detail}`);
    }
    console.error(`Next: ${readiness.nextCommand}`);
    process.exit(1);
  }

  const result = await runDiscoveryOnce({
    notificationMode: noNotify ? "dry-run" : "send",
  });
  const profile = loadPreferenceProfile();
  const listings = listRankedListings(profile);

  console.log("");
  console.log("Agent run summary");
  console.log(`StreetEasy searches checked: ${result.searchesChecked}`);
  console.log(`Documents seen: ${result.documentsSeen}`);
  console.log(`Duplicate documents: ${result.duplicateDocuments}`);
  console.log(`Listings found: ${result.listingsFound}`);
  console.log(`Listings saved: ${result.listingsSaved.length}`);
  console.log(`Ranked listings: ${listings.length}`);
  console.log(`Notifications sent: ${result.notificationsSent}`);
  console.log(`Notifications skipped: ${result.notificationsSkipped}`);
  console.log(`Notifications failed: ${result.notificationsFailed}`);

  if (listings[0]) {
    console.log(`Top listing: ${listings[0].score}/100 ${listings[0].title}`);
  }

  if (result.errors.length) {
    console.log("");
    console.log("Recorded issues:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }

  console.log("");
  console.log("Next: npm run radar");
}
