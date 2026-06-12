import { sqlite } from "@/db/client";

let initialized = false;

const allowedStatusSql = "'new', 'contacted', 'tour_scheduled', 'toured', 'applied', 'dead', 'leased'";
const allowedSourceEventStatusSql = "'pending', 'processed', 'duplicate', 'failed'";
const allowedRadarClassificationSql = "'hot', 'watch', 'needs_review', 'rejected'";
const allowedWatchRunTypeSql = "'one_shot', 'watch'";
const allowedWatchRunStatusSql = "'running', 'succeeded', 'failed'";
const allowedNotificationTypeSql = "'hot_listing', 'needs_review', 'watch_failure'";
const allowedNotificationChannelSql = "'local', 'ntfy'";
const allowedNotificationStatusSql = "'recorded', 'sent', 'failed'";
const listingColumns = `
  id,
  source_name,
  source_url,
  raw_text,
  title,
  address,
  unit,
  neighborhood,
  borough,
  rent_monthly,
  net_effective_rent,
  bedrooms,
  bathrooms,
  square_feet,
  available_date,
  contact_name,
  contact_email,
  contact_phone,
  status,
  amenities,
  fees,
  red_flags,
  open_questions,
  personal_notes,
  created_at,
  updated_at
`;

export function ensureDatabase() {
  if (initialized) {
    return;
  }

  sqlite.exec(createListingsTableSql("listings", true));
  sqlite.exec(createSourceEventsTableSql());
  sqlite.exec(createWatchRunsTableSql());
  sqlite.exec(createNotificationsTableSql());
  migrateListingStatusConstraint();
  ensureColumn("source_events", "source_file_path", "TEXT");
  ensureColumn("notifications", "error_message", "TEXT");
  migrateNotificationConstraint();
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);
    CREATE INDEX IF NOT EXISTS listings_updated_at_idx ON listings (updated_at);
    CREATE INDEX IF NOT EXISTS source_events_status_idx ON source_events (status);
      CREATE INDEX IF NOT EXISTS source_events_normalized_source_url_idx ON source_events (normalized_source_url);
      CREATE INDEX IF NOT EXISTS source_events_normalized_fingerprint_idx ON source_events (normalized_fingerprint);
      CREATE INDEX IF NOT EXISTS source_events_source_file_path_idx ON source_events (source_file_path);
      CREATE INDEX IF NOT EXISTS source_events_listing_id_idx ON source_events (listing_id);
    CREATE INDEX IF NOT EXISTS source_events_imported_at_idx ON source_events (imported_at);
    CREATE INDEX IF NOT EXISTS watch_runs_started_at_idx ON watch_runs (started_at);
    CREATE INDEX IF NOT EXISTS watch_runs_status_idx ON watch_runs (status);
    CREATE INDEX IF NOT EXISTS notifications_dedupe_key_idx ON notifications (dedupe_key);
    CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at);
    CREATE INDEX IF NOT EXISTS notifications_listing_id_idx ON notifications (listing_id);
  `);

  initialized = true;
}

function ensureColumn(tableName: string, columnName: string, definition: string) {
  const rows = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;

  if (rows.some((row) => row.name === columnName)) {
    return;
  }

  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
}

function migrateListingStatusConstraint() {
  const table = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'listings'")
    .get() as { sql: string | null } | undefined;

  if (!table?.sql || table.sql.includes("listings_status_check")) {
    return;
  }

  const invalid = sqlite
    .prepare(`SELECT COUNT(*) AS count FROM listings WHERE status NOT IN (${allowedStatusSql})`)
    .get() as { count: number };

  if (invalid.count > 0) {
    throw new Error("Cannot migrate listings table because it contains unsupported listing statuses.");
  }

  const migrate = sqlite.transaction(() => {
    sqlite.exec(`
      DROP TABLE IF EXISTS listings_next;
      ${createListingsTableSql("listings_next", false)}
      INSERT INTO listings_next (${listingColumns})
      SELECT ${listingColumns} FROM listings;
      DROP TABLE listings;
      ALTER TABLE listings_next RENAME TO listings;
    `);
  });

  migrate();
}

function migrateNotificationConstraint() {
  const table = sqlite
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'notifications'")
    .get() as { sql: string | null } | undefined;

  if (!table?.sql || table.sql.includes("'ntfy'")) {
    return;
  }

  const migrate = sqlite.transaction(() => {
    sqlite.exec(`
      DROP TABLE IF EXISTS notifications_next;
      ${createNotificationsTableSql("notifications_next", false)}
      INSERT INTO notifications_next (
        id,
        source_event_id,
        listing_id,
        type,
        channel,
        status,
        title,
        body,
        dedupe_key,
        error_message,
        created_at,
        recorded_at
      )
      SELECT
        id,
        source_event_id,
        listing_id,
        type,
        channel,
        status,
        title,
        body,
        dedupe_key,
        error_message,
        created_at,
        recorded_at
      FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_next RENAME TO notifications;
    `);
  });

  migrate();
}

function createListingsTableSql(tableName: string, ifNotExists: boolean) {
  return `
    CREATE TABLE ${ifNotExists ? "IF NOT EXISTS " : ""}${tableName} (
      id TEXT PRIMARY KEY NOT NULL,
      source_name TEXT,
      source_url TEXT,
      raw_text TEXT,
      title TEXT NOT NULL,
      address TEXT,
      unit TEXT,
      neighborhood TEXT,
      borough TEXT,
      rent_monthly INTEGER,
      net_effective_rent INTEGER,
      bedrooms REAL,
      bathrooms REAL,
      square_feet INTEGER,
      available_date TEXT,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      status TEXT NOT NULL,
      amenities TEXT NOT NULL DEFAULT '[]',
      fees TEXT NOT NULL DEFAULT '[]',
      red_flags TEXT NOT NULL DEFAULT '[]',
      open_questions TEXT NOT NULL DEFAULT '[]',
      personal_notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CONSTRAINT listings_status_check CHECK (status IN (${allowedStatusSql}))
    );
  `;
}

function createSourceEventsTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS source_events (
      id TEXT PRIMARY KEY NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT,
      normalized_source_url TEXT,
      normalized_fingerprint TEXT NOT NULL,
      source_file_path TEXT,
      raw_text TEXT NOT NULL,
      status TEXT NOT NULL,
      duplicate_of_event_id TEXT,
      listing_id TEXT,
      classification TEXT,
      classification_blockers TEXT NOT NULL DEFAULT '[]',
      error_message TEXT,
      imported_at TEXT NOT NULL,
      processed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CONSTRAINT source_events_status_check CHECK (status IN (${allowedSourceEventStatusSql})),
      CONSTRAINT source_events_classification_check CHECK (
        classification IS NULL OR classification IN (${allowedRadarClassificationSql})
      )
    );
  `;
}

