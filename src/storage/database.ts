import Database from "better-sqlite3";
import path from "node:path";
import { applyOwnerOnlyFilePermissions, ensureOwnerOnlyDirectory, ensureRuntimeDataPermissions } from "./permissions";

const defaultDatabasePath = path.join(process.cwd(), "data", "nyc-apt-radar-loop.sqlite");

export function getDatabasePath() {
  const configured = process.env.NYC_APT_RADAR_DATABASE_PATH;
  return configured
    ? path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured)
    : defaultDatabasePath;
}

const databasePath = getDatabasePath();
ensureRuntimeDataPermissions(databasePath);

export const sqlite = new Database(databasePath);
sqlite.pragma("journal_mode = WAL");
ensureRuntimeDataPermissions(databasePath);

export function ensureDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS listings (
      id TEXT PRIMARY KEY NOT NULL,
      source TEXT NOT NULL,
      source_url TEXT,
      title TEXT NOT NULL,
      address TEXT,
      neighborhood TEXT,
      borough TEXT,
      rent INTEGER,
      bedrooms REAL,
      bathrooms REAL,
      available_date TEXT,
      description TEXT NOT NULL,
      amenities TEXT NOT NULL,
      pets TEXT NOT NULL,
      fee_status TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      status TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      score INTEGER NOT NULL,
      score_explanation TEXT NOT NULL,
      contact_name TEXT,
      appointment_at TEXT,
      CHECK (status IN ('new', 'interested', 'contacted', 'scheduled', 'rejected', 'viewed', 'applied')),
      CHECK (pets IN ('cats_allowed', 'dogs_allowed', 'cats_and_dogs_allowed', 'no_pets', 'unknown')),
      CHECK (fee_status IN ('no_fee', 'broker_fee', 'unknown'))
    );

    CREATE INDEX IF NOT EXISTS listings_score_idx ON listings (score);
    CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);
    CREATE INDEX IF NOT EXISTS listings_last_seen_at_idx ON listings (last_seen_at);

    CREATE TABLE IF NOT EXISTS source_events (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_ref TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      status TEXT NOT NULL,
      listings_found INTEGER NOT NULL,
      error_message TEXT,
      discovered_at TEXT NOT NULL,
      processed_at TEXT,
      UNIQUE (fingerprint)
    );

    CREATE INDEX IF NOT EXISTS source_events_discovered_at_idx ON source_events (discovered_at);
    CREATE INDEX IF NOT EXISTS source_events_status_idx ON source_events (status);

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      listing_id TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT,
      UNIQUE (dedupe_key)
    );

    CREATE INDEX IF NOT EXISTS notifications_listing_id_idx ON notifications (listing_id);
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at);
  `);
  ensureRuntimeDataPermissions(databasePath);
}

export async function backupDatabase(destinationPath: string) {
  ensureDatabase();
  ensureOwnerOnlyDirectory(path.dirname(destinationPath));
  await sqlite.backup(destinationPath);
  applyOwnerOnlyFilePermissions(destinationPath);
  return destinationPath;
}
