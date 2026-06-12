import "../src/config/env";
import { runDiscoveryOnce } from "../src/discovery/agent-loop";
import { loadSourceConfigs } from "../src/discovery/sources";

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const notify = !process.argv.includes("--no-notify");
  const result = await runDiscoveryOnce({ notify });
  const sources = loadSourceConfigs();

  console.log(`Discovery checked ${result.sourcesChecked} source${result.sourcesChecked === 1 ? "" : "s"}.`);
  for (const source of sources) {
    console.log(`- ${source.id}: ${source.type} ${source.path ?? source.url ?? ""}`.trim());
  }
  console.log(`Documents seen: ${result.documentsSeen}`);
  console.log(`Duplicate documents: ${result.duplicateDocuments}`);
  console.log(`Listings found: ${result.listingsFound}`);
  console.log(`Listings saved: ${result.listingsSaved.length}`);
  console.log(`Notifications sent: ${result.notificationsSent}`);
  console.log(`Notifications failed: ${result.notificationsFailed}`);

  if (result.errors.length) {
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }
}
