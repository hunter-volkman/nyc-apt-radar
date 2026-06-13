import type { Listing } from "./listings";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export function coordinatesForListing(listing: Listing): Coordinates | null {
  if (listing.latitude !== null && listing.longitude !== null) {
    return {
      latitude: listing.latitude,
      longitude: listing.longitude,
    };
  }

  return null;
}

export function distanceMiles(left: Coordinates, right: Coordinates) {
  const earthRadiusMiles = 3958.8;
  const leftLat = toRadians(left.latitude);
  const rightLat = toRadians(right.latitude);
  const deltaLat = toRadians(right.latitude - left.latitude);
  const deltaLng = toRadians(right.longitude - left.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(leftLat) * Math.cos(rightLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(a));
}

export function walkingMinutes(miles: number) {
  return Math.max(1, Math.round(miles * 20));
}

function toRadians(value: number) {
  return value * (Math.PI / 180);
}
