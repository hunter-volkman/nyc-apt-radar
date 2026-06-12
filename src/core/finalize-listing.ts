import { createHash } from "node:crypto";
import {
  isFeeStatus,
  isListingStatus,
  isPetsPolicy,
  type Listing,
  type ListingDraft,
} from "./listings";

export function finalizeListing(draft: ListingDraft, now = new Date()): Listing {
  const title = cleanString(draft.title) ?? cleanString(draft.address) ?? "Untitled listing";
  const firstSeenAt = cleanDateTime(draft.firstSeenAt) ?? now.toISOString();
  const lastSeenAt = cleanDateTime(draft.lastSeenAt) ?? firstSeenAt;
  const sourceUrl = cleanString(draft.sourceUrl);

  return {
    id: cleanString(draft.id) ?? makeListingId(title, sourceUrl),
    source: cleanString(draft.source) ?? "manual",
    sourceUrl,
    title,
    address: cleanString(draft.address),
    neighborhood: cleanString(draft.neighborhood),
    borough: cleanString(draft.borough),
    rent: cleanNumber(draft.rent),
    bedrooms: cleanNumber(draft.bedrooms),
    bathrooms: cleanNumber(draft.bathrooms),
    availableDate: cleanDate(draft.availableDate),
    description: cleanString(draft.description) ?? "",
    amenities: cleanList(draft.amenities),
    pets: draft.pets && isPetsPolicy(draft.pets) ? draft.pets : "unknown",
    feeStatus: draft.feeStatus && isFeeStatus(draft.feeStatus) ? draft.feeStatus : "unknown",
    latitude: cleanNumber(draft.latitude),
    longitude: cleanNumber(draft.longitude),
    status: draft.status && isListingStatus(draft.status) ? draft.status : "new",
    firstSeenAt,
    lastSeenAt,
    score: 0,
    scoreExplanation: "Not scored yet.",
    contactName: cleanString(draft.contactName),
    appointmentAt: cleanDateTime(draft.appointmentAt),
  };
}

export function cleanString(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export function cleanNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

export function cleanDate(value: string | null | undefined) {
  const cleaned = cleanString(value);
  return cleaned && /^\d{4}-\d{2}-\d{2}$/.test(cleaned) ? cleaned : null;
}

export function cleanDateTime(value: string | null | undefined) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function cleanList(values: string[] | null | undefined) {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function makeListingId(title: string, sourceUrl: string | null) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const hash = createHash("sha1").update(`${title}:${sourceUrl ?? ""}`).digest("hex").slice(0, 8);

  return `${slug || "listing"}-${hash}`;
}
