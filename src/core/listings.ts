export const listingStatuses = [
  "new",
  "interested",
  "contacted",
  "scheduled",
  "rejected",
  "viewed",
  "applied",
] as const;

export type ListingStatus = (typeof listingStatuses)[number];

export const statusLabels: Record<ListingStatus, string> = {
  new: "New",
  interested: "Interested",
  contacted: "Contacted",
  scheduled: "Scheduled",
  rejected: "Rejected",
  viewed: "Viewed",
  applied: "Applied",
};

export type PetsPolicy = "cats_allowed" | "dogs_allowed" | "cats_and_dogs_allowed" | "no_pets" | "unknown";
export type FeeStatus = "no_fee" | "broker_fee" | "unknown";

export type ListingDraft = {
  id?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  title?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  borough?: string | null;
  rent?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  availableDate?: string | null;
  description?: string | null;
  amenities?: string[] | null;
  pets?: PetsPolicy | null;
  feeStatus?: FeeStatus | null;
  latitude?: number | null;
  longitude?: number | null;
  status?: ListingStatus | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  contactName?: string | null;
  appointmentAt?: string | null;
};

export type Listing = {
  id: string;
  source: string;
  sourceUrl: string | null;
  title: string;
  address: string | null;
  neighborhood: string | null;
  borough: string | null;
  rent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  availableDate: string | null;
  description: string;
  amenities: string[];
  pets: PetsPolicy;
  feeStatus: FeeStatus;
  latitude: number | null;
  longitude: number | null;
  status: ListingStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  score: number;
  scoreExplanation: string;
  contactName: string | null;
  appointmentAt: string | null;
};

export function isListingStatus(value: string): value is ListingStatus {
  return listingStatuses.includes(value as ListingStatus);
}

export function isFeeStatus(value: string): value is FeeStatus {
  return value === "no_fee" || value === "broker_fee" || value === "unknown";
}

export function isPetsPolicy(value: string): value is PetsPolicy {
  return (
    value === "cats_allowed"
    || value === "dogs_allowed"
    || value === "cats_and_dogs_allowed"
    || value === "no_pets"
    || value === "unknown"
  );
}
