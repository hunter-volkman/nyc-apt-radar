import type { FeeStatus, Listing, PetsPolicy } from "./listings";
import type { PreferenceProfile } from "./preferences";
import { commuteScore, commuteSummary } from "./transit";

export const scoreWeights = {
  priceFit: 25,
  locationFit: 20,
  commuteFit: 20,
  apartmentFit: 15,
  petFit: 10,
  freshness: 5,
  completeness: 5,
} as const;

export type ScoreBreakdown = typeof scoreWeights;

export type ListingScore = {
  score: number;
  explanation: string;
  dealbreakers: string[];
  categoryScores: Record<keyof typeof scoreWeights, number>;
  confidence: "high" | "medium" | "low";
};

export function scoreListing(listing: Listing, profile: PreferenceProfile, now = new Date()): ListingScore {
  const dealbreakers = findDealbreakers(listing, profile);
  const categoryScores = {
    priceFit: scorePrice(listing, profile),
    locationFit: scoreLocation(listing, profile),
    commuteFit: scoreCommute(listing, profile),
    apartmentFit: scoreApartment(listing, profile),
    petFit: scorePets(listing.pets, profile),
    freshness: scoreFreshness(listing, now),
    completeness: scoreCompleteness(listing),
  };
  const rawScore = Object.values(categoryScores).reduce((total, value) => total + value, 0);
  const score = dealbreakers.length ? Math.min(rawScore, 49) : rawScore;
  const confidence = getConfidence(listing, dealbreakers);

  return {
    score,
    explanation: explainScore(score, listing, profile, dealbreakers, confidence),
    dealbreakers,
    categoryScores,
    confidence,
  };
}

export function scoreAndExplain(listing: Listing, profile: PreferenceProfile, now = new Date()): Listing {
  const evaluation = scoreListing(listing, profile, now);

  return {
    ...listing,
    score: evaluation.score,
    scoreExplanation: evaluation.explanation,
  };
}

function scorePrice(listing: Listing, profile: PreferenceProfile) {
  if (listing.rent === null) {
    return 11;
  }

  if (listing.rent <= profile.budget.targetRent) {
    return 25;
  }

  if (listing.rent <= profile.budget.maxRent) {
    return 21;
  }

  if (listing.rent <= profile.budget.stretchRent) {
    return 12;
  }

  return 3;
}

function scoreLocation(listing: Listing, profile: PreferenceProfile) {
  const neighborhood = normalize(listing.neighborhood);

  if (!neighborhood) {
    return 8;
  }

  if (profile.neighborhoods.avoid.some((value) => normalize(value) === neighborhood)) {
    return 0;
  }

  if (profile.neighborhoods.preferred.some((value) => normalize(value) === neighborhood)) {
    return 20;
  }

  if (profile.neighborhoods.acceptable.some((value) => normalize(value) === neighborhood)) {
    return 15;
  }

  return 9;
}

function scoreCommute(listing: Listing, profile: PreferenceProfile) {
  return commuteScore(listing, profile);
}

function scoreApartment(listing: Listing, profile: PreferenceProfile) {
  let score = 0;

  if (listing.bedrooms === null) {
    score += 4;
  } else if (listing.bedrooms >= profile.bedroomPreference.min && listing.bedrooms <= profile.bedroomPreference.max) {
    score += 7;
  } else {
    score += 1;
  }

  if (listing.bathrooms === null) {
    score += 3;
  } else if (listing.bathrooms >= profile.bathroomPreference.min) {
    score += 4;
  }

  const text = listingText(listing);
  const niceMatches = profile.niceToHaves.filter((item) => text.includes(normalize(item))).length;
  score += Math.min(4, niceMatches);

  return clamp(score, 0, scoreWeights.apartmentFit);
}

function scorePets(pets: PetsPolicy, profile: PreferenceProfile) {
  if (!profile.petRequirements.cats && !profile.petRequirements.dogs) {
    return scoreWeights.petFit;
  }

  if (pets === "unknown") {
    return 5;
  }

  if (profile.petRequirements.cats && (pets === "cats_allowed" || pets === "cats_and_dogs_allowed")) {
    return 10;
  }

  if (profile.petRequirements.dogs && (pets === "dogs_allowed" || pets === "cats_and_dogs_allowed")) {
    return 10;
  }

  return 0;
}

function scoreFreshness(listing: Listing, now: Date) {
  const firstSeen = new Date(listing.firstSeenAt);
  const ageHours = (now.getTime() - firstSeen.getTime()) / 3_600_000;

  if (!Number.isFinite(ageHours) || ageHours < 0) {
    return 3;
  }

  if (ageHours <= 24) {
    return 5;
  }

  if (ageHours <= 72) {
    return 4;
  }

  if (ageHours <= 168) {
    return 3;
  }

  return 1;
}

function scoreCompleteness(listing: Listing) {
  const fields = [
    listing.sourceUrl,
    listing.title,
    listing.address,
    listing.neighborhood,
    listing.borough,
    listing.rent,
    listing.bedrooms,
    listing.bathrooms,
    listing.availableDate,
    listing.pets !== "unknown" ? listing.pets : null,
    listing.feeStatus !== "unknown" ? listing.feeStatus : null,
  ];
  const known = fields.filter((value) => value !== null && value !== "").length;

  return Math.round((known / fields.length) * scoreWeights.completeness);
}

