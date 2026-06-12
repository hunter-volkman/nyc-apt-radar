import { setTimeout } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { importSourceEventsFromDirectory } from "../src/lib/radar-source-files";
import {
  getRadarWatchIntervalMinutes,
  runRadarOnce,
} from "../src/lib/radar";

async function main() {
  const intervalMinutes = getRadarWatchIntervalMinutes();
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`Radar watch started. Polling every ${intervalMinutes} minute${intervalMinutes === 1 ? "" : "s"}.`);

  while (true) {
    const imported = importSourceEventsFromDirectory();
    const result = await runRadarOnce({
      eventsImported: imported.eventsImported,
      runType: "watch",
      intervalMinutes,
    });

    console.log(
      [
        new Date().toISOString(),
        `status=${result.status}`,
        `files=${imported.filesSeen}`,
        `imported=${imported.eventsImported}`,
        `seen=${result.eventsSeen}`,
        `processed=${result.eventsProcessed}`,
        `created=${result.listingsCreated}`,
        `duplicates=${result.duplicatesFound}`,
        `notifications=${result.notificationsCreated}`,
      ].join(" "),
    );

    await setTimeout(intervalMs);
  }
}

function isDirectRun() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isDirectRun()) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Radar watch failed.");
    process.exitCode = 1;
  });
}
