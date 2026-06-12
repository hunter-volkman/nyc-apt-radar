import type { ListingDraft } from "../core/listings";
import { extractListingDraftsWithOpenAI } from "../core/openai-extract";
import type { SourceDocument } from "./sources";

export async function extractListingDrafts(document: SourceDocument): Promise<ListingDraft[]> {
  const jsonDrafts = extractFromJson(document);
  if (jsonDrafts.length) {
    return jsonDrafts;
  }

  return extractListingDraftsWithOpenAI(document.rawText);
}

function extractFromJson(document: SourceDocument) {
  try {
    const parsed = JSON.parse(document.rawText) as unknown;
    const items = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.listings)
        ? parsed.listings
        : isRecord(parsed)
          ? [parsed]
          : [];

    return items
      .filter(isRecord)
      .map((item) => listingDraftFromJson(item, document))
      .filter((listing) => listing !== null);
  } catch {
    return [];
  }
}

function listingDraftFromJson(item: Record<string, unknown>, document: SourceDocument): ListingDraft | null {
  const title = stringField(item, "title") ?? stringField(item, "name") ?? stringField(item, "address");
  const sourceUrl = stringField(item, "sourceUrl") ?? stringField(item, "source_url") ?? stringField(item, "url");
  const rent = numberField(item, "rent") ?? numberField(item, "rentMonthly") ?? numberField(item, "price");

  if (!title && !sourceUrl && rent === null) {
    return null;
  }

  return {
    id: stringField(item, "id"),
    source: stringField(item, "source") ?? document.sourceName,
    sourceUrl,
    title,
    address: stringField(item, "address"),
    neighborhood: stringField(item, "neighborhood"),
    borough: stringField(item, "borough"),
    rent,
    bedrooms: numberField(item, "bedrooms") ?? numberField(item, "beds"),
    bathrooms: numberField(item, "bathrooms") ?? numberField(item, "baths"),
    availableDate: stringField(item, "availableDate") ?? stringField(item, "available_date"),
    description: stringField(item, "description") ?? document.sourceRef,
    amenities: arrayField(item, "amenities"),
    pets: stringField(item, "pets") as ListingDraft["pets"],
    feeStatus: (stringField(item, "feeStatus") ?? stringField(item, "fee_status")) as ListingDraft["feeStatus"],
    latitude: numberField(item, "latitude") ?? numberField(item, "lat"),
    longitude: numberField(item, "longitude") ?? numberField(item, "lng"),
    status: stringField(item, "status") as ListingDraft["status"],
    firstSeenAt: stringField(item, "firstSeenAt") ?? stringField(item, "first_seen_at"),
    lastSeenAt: stringField(item, "lastSeenAt") ?? stringField(item, "last_seen_at"),
    contactName: stringField(item, "contactName") ?? stringField(item, "contact_name") ?? stringField(item, "broker"),
    appointmentAt: stringField(item, "appointmentAt") ?? stringField(item, "appointment_at") ?? stringField(item, "appointment"),
  };
}

function stringField(item: Record<string, unknown>, key: string) {
  const value = item[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberField(item: Record<string, unknown>, key: string) {
  const value = item[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[$,]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function arrayField(item: Record<string, unknown>, key: string) {
  const value = item[key];
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
