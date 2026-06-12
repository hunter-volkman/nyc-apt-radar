import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ensureDatabase } from "@/db/ensure";
import { listingToRow, rowToListing } from "@/db/listing-mappers";
import { listingsTable } from "@/db/schema";
import { listingStatuses, type Listing, type ListingStatus } from "@/lib/types";

export type ListingDraft = {
  id?: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  rawText?: string | null;
  title: string;
  address?: string | null;
  unit?: string | null;
  neighborhood?: string | null;
  borough?: string | null;
  rentMonthly?: number | null;
  netEffectiveRent?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  squareFeet?: number | null;
  availableDate?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: ListingStatus;
  amenities?: string[];
  fees?: string[];
  redFlags?: string[];
  openQuestions?: string[];
  personalNotes?: string | null;
};

export function isListingStatus(value: string): value is ListingStatus {
  return listingStatuses.includes(value as ListingStatus);
}

export function listListings() {
  ensureDatabase();
  return db.select().from(listingsTable).orderBy(desc(listingsTable.updatedAt)).all().map(rowToListing);
}

export function getListing(id: string) {
  ensureDatabase();
  const row = db.select().from(listingsTable).where(eq(listingsTable.id, id)).get();
  return row ? rowToListing(row) : null;
}

export function createListing(draft: ListingDraft) {
  ensureDatabase();

  const now = new Date().toISOString();
  const listing: Listing = {
    id: draft.id ?? makeListingId(draft.title),
    sourceName: draft.sourceName ?? null,
    sourceUrl: draft.sourceUrl ?? null,
    rawText: draft.rawText ?? null,
    title: draft.title.trim(),
    address: draft.address ?? null,
    unit: draft.unit ?? null,
    neighborhood: draft.neighborhood ?? null,
    borough: draft.borough ?? null,
    rentMonthly: draft.rentMonthly ?? null,
    netEffectiveRent: draft.netEffectiveRent ?? null,
    bedrooms: draft.bedrooms ?? null,
    bathrooms: draft.bathrooms ?? null,
    squareFeet: draft.squareFeet ?? null,
    availableDate: draft.availableDate ?? null,
    contactName: draft.contactName ?? null,
    contactEmail: draft.contactEmail ?? null,
    contactPhone: draft.contactPhone ?? null,
    status: draft.status ?? "new",
    amenities: draft.amenities ?? [],
    fees: draft.fees ?? [],
    redFlags: draft.redFlags ?? [],
    openQuestions: draft.openQuestions ?? [],
    personalNotes: draft.personalNotes ?? null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(listingsTable).values(listingToRow(listing)).run();
  return listing;
}

export function updateListing(id: string, draft: Partial<ListingDraft>) {
  ensureDatabase();

  const current = getListing(id);
  if (!current) {
    return null;
  }

  const next: Listing = {
    ...current,
    ...draft,
    id: current.id,
    title: draft.title?.trim() || current.title,
    status: draft.status ?? current.status,
    updatedAt: new Date().toISOString(),
  };

  db.update(listingsTable).set(listingToRow(next)).where(eq(listingsTable.id, id)).run();
  return next;
}

export function updateListingStatus(id: string, status: ListingStatus) {
  ensureDatabase();

  const now = new Date().toISOString();
  db.update(listingsTable)
    .set({ status, updatedAt: now })
    .where(eq(listingsTable.id, id))
    .run();

  return getListing(id);
}

export function deleteListing(id: string) {
  ensureDatabase();
  db.delete(listingsTable).where(eq(listingsTable.id, id)).run();
}

export function clearListings() {
  ensureDatabase();
  db.delete(listingsTable).run();
}

function makeListingId(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);

  return `${slug || "listing"}-${crypto.randomUUID().slice(0, 8)}`;
}
