import { pathToFileURL } from "node:url";
import { runRadarOnce } from "../src/lib/radar";

async function main() {
  const result = await runRadarOnce({ runType: "one_shot" });

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
