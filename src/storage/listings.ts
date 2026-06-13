import { sqlite, ensureDatabase } from "./database";
import type { Listing, ListingDraft, ListingStatus } from "../core/listings";
import { cleanDate, cleanDateTime, cleanList, cleanNumber, cleanString, finalizeListing } from "../core/finalize-listing";
import { defaultPreferenceProfile, type PreferenceProfile } from "../core/preferences";
import { rankListings } from "../core/ranking";
import { scoreAndExplain } from "../core/scoring";

type ListingRow = {
  id: string;
  source: string;
  source_url: string | null;
  title: string;
  address: string | null;
  neighborhood: string | null;
  borough: string | null;
  rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  available_date: string | null;
  description: string;
  amenities: string;
  pets: Listing["pets"];
  fee_status: Listing["feeStatus"];
  latitude: number | null;
  longitude: number | null;
  status: ListingStatus;
  first_seen_at: string;
  last_seen_at: string;
  score: number;
  score_explanation: string;
  contact_name: string | null;
  appointment_at: string | null;
};

export function listListings() {
  ensureDatabase();
  const rows = sqlite.prepare("SELECT * FROM listings").all() as ListingRow[];
  return rows.map(rowToListing);
}

export function listRankedListings(profile = defaultPreferenceProfile, now = new Date()) {
  const rescored = listListings().map((listing) => saveListing(scoreAndExplain(listing, profile, now)));
  return rankListings(rescored);
}

export function getListing(id: string) {
  ensureDatabase();
  const row = sqlite.prepare("SELECT * FROM listings WHERE id = ?").get(id) as ListingRow | undefined;
  return row ? rowToListing(row) : null;
}

export function addListing(draft: ListingDraft, profile: PreferenceProfile = defaultPreferenceProfile, now = new Date()) {
  const listing = scoreAndExplain(finalizeListing(draft, now), profile, now);
  return saveListing(listing);
}

export function upsertListing(draft: ListingDraft, profile: PreferenceProfile = defaultPreferenceProfile, now = new Date()) {
  const normalized = finalizeListing(draft, now);
  const existing = getListing(normalized.id);
  const listing = scoreAndExplain(
    {
      ...normalized,
      status: existing?.status ?? normalized.status,
      firstSeenAt: existing?.firstSeenAt ?? normalized.firstSeenAt,
    },
    profile,
    now,
  );

  return saveListing(listing);
}

export function saveListing(listing: Listing) {
  ensureDatabase();
  sqlite.prepare(`
    INSERT INTO listings (
      id,
      source,
      source_url,
      title,
      address,
      neighborhood,
      borough,
      rent,
      bedrooms,
      bathrooms,
      available_date,
      description,
      amenities,
      pets,
      fee_status,
      latitude,
      longitude,
      status,
      first_seen_at,
      last_seen_at,
      score,
      score_explanation,
      contact_name,
      appointment_at
    ) VALUES (
      @id,
      @source,
      @sourceUrl,
      @title,
      @address,
      @neighborhood,
      @borough,
      @rent,
      @bedrooms,
      @bathrooms,
      @availableDate,
      @description,
      @amenities,
      @pets,
      @feeStatus,
      @latitude,
      @longitude,
      @status,
      @firstSeenAt,
      @lastSeenAt,
      @score,
      @scoreExplanation,
      @contactName,
      @appointmentAt
    )
    ON CONFLICT(id) DO UPDATE SET
      source = excluded.source,
      source_url = excluded.source_url,
      title = excluded.title,
      address = excluded.address,
      neighborhood = excluded.neighborhood,
      borough = excluded.borough,
      rent = excluded.rent,
      bedrooms = excluded.bedrooms,
      bathrooms = excluded.bathrooms,
      available_date = excluded.available_date,
      description = excluded.description,
      amenities = excluded.amenities,
      pets = excluded.pets,
      fee_status = excluded.fee_status,
      latitude = excluded.latitude,
      longitude = excluded.longitude,
      status = excluded.status,
      first_seen_at = excluded.first_seen_at,
      last_seen_at = excluded.last_seen_at,
      score = excluded.score,
      score_explanation = excluded.score_explanation,
      contact_name = excluded.contact_name,
      appointment_at = excluded.appointment_at
  `).run(listingToParams(listing));

  return listing;
}