export function findDealbreakers(listing: Listing, profile: PreferenceProfile) {
  const dealbreakers: string[] = [];
  const text = listingText(listing);

  if (listing.rent !== null && listing.rent > profile.budget.stretchRent) {
    dealbreakers.push("Rent is above stretch budget.");
  }

  if (
    listing.neighborhood
    && profile.neighborhoods.avoid.some((value) => normalize(value) === normalize(listing.neighborhood))
  ) {
    dealbreakers.push("Neighborhood is on the avoid list.");
  }

  if (profile.petRequirements.cats && listing.pets === "no_pets") {
    dealbreakers.push("Cats are not allowed.");
  }

  for (const dealbreaker of profile.dealbreakers) {
    const normalized = normalize(dealbreaker);
    if (text.includes(normalized)) {
      dealbreakers.push(sentence(dealbreaker));
    }
  }

  return unique(dealbreakers);
}

function explainScore(
  score: number,
  listing: Listing,
  profile: PreferenceProfile,
  dealbreakers: string[],
  confidence: "high" | "medium" | "low",
) {
  const parts: string[] = [];
  const tone = score >= 85 ? "Excellent match" : score >= profile.hotScore ? "Strong match" : score >= 62 ? "Possible match" : "Weak match";

  if (dealbreakers.length) {
    parts.push(`Blocked by ${dealbreakers[0].toLowerCase()}`);
  }

  parts.push(pricePhrase(listing, profile));
  parts.push(locationPhrase(listing, profile));
  parts.push(commutePhrase(listing, profile, confidence));
  parts.push(petPhrase(listing.pets, profile));
  parts.push(feePhrase(listing.feeStatus));

  if (listing.firstSeenAt) {
    parts.push("freshness captured");
  }

  if (confidence !== "high") {
    parts.push(`${confidence} confidence because key fields are unknown`);
  }

  return `${score}/100 - ${tone}. ${parts.filter(Boolean).join(", ")}.`;
}

function pricePhrase(listing: Listing, profile: PreferenceProfile) {
  if (listing.rent === null) {
    return "rent unknown";
  }

  if (listing.rent <= profile.budget.targetRent) {
    return "under target budget";
  }

  if (listing.rent <= profile.budget.maxRent) {
    return "within max budget";
  }

  if (listing.rent <= profile.budget.stretchRent) {
    return "within stretch budget";
  }

  return "over stretch budget";
}

function locationPhrase(listing: Listing, profile: PreferenceProfile) {
  if (!listing.neighborhood) {
    return "neighborhood unknown";
  }

  const neighborhood = normalize(listing.neighborhood);
  if (profile.neighborhoods.preferred.some((value) => normalize(value) === neighborhood)) {
    return "preferred neighborhood";
  }

  if (profile.neighborhoods.acceptable.some((value) => normalize(value) === neighborhood)) {
    return "acceptable neighborhood";
  }

  return "neighborhood not in profile";
}

function commutePhrase(listing: Listing, profile: PreferenceProfile, confidence: "high" | "medium" | "low") {
  if (confidence === "low" && listing.latitude === null && listing.longitude === null && !listing.neighborhood) {
    return "commute unknown";
  }

  return commuteSummary(listing, profile);
}

function petPhrase(pets: PetsPolicy, profile: PreferenceProfile) {
  if (!profile.petRequirements.cats && !profile.petRequirements.dogs) {
    return "no pet requirement";
  }

  if (pets === "unknown") {
    return "pet policy unknown";
  }

  if (pets === "no_pets") {
    return "pets not allowed";
  }

  if (pets === "cats_allowed" || pets === "cats_and_dogs_allowed") {
    return "cats allowed";
  }

  return "cat policy unclear";
}

function feePhrase(feeStatus: FeeStatus) {
  if (feeStatus === "no_fee") {
    return "no fee";
  }

  if (feeStatus === "broker_fee") {
    return "broker fee present";
  }

  return "fee status unknown";
}

function getConfidence(listing: Listing, dealbreakers: string[]) {
  const known = [
    listing.sourceUrl,
    listing.address,
    listing.neighborhood,
    listing.rent,
    listing.bedrooms,
    listing.bathrooms,
    listing.pets !== "unknown" ? listing.pets : null,
    listing.feeStatus !== "unknown" ? listing.feeStatus : null,
  ].filter((value) => value !== null && value !== "").length;

  if (dealbreakers.length && known >= 4) {
    return "high";
  }

  if (known >= 7) {
    return "high";
  }

  if (known >= 4) {
    return "medium";
  }

  return "low";
}

function listingText(listing: Listing) {
  return normalize([
    listing.title,
    listing.address,
    listing.neighborhood,
    listing.borough,
    listing.description,
    ...listing.amenities,
  ].filter(Boolean).join(" "));
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function sentence(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}.` : trimmed;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}
