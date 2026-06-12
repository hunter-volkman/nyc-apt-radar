import { pathToFileURL } from "node:url";
import { importSourceEventsFromDirectory } from "../src/lib/radar-source-files";
import { runRadarOnce } from "../src/lib/radar";

async function main() {
  const imported = importSourceEventsFromDirectory();
  const result = await runRadarOnce({
    eventsImported: imported.eventsImported,
    runType: "one_shot",
  });

  console.log(`Scanned ${imported.sourceDirectory}.`);
  console.log(`${imported.filesSeen} source files seen.`);
  console.log(`${imported.eventsImported} source events imported.`);
  console.log(`${imported.duplicatesSkipped} source files already imported or duplicate.`);
  console.log(`Radar run ${result.status}.`);
  console.log(`${result.eventsSeen} pending source events seen.`);
  console.log(`${result.eventsProcessed} source events processed.`);
  console.log(`${result.listingsCreated} listings created.`);
  console.log(`${result.duplicatesFound} duplicates found.`);
  console.log(`${result.notificationsCreated} notifications recorded.`);

  if (result.status === "failed") {
    process.exitCode = 1;
  }
}

function isDirectRun() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Radar run failed.");
    process.exitCode = 1;
  });
}
