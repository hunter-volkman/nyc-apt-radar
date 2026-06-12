import { pathToFileURL } from "node:url";
import { localDatabasePath } from "../src/db/client";
import { ensureDatabase } from "../src/db/ensure";
import { clearListings, listListings } from "../src/lib/listing-repository";
import { clearRadarData } from "../src/lib/radar";

export type DatabaseSetupOptions = {
  reset?: boolean;
};

export function runDatabaseSetup({ reset = false }: DatabaseSetupOptions = {}) {
  ensureDatabase();

  if (reset) {
    clearRadarData();
    clearListings();
  }

  return {
    databasePath: localDatabasePath,
    listingCount: listListings().length,
    reset,
  };
}

function isDirectRun() {
  return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

if (isDirectRun()) {
  const result = runDatabaseSetup({ reset: process.argv.includes("--reset") });
  const action = result.reset ? "Reset" : "Initialized";

  console.log(`${action} ${result.databasePath}`);
  console.log(`${result.listingCount} listings present. No seed data was added.`);
}
