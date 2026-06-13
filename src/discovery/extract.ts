import type { ListingDraft } from "../core/listings";
import type { DiscoveryDocument } from "./documents";

export function extractListingDrafts(document: DiscoveryDocument): ListingDraft[] {
  const jsonDrafts = extractFromJson(document);
  if (jsonDrafts.length) {
    return jsonDrafts;
  }

  const structuredHtmlDrafts = extractFromStructuredHtml(document);
  if (structuredHtmlDrafts.length) {
    return structuredHtmlDrafts;
  }

  throw new Error("No structured listing data found. Use StreetEasy JSON-LD, structured JSON, or URL-only intake.");
}

function extractFromJson(document: DiscoveryDocument) {
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

function listingDraftFromJson(item: Record<string, unknown>, document: DiscoveryDocument): ListingDraft | null {
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

function extractFromStructuredHtml(document: DiscoveryDocument) {
  const scripts = Array.from(document.rawText.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  if (!scripts.length) {
    return [];
  }

  const maxRent = maxRentFromSourceRef(document.sourceRef);
  const seen = new Set<string>();
  const drafts: ListingDraft[] = [];

  for (const script of scripts) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(script);
    } catch {
      continue;
    }

    for (const item of listingNodesFromJsonLd(parsed)) {
      const draft = listingDraftFromJsonLd(item, document);
      if (!draft) {
        continue;
      }

      if (maxRent !== null && draft.rent !== null && draft.rent !== undefined && draft.rent > maxRent) {
        continue;
      }

      const key = draft.sourceUrl ?? draft.title ?? "";
      if (!key || seen.has(key)) {
        continue;
      }

      seen.add(key);
      drafts.push(draft);
    }
  }

  return drafts;
}

function listingNodesFromJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.flatMap(listingNodesFromJsonLd);
  }

  if (!isRecord(value)) {
    return [];
  }

  const graph = value["@graph"];
  const nested = Array.isArray(graph) ? graph.flatMap(listingNodesFromJsonLd) : [];
  return isListingJsonLdNode(value) ? [value, ...nested] : nested;
}

function isListingJsonLdNode(value: Record<string, unknown>) {
  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  return types.some((item) => item === "Apartment" || item === "Accommodation");
}

function listingDraftFromJsonLd(item: Record<string, unknown>, document: DiscoveryDocument): ListingDraft | null {
  const sourceUrl = stringField(item, "url") ?? stringField(item, "@id");
  const title = stringField(item, "name") ?? sourceUrl;

  if (!sourceUrl && !title) {
    return null;
  }

  const address = isRecord(item.address) ? item.address : {};
  const geo = isRecord(item.geo) ? item.geo : {};

  return {
    source: document.sourceName,
    sourceUrl,
    title,
    address: title,
    neighborhood: stringField(address, "addressLocality"),
    borough: null,
    rent: rentFromJsonLd(item),
    bedrooms: numberField(item, "numberOfBedrooms"),
    bathrooms: numberField(item, "numberOfBathroomsTotal") ?? numberField(item, "numberOfFullBathrooms"),
    availableDate: null,
    description: document.sourceRef,
    amenities: [],
    pets: "unknown",
    feeStatus: "unknown",
    latitude: numberField(geo, "latitude"),
    longitude: numberField(geo, "longitude"),
    status: "new",
    firstSeenAt: null,
    lastSeenAt: null,
    contactName: null,
    appointmentAt: null,
  };
}

function rentFromJsonLd(item: Record<string, unknown>) {
  const additionalProperty = item.additionalProperty;
  if (!Array.isArray(additionalProperty)) {
    return null;
  }

  for (const property of additionalProperty) {
    if (!isRecord(property) || stringField(property, "name") !== "Monthly Rent") {
      continue;
    }

    const value = stringField(property, "value");
    if (!value) {
      continue;
    }

    const rent = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(rent) ? rent : null;
  }

  return null;
}

function maxRentFromSourceRef(sourceRef: string) {
  try {
    const decoded = decodeURIComponent(sourceRef);
    const match = /(?:^|[|/])price:-(\d+)/.exec(decoded);
    if (!match?.[1]) {
      return null;
    }

    const rent = Number(match[1]);
    return Number.isFinite(rent) ? rent : null;
  } catch {
    return null;
  }
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