function createWatchRunsTableSql() {
  return `
    CREATE TABLE IF NOT EXISTS watch_runs (
      id TEXT PRIMARY KEY NOT NULL,
      run_type TEXT NOT NULL,
      status TEXT NOT NULL,
      interval_minutes INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      finished_at TEXT,
      events_seen INTEGER NOT NULL DEFAULT 0,
      events_imported INTEGER NOT NULL DEFAULT 0,
      events_processed INTEGER NOT NULL DEFAULT 0,
      listings_created INTEGER NOT NULL DEFAULT 0,
      duplicates_found INTEGER NOT NULL DEFAULT 0,
      notifications_created INTEGER NOT NULL DEFAULT 0,
      error_message TEXT,
      CONSTRAINT watch_runs_type_check CHECK (run_type IN (${allowedWatchRunTypeSql})),
      CONSTRAINT watch_runs_status_check CHECK (status IN (${allowedWatchRunStatusSql}))
    );
  `;
}

function createNotificationsTableSql(tableName = "notifications", ifNotExists = true) {
  return `
    CREATE TABLE ${ifNotExists ? "IF NOT EXISTS " : ""}${tableName} (
      id TEXT PRIMARY KEY NOT NULL,
      source_event_id TEXT,
      listing_id TEXT,
      type TEXT NOT NULL,
      channel TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      dedupe_key TEXT NOT NULL,
      error_message TEXT,
      created_at TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      CONSTRAINT notifications_type_check CHECK (type IN (${allowedNotificationTypeSql})),
      CONSTRAINT notifications_channel_check CHECK (channel IN (${allowedNotificationChannelSql})),
      CONSTRAINT notifications_status_check CHECK (status IN (${allowedNotificationStatusSql}))
    );
  `;
}