export function updateListingStatus(id: string, status: ListingStatus) {
  ensureDatabase();
  const existing = getListing(id);

  if (!existing) {
    throw new Error(`Listing not found: ${id}`);
  }

  const next = saveListing({
    ...existing,
    status,
    lastSeenAt: new Date().toISOString(),
  });

  return next;
}

export type ListingFactUpdate = Partial<ListingDraft> & {
  notes?: string | null;
};

export function updateListingFacts(
  id: string,
  updates: ListingFactUpdate,
  profile: PreferenceProfile = defaultPreferenceProfile,
  now = new Date(),
) {
  ensureDatabase();
  const existing = getListing(id);

  if (!existing) {
    throw new Error(`Listing not found: ${id}`);
  }

  const next: Listing = {
    ...existing,
    source: stringUpdate(updates.source, existing.source),
    sourceUrl: nullableStringUpdate(updates.sourceUrl, existing.sourceUrl),
    title: stringUpdate(updates.title, existing.title),
    address: nullableStringUpdate(updates.address, existing.address),
    neighborhood: nullableStringUpdate(updates.neighborhood, existing.neighborhood),
    borough: nullableStringUpdate(updates.borough, existing.borough),
    rent: nullableNumberUpdate(updates.rent, existing.rent),
    bedrooms: nullableNumberUpdate(updates.bedrooms, existing.bedrooms),
    bathrooms: nullableNumberUpdate(updates.bathrooms, existing.bathrooms),
    availableDate: nullableDateUpdate(updates.availableDate, existing.availableDate),
    description: descriptionUpdate(existing.description, updates.description, updates.notes, now),
    amenities: updates.amenities === undefined ? existing.amenities : cleanList(updates.amenities),
    pets: updates.pets ?? existing.pets,
    feeStatus: updates.feeStatus ?? existing.feeStatus,
    latitude: nullableNumberUpdate(updates.latitude, existing.latitude),
    longitude: nullableNumberUpdate(updates.longitude, existing.longitude),
    status: updates.status ?? existing.status,
    lastSeenAt: now.toISOString(),
    contactName: nullableStringUpdate(updates.contactName, existing.contactName),
    appointmentAt: nullableDateTimeUpdate(updates.appointmentAt, existing.appointmentAt),
  };

  return saveListing(scoreAndExplain(next, profile, now));
}

export function clearListings() {
  ensureDatabase();
  sqlite.prepare("DELETE FROM listings").run();
}

function stringUpdate(value: string | null | undefined, existingValue: string) {
  return value === undefined ? existingValue : cleanString(value) ?? existingValue;
}

function nullableStringUpdate(value: string | null | undefined, existingValue: string | null) {
  return value === undefined ? existingValue : cleanString(value);
}

function nullableNumberUpdate(value: number | string | null | undefined, existingValue: number | null) {
  return value === undefined ? existingValue : cleanNumber(value);
}

function nullableDateUpdate(value: string | null | undefined, existingValue: string | null) {
  return value === undefined ? existingValue : cleanDate(value);
}

function nullableDateTimeUpdate(value: string | null | undefined, existingValue: string | null) {
  return value === undefined ? existingValue : cleanDateTime(value);
}

function descriptionUpdate(
  existing: string,
  description: string | null | undefined,
  notes: string | null | undefined,
  now: Date,
) {
  const base = description === undefined ? existing : cleanString(description) ?? "";
  const cleanedNotes = cleanString(notes);

  if (!cleanedNotes) {
    return base;
  }

  return [base, `[${now.toISOString()}] ${cleanedNotes}`].filter(Boolean).join("\n");
}

function listingToParams(listing: Listing) {
  return {
    ...listing,
    amenities: JSON.stringify(listing.amenities),
  };
}

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    address: row.address,
    neighborhood: row.neighborhood,
    borough: row.borough,
    rent: row.rent,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    availableDate: row.available_date,
    description: row.description,
    amenities: parseJsonList(row.amenities),
    pets: row.pets,
    feeStatus: row.fee_status,
    latitude: row.latitude,
    longitude: row.longitude,
    status: row.status,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    score: row.score,
    scoreExplanation: row.score_explanation,
    contactName: row.contact_name,
    appointmentAt: row.appointment_at,
  };
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
