import { sql } from "drizzle-orm";
import { check, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { ListingStatus } from "@/lib/types";

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
