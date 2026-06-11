import { sqlite } from "@/db/client";

let initialized = false;

const allowedStatusSql = "'new', 'contacted', 'tour_scheduled', 'toured', 'applied', 'dead', 'leased'";
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
  migrateListingStatusConstraint();
  sqlite.exec(`
    CREATE INDEX IF NOT EXISTS listings_status_idx ON listings (status);
    CREATE INDEX IF NOT EXISTS listings_updated_at_idx ON listings (updated_at);
  `);

  initialized = true;
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
