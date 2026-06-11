import { isListingStatus, type ListingDraft } from "@/lib/listing-repository";

type JsonRecord = Record<string, unknown>;

export function parseListingDraft(input: unknown): ListingDraft {
  const record = requireRecord(input);
  const title = readString(record.title);

  if (!title) {
    throw new Error("Listing title is required.");
  }

  return {
    id: readString(record.id) ?? undefined,
    sourceName: readString(record.sourceName),
    sourceUrl: readString(record.sourceUrl),
    rawText: readString(record.rawText),
    title,
    address: readString(record.address),
    unit: readString(record.unit),
    neighborhood: readString(record.neighborhood),
    borough: readString(record.borough),
    rentMonthly: readNumber(record.rentMonthly),
    netEffectiveRent: readNumber(record.netEffectiveRent),
    bedrooms: readNumber(record.bedrooms),
    bathrooms: readNumber(record.bathrooms),
    squareFeet: readNumber(record.squareFeet),
    availableDate: readString(record.availableDate),
    contactName: readString(record.contactName),
    contactEmail: readString(record.contactEmail),
    contactPhone: readString(record.contactPhone),
    status: readStatus(record.status),
    amenities: readStringArray(record.amenities),
    fees: readStringArray(record.fees),
    redFlags: readStringArray(record.redFlags),
    openQuestions: readStringArray(record.openQuestions),
    personalNotes: readString(record.personalNotes),
  };
}

export function parseListingPatch(input: unknown): Partial<ListingDraft> {
  const record = requireRecord(input);
  const patch: Partial<ListingDraft> = {};

  assignString(patch, "sourceName", record.sourceName);
  assignString(patch, "sourceUrl", record.sourceUrl);
  assignString(patch, "rawText", record.rawText);
  assignString(patch, "title", record.title);
  assignString(patch, "address", record.address);
  assignString(patch, "unit", record.unit);
  assignString(patch, "neighborhood", record.neighborhood);
  assignString(patch, "borough", record.borough);
  assignString(patch, "availableDate", record.availableDate);
  assignString(patch, "contactName", record.contactName);
  assignString(patch, "contactEmail", record.contactEmail);
  assignString(patch, "contactPhone", record.contactPhone);
  assignString(patch, "personalNotes", record.personalNotes);
  assignNumber(patch, "rentMonthly", record.rentMonthly);
  assignNumber(patch, "netEffectiveRent", record.netEffectiveRent);
  assignNumber(patch, "bedrooms", record.bedrooms);
  assignNumber(patch, "bathrooms", record.bathrooms);
  assignNumber(patch, "squareFeet", record.squareFeet);

  if ("status" in record) {
    patch.status = readStatus(record.status);
  }

  assignStringArray(patch, "amenities", record.amenities);
  assignStringArray(patch, "fees", record.fees);
  assignStringArray(patch, "redFlags", record.redFlags);
  assignStringArray(patch, "openQuestions", record.openQuestions);

  return patch;
}

function requireRecord(input: unknown): JsonRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Request body must be a JSON object.");
  }

  return input as JsonRecord;
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readStatus(value: unknown) {
  const status = readString(value);

  if (!status) {
    return undefined;
  }

  if (!isListingStatus(status)) {
    throw new Error(`Unsupported listing status: ${status}`);
  }

  return status;
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []));
  }

  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function assignString<T extends keyof ListingDraft>(patch: Partial<ListingDraft>, key: T, value: unknown) {
  if (value !== undefined) {
    patch[key] = readString(value) as Partial<ListingDraft>[T];
  }
}

function assignNumber<T extends keyof ListingDraft>(patch: Partial<ListingDraft>, key: T, value: unknown) {
  if (value !== undefined) {
    patch[key] = readNumber(value) as Partial<ListingDraft>[T];
  }
}

function assignStringArray<T extends keyof ListingDraft>(patch: Partial<ListingDraft>, key: T, value: unknown) {
  if (value !== undefined) {
    patch[key] = readStringArray(value) as Partial<ListingDraft>[T];
  }
}
