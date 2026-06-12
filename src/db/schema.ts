import { sql } from "drizzle-orm";
import { check, index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  ListingStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  RadarClassification,
  SourceEventStatus,
  WatchRunStatus,
  WatchRunType,
} from "@/lib/types";

export const listingsTable = sqliteTable(
  "listings",
  {
    id: text("id").primaryKey(),
    sourceName: text("source_name"),
    sourceUrl: text("source_url"),
    rawText: text("raw_text"),
    title: text("title").notNull(),
    address: text("address"),
    unit: text("unit"),
    neighborhood: text("neighborhood"),
    borough: text("borough"),
    rentMonthly: integer("rent_monthly"),
    netEffectiveRent: integer("net_effective_rent"),
    bedrooms: real("bedrooms"),
    bathrooms: real("bathrooms"),
    squareFeet: integer("square_feet"),
    availableDate: text("available_date"),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    status: text("status").$type<ListingStatus>().notNull(),
    amenities: text("amenities", { mode: "json" }).$type<string[]>().notNull(),
    fees: text("fees", { mode: "json" }).$type<string[]>().notNull(),
    redFlags: text("red_flags", { mode: "json" }).$type<string[]>().notNull(),
    openQuestions: text("open_questions", { mode: "json" }).$type<string[]>().notNull(),
    personalNotes: text("personal_notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check(
      "listings_status_check",
      sql`${table.status} in ('new', 'contacted', 'tour_scheduled', 'toured', 'applied', 'dead', 'leased')`,
    ),
  ],
);

export type ListingRow = typeof listingsTable.$inferSelect;
export type NewListingRow = typeof listingsTable.$inferInsert;

export const sourceEventsTable = sqliteTable(
  "source_events",
  {
    id: text("id").primaryKey(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url"),
    normalizedSourceUrl: text("normalized_source_url"),
    normalizedFingerprint: text("normalized_fingerprint").notNull(),
    sourceFilePath: text("source_file_path"),
    rawText: text("raw_text").notNull(),
    status: text("status").$type<SourceEventStatus>().notNull(),
    duplicateOfEventId: text("duplicate_of_event_id"),
    listingId: text("listing_id"),
    classification: text("classification").$type<RadarClassification>(),
    classificationBlockers: text("classification_blockers", { mode: "json" }).$type<string[]>().notNull(),
    errorMessage: text("error_message"),
    importedAt: text("imported_at").notNull(),
    processedAt: text("processed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    check(
      "source_events_status_check",
      sql`${table.status} in ('pending', 'processed', 'duplicate', 'failed')`,
    ),
    check(
      "source_events_classification_check",
      sql`${table.classification} IS NULL OR ${table.classification} in ('hot', 'watch', 'needs_review', 'rejected')`,
    ),
    index("source_events_status_idx").on(table.status),
    index("source_events_normalized_source_url_idx").on(table.normalizedSourceUrl),
    index("source_events_normalized_fingerprint_idx").on(table.normalizedFingerprint),
    index("source_events_source_file_path_idx").on(table.sourceFilePath),
    index("source_events_listing_id_idx").on(table.listingId),
    index("source_events_imported_at_idx").on(table.importedAt),
  ],
);

export type SourceEventRow = typeof sourceEventsTable.$inferSelect;
export type NewSourceEventRow = typeof sourceEventsTable.$inferInsert;

export const watchRunsTable = sqliteTable(
  "watch_runs",
  {
    id: text("id").primaryKey(),
    runType: text("run_type").$type<WatchRunType>().notNull(),
    status: text("status").$type<WatchRunStatus>().notNull(),
    intervalMinutes: integer("interval_minutes").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
    eventsSeen: integer("events_seen").notNull(),
    eventsImported: integer("events_imported").notNull(),
    eventsProcessed: integer("events_processed").notNull(),
    listingsCreated: integer("listings_created").notNull(),
    duplicatesFound: integer("duplicates_found").notNull(),
    notificationsCreated: integer("notifications_created").notNull(),
    errorMessage: text("error_message"),
  },
  (table) => [
    check("watch_runs_type_check", sql`${table.runType} in ('one_shot', 'watch')`),
    check("watch_runs_status_check", sql`${table.status} in ('running', 'succeeded', 'failed')`),
    index("watch_runs_started_at_idx").on(table.startedAt),
    index("watch_runs_status_idx").on(table.status),
  ],
);

export type WatchRunRow = typeof watchRunsTable.$inferSelect;
export type NewWatchRunRow = typeof watchRunsTable.$inferInsert;

export const notificationsTable = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    sourceEventId: text("source_event_id"),
    listingId: text("listing_id"),
    type: text("type").$type<NotificationType>().notNull(),
    channel: text("channel").$type<NotificationChannel>().notNull(),
    status: text("status").$type<NotificationStatus>().notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    recordedAt: text("recorded_at").notNull(),
  },
  (table) => [
    check("notifications_type_check", sql`${table.type} in ('hot_listing', 'needs_review', 'watch_failure')`),
    check("notifications_channel_check", sql`${table.channel} in ('local', 'ntfy')`),
    check("notifications_status_check", sql`${table.status} in ('recorded', 'sent', 'failed')`),
    index("notifications_dedupe_key_idx").on(table.dedupeKey),
    index("notifications_created_at_idx").on(table.createdAt),
    index("notifications_listing_id_idx").on(table.listingId),
  ],
);

export type NotificationRow = typeof notificationsTable.$inferSelect;
export type NewNotificationRow = typeof notificationsTable.$inferInsert;
