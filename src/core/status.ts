import { isListingStatus, type ListingStatus } from "./listings";

export function parseStatus(value: string): ListingStatus {
  if (!isListingStatus(value)) {
    throw new Error(`Unsupported status "${value}". Use: new, interested, contacted, scheduled, rejected, viewed, applied.`);
  }

  return value;
}
