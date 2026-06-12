import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

const defaultDatabasePath = path.join(process.cwd(), "data", "apartment-radar.sqlite");
const legacyDatabasePath = path.join(process.cwd(), "data", "stoop.sqlite");

function resolveDatabasePath() {
  const configuredPath = process.env.APARTMENT_RADAR_DATABASE_PATH ?? process.env.STOOP_DATABASE_PATH;

  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(/* turbopackIgnore: true */ process.cwd(), configuredPath);
  }

  return fs.existsSync(legacyDatabasePath) ? legacyDatabasePath : defaultDatabasePath;
}

const databasePath = resolveDatabasePath();
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export const localDatabasePath = databasePath;
