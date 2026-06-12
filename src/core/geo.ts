import type { Listing } from "./listings";

export type Coordinates = {
  latitude: number;
  longitude: number;
};

type KnownPlace = Coordinates & {
  matchers: string[];
};

const knownPlaces: KnownPlace[] = [
  {
    matchers: ["392 broadway"],
    latitude: 40.7069,
    longitude: -73.9535,
  },
  {
    matchers: ["56 ainslie", "ainslie street"],
    latitude: 40.7124,
    longitude: -73.9508,
  },
  {
    matchers: ["345 w 30", "345 west 30"],
    latitude: 40.7502,
    longitude: -73.9970,
  },
  {
    matchers: ["williamsburg"],
    latitude: 40.7128,
    longitude: -73.9560,
  },
  {
    matchers: ["chelsea"],
    latitude: 40.7465,
    longitude: -74.0014,
  },
  {
    matchers: ["fort greene"],
    latitude: 40.6907,
    longitude: -73.9749,
  },
  {
    matchers: ["clinton hill"],
    latitude: 40.6896,
    longitude: -73.9646,
  },
  {
    matchers: ["prospect heights"],
    latitude: 40.6774,
    longitude: -73.9692,
  },
  {
    matchers: ["park slope"],
    latitude: 40.6728,
    longitude: -73.9778,
  },
  {
    matchers: ["astoria"],
    latitude: 40.7644,
    longitude: -73.9235,
  },
  {
    matchers: ["crown heights"],
    latitude: 40.6681,
    longitude: -73.9448,
  },
  {
    matchers: ["upper west side"],
    latitude: 40.7870,
    longitude: -73.9754,
  },
];

export function coordinatesForListing(listing: Listing): Coordinates | null {
  if (listing.latitude !== null && listing.longitude !== null) {
    return {
      latitude: listing.latitude,
      longitude: listing.longitude,
    };
  }

  const text = [listing.address, listing.neighborhood, listing.borough, listing.title]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const place = knownPlaces
    .flatMap((candidate) => candidate.matchers.map((matcher) => ({ ...candidate, matcher })))
    .filter((candidate) => text.includes(candidate.matcher))
    .sort((left, right) => right.matcher.length - left.matcher.length)[0];

  return place ? { latitude: place.latitude, longitude: place.longitude } : null;
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
