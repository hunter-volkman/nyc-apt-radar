import type { Confidence, Listing, ListingEvaluation, SearchProfile } from "./types";

export const scoringWeights = {
  location: 30,
  price: 25,
  apartmentFit: 15,
  moveInFit: 10,
  risk: 10,
  responsiveness: 5,
  subjectivePull: 5,
} as const satisfies Record<keyof ListingEvaluation["scoreBreakdown"], number>;

const missingAddressMarkers = [
  "address withheld",
  "withheld until",
  "provided at showing",
  "available later",
  "upon request",
  "not disclosed",
  "tbd",
  "unknown",
];

const suspiciousFeePatterns = [
  /tenant[-\s]?paid.*(unclear|unresolved|unknown|tbd)/i,
  /(unclear|unresolved|unknown|tbd).*tenant[-\s]?paid.*fee/i,
  /(fee|broker fee).*(unclear|unresolved|unknown|tbd)/i,
  /(cash|wire|crypto|zelle).*(deposit|fee|payment)/i,
  /(deposit|fee|payment).*(cash|wire|crypto|zelle)/i,
  /pay.*before.*(showing|tour|viewing)/i,
  /unresolved tenant[-\s]?paid fee/i,
];

const scamPatterns = [
  /cash deposit/i,
  /wire transfer/i,
  /western union/i,
  /crypto/i,
  /keys? (will be )?(mailed|shipped)/i,
  /sight unseen/i,
  /no (showing|tour|viewing)/i,
  /guaranteed approval/i,
  /photos? available later/i,
  /too good to be true/i,
];

const strongPullWords = ["strongest", "favorite", "love", "great fit", "serious", "excited"];
const weakPullWords = ["backup", "kill", "killed", "not worth", "math is bad"];
const transitWords = ["subway", "train", "near ", "station", "avenue", "n/w", "l train", "a/c", "2/3", "4/5"];
const lightWords = ["light", "sunny", "south-facing", "bright"];

export function scoreListing(listing: Listing, profile: SearchProfile): ListingEvaluation {
  const hardFilters = getHardFilters(listing, profile);
  const scoreBreakdown = {
    location: scoreLocation(listing, profile),
    price: scorePrice(listing, profile),
    apartmentFit: scoreApartmentFit(listing, profile),
    moveInFit: scoreMoveInFit(listing, profile),
    risk: scoreRisk(listing),
    responsiveness: scoreResponsiveness(listing),
    subjectivePull: scoreSubjectivePull(listing, profile),
  };
  const risks = getRisks(listing, profile, hardFilters);
  const openQuestions = getOpenQuestions(listing, profile);
  const strengths = getStrengths(listing, profile, scoreBreakdown);
  const totalScore = Object.values(scoreBreakdown).reduce((total, value) => total + value, 0);

  return {
    id: `eval-${listing.id}`,
    listingId: listing.id,
    eligible: hardFilters.length === 0,
    totalScore,
    scoreBreakdown,
    hardFilters,
    summary: summarizeScore(hardFilters, totalScore, risks),
    strengths,
    risks,
    openQuestions,
    confidence: getConfidence(listing, hardFilters, openQuestions),
    evaluatedAt: listing.updatedAt,
  };
}

function getHardFilters(listing: Listing, profile: SearchProfile) {
  const filters: string[] = [];
  const rent = effectiveRent(listing);
  const maxRent = profile.maxRentMonthly;
  const budgetTolerance = profile.budgetToleranceMonthly ?? 0;

  if (rent !== null && maxRent !== null && rent > maxRent + budgetTolerance) {
    filters.push("Rent exceeds max budget plus tolerance.");
  }

  if (isImpossibleMoveIn(listing.availableDate, profile.targetMoveInDate)) {
    filters.push("Move-in date is impossible for the target window.");
  }

  if (isHardNoNeighborhood(listing.neighborhood, profile)) {
    filters.push("Neighborhood is marked hard-no.");
  }

  if (!hasUsableAddress(listing.address)) {
    filters.push("Address is missing after parse.");
  }

  if (hasSuspiciousFeeLanguage(listing)) {
    filters.push("Fee language is suspicious or unresolved.");
  }

  if (hasObviousScamLanguage(listing)) {
    filters.push("Scam language is obvious.");
  }

  if (isUnavailable(listing)) {
    filters.push("Listing is already unavailable.");
  }

  return unique(filters);
}

function scoreLocation(listing: Listing, profile: SearchProfile) {
  const neighborhood = normalize(listing.neighborhood);
  let score = 12;

  if (neighborhood && profile.preferredNeighborhoods.some((candidate) => normalize(candidate) === neighborhood)) {
    score = 27;
  } else if (neighborhood && profile.acceptableNeighborhoods.some((candidate) => normalize(candidate) === neighborhood)) {
    score = 23;
  } else if (neighborhood && profile.hardNoNeighborhoods.some((candidate) => normalize(candidate) === neighborhood)) {
    score = 4;
  } else if (neighborhood) {
    score = 16;
  }

  if (textIncludes(listing, transitWords)) {
    score += 2;
  }

  if (listing.borough && ["brooklyn", "manhattan", "queens"].includes(normalize(listing.borough))) {
    score += 1;
  }

  return clampScore(score, scoringWeights.location);
}

function scorePrice(listing: Listing, profile: SearchProfile) {
  const rent = effectiveRent(listing);
  const maxRent = profile.maxRentMonthly;
  const tolerance = profile.budgetToleranceMonthly ?? 0;

  if (rent === null) {
    return 8;
  }

  if (maxRent === null) {
    return 18;
  }

  if (rent <= maxRent - 500) {
    return 25;
  }

  if (rent <= maxRent - 250) {
    return 23;
  }

  if (rent <= maxRent) {
    return 20;
  }

  if (rent <= maxRent + tolerance) {
    return 14;
  }

  return 6;
}

function scoreApartmentFit(listing: Listing, profile: SearchProfile) {
  let score = 0;

  if (listing.bedrooms !== null && profile.bedroomsMin !== null && profile.bedroomsMax !== null) {
    if (listing.bedrooms >= profile.bedroomsMin && listing.bedrooms <= profile.bedroomsMax) {
      score += 5;
    } else if (listing.bedrooms > 0) {
      score += 2;
    }
  } else if (listing.bedrooms !== null && listing.bedrooms > 0) {
    score += 3;
  }

  const mustHaveMatches = profile.mustHaves.filter((mustHave) => matchesPreference(listing, mustHave)).length;
  score += Math.min(6, mustHaveMatches * 2);

  const niceToHaveMatches = profile.niceToHaves.filter((niceToHave) => matchesPreference(listing, niceToHave)).length;
  score += Math.min(3, niceToHaveMatches);

  if (listing.squareFeet !== null && listing.squareFeet >= 650) {
    score += 1;
  }

  return clampScore(score, scoringWeights.apartmentFit);
}

function scoreMoveInFit(listing: Listing, profile: SearchProfile) {
  const available = parseDateOnly(listing.availableDate);
  const target = parseDateOnly(profile.targetMoveInDate);

  if (!available || !target) {
    return 5;
  }

  const daysFromTarget = daysBetween(target, available);

  if (daysFromTarget === 0) {
    return 10;
  }

  if (daysFromTarget < 0 && daysFromTarget >= -14) {
    return 9;
  }

  if (daysFromTarget > 0 && daysFromTarget <= 7) {
    return 9;
  }

  if (daysFromTarget > 7 && daysFromTarget <= 14) {
    return 7;
  }

  if (daysFromTarget > 14 && daysFromTarget <= 30) {
    return 4;
  }

  if (daysFromTarget < -14 && daysFromTarget >= -30) {
    return 7;
  }

  return 0;
}

function scoreRisk(listing: Listing) {
  let score = 10;

  score -= listing.redFlags.length * 2;

  if (hasSuspiciousFeeLanguage(listing)) {
    score -= 4;
  } else if (listing.fees.some((fee) => normalize(fee).includes("broker fee"))) {
    score -= 1;
  }

  if (hasObviousScamLanguage(listing)) {
    score -= 6;
  }

  if (!hasUsableAddress(listing.address)) {
    score -= 3;
  }

  if (textIncludes(listing, ["basement", "garden level", "railroad", "cash pressure"])) {
    score -= 2;
  }

  return clampScore(score, scoringWeights.risk);
}

function scoreResponsiveness(listing: Listing) {
  let score = 1;

  if (listing.contactEmail) {
    score += 2;
  }

  if (listing.contactPhone) {
    score += 1;
  }

  if (listing.contactName) {
    score += 1;
  }

  if (["contacted", "tour_scheduled", "toured", "applied"].includes(listing.status)) {
    score += 1;
  }

  return clampScore(score, scoringWeights.responsiveness);
}

function scoreSubjectivePull(listing: Listing, profile: SearchProfile) {
  let score = 2;
  const notes = normalize(listing.personalNotes);

  if (notes && strongPullWords.some((word) => notes.includes(word))) {
    score += 2;
  }

  if (notes && weakPullWords.some((word) => notes.includes(word))) {
    score -= 2;
  }

  if (listing.neighborhood && profile.preferredNeighborhoods.some((candidate) => normalize(candidate) === normalize(listing.neighborhood))) {
    score += 1;
  }

  if (profile.niceToHaves.some((niceToHave) => matchesPreference(listing, niceToHave))) {
    score += 1;
  }

  return clampScore(score, scoringWeights.subjectivePull);
}

function getStrengths(
  listing: Listing,
  profile: SearchProfile,
  scoreBreakdown: ListingEvaluation["scoreBreakdown"],
) {
  const strengths: string[] = [];
  const rent = effectiveRent(listing);

  if (listing.neighborhood && profile.preferredNeighborhoods.some((candidate) => normalize(candidate) === normalize(listing.neighborhood))) {
    strengths.push("Preferred neighborhood");
  } else if (listing.neighborhood && profile.acceptableNeighborhoods.some((candidate) => normalize(candidate) === normalize(listing.neighborhood))) {
    strengths.push("Acceptable neighborhood");
  }

  if (rent !== null && profile.maxRentMonthly !== null && rent <= profile.maxRentMonthly) {
    strengths.push("Within max budget");
  }

  if (scoreBreakdown.moveInFit >= 9) {
    strengths.push("Move-in date fits");
  }

  const matchedAmenities = listing.amenities.filter((amenity) =>
    profile.mustHaves.concat(profile.niceToHaves).some((preference) => matchesPreferenceText(amenity, preference)),
  );

  strengths.push(...matchedAmenities.slice(0, 3).map(sentenceCase));

  if (listing.contactEmail || listing.contactPhone) {
    strengths.push("Direct contact captured");
  }

  return withFallback(unique(strengths), "Captured locally");
}

function getRisks(listing: Listing, profile: SearchProfile, hardFilters: string[]) {
  const risks = [...hardFilters];
  const rent = effectiveRent(listing);
  const maxRent = profile.maxRentMonthly;

  if (rent === null) {
    risks.push("Rent is missing.");
  } else if (maxRent !== null && rent > maxRent) {
    risks.push("Rent is above max budget.");
  }

  if (listing.redFlags.length) {
    risks.push(...listing.redFlags);
  }

  if (listing.fees.length) {
    risks.push(...listing.fees.filter((fee) => !normalize(fee).includes("no fee")));
  }

  if (!listing.contactEmail && !listing.contactPhone) {
    risks.push("Direct contact is missing.");
  }

  return withFallback(unique(risks.map(sentenceCase)), "No major risk captured yet");
}

function getOpenQuestions(listing: Listing, profile: SearchProfile) {
  const questions = [...listing.openQuestions];

  if (!hasUsableAddress(listing.address)) {
    questions.push("What is the exact address?");
  }

  if (effectiveRent(listing) === null) {
    questions.push("What is the monthly rent?");
  }

  if (!listing.availableDate && profile.targetMoveInDate) {
    questions.push("When is the apartment available?");
  }

  if (!listing.neighborhood) {
    questions.push("Which neighborhood is this in?");
  }

  if (listing.fees.length === 0) {
    questions.push("What fees are due before lease signing?");
  }

  return withFallback(unique(questions.map(sentenceCase)), "No open questions captured");
}

function getConfidence(listing: Listing, hardFilters: string[], openQuestions: string[]): Confidence {
  const completeFields = [
    hasUsableAddress(listing.address),
    effectiveRent(listing) !== null,
    Boolean(listing.neighborhood),
    Boolean(listing.availableDate),
    listing.bedrooms !== null,
  ].filter(Boolean).length;

  const decisiveHardFilter = hardFilters.some((filter) =>
    [
      "Rent exceeds max budget plus tolerance.",
      "Neighborhood is marked hard-no.",
      "Scam language is obvious.",
      "Listing is already unavailable.",
    ].includes(filter),
  );

  if (decisiveHardFilter && completeFields >= 3) {
    return "high";
  }

  if (completeFields >= 4 && openQuestions.length <= 2) {
    return "high";
  }

  if (completeFields >= 3) {
    return "medium";
  }

  return "low";
}

function summarizeScore(hardFilters: string[], totalScore: number, risks: string[]) {
  if (hardFilters.length) {
    return `Ineligible until resolved: ${hardFilters[0]}`;
  }

  if (totalScore >= 85) {
    return "Strong candidate: score clears the bar without a failed hard filter.";
  }

  if (totalScore >= 70) {
    return `Viable candidate, but ${risks[0].toLowerCase()}`;
  }

  return "Weak candidate unless the open questions change the facts.";
}

function isImpossibleMoveIn(availableDate: string | null, targetMoveInDate: string | null) {
  const available = parseDateOnly(availableDate);
  const target = parseDateOnly(targetMoveInDate);

  if (!available || !target) {
    return false;
  }

  return daysBetween(target, available) > 45;
}

function isHardNoNeighborhood(neighborhood: string | null, profile: SearchProfile) {
  const normalizedNeighborhood = normalize(neighborhood);

  return Boolean(
    normalizedNeighborhood &&
      profile.hardNoNeighborhoods.some((hardNo) => normalize(hardNo) === normalizedNeighborhood),
  );
}

function hasUsableAddress(address: string | null) {
  const normalizedAddress = normalize(address);

  return Boolean(
    normalizedAddress &&
      !missingAddressMarkers.some((marker) => normalizedAddress === marker || normalizedAddress.includes(marker)),
  );
}

function hasSuspiciousFeeLanguage(listing: Listing) {
  return suspiciousFeePatterns.some((pattern) => pattern.test(combinedListingText(listing)));
}

function hasObviousScamLanguage(listing: Listing) {
  return scamPatterns.some((pattern) => pattern.test(combinedListingText(listing)));
}

function isUnavailable(listing: Listing) {
  if (listing.status === "dead" || listing.status === "leased") {
    return true;
  }

  return /\b(rented|unavailable|off market|application accepted|lease signed)\b/i.test(combinedListingText(listing));
}

function matchesPreference(listing: Listing, preference: string) {
  const normalizedPreference = normalize(preference);

  if (normalizedPreference === "real bedroom") {
    return (listing.bedrooms ?? 0) >= 1 && !textIncludes(listing, ["studio", "railroad"]);
  }

  if (normalizedPreference === "laundry access") {
    return textIncludes(listing, ["laundry"]);
  }

  if (normalizedPreference === "solid light") {
    return textIncludes(listing, lightWords);
  }

  if (normalizedPreference === "reasonable commute") {
    return textIncludes(listing, transitWords) || Boolean(listing.neighborhood);
  }

  return matchesPreferenceText(combinedListingText(listing), normalizedPreference);
}

function matchesPreferenceText(text: string, preference: string) {
  const normalizedText = normalize(text);
  const normalizedPreference = normalize(preference);

  if (normalizedPreference === "outdoor space") {
    return ["outdoor", "garden", "roof", "terrace", "balcony", "stoop"].some((word) => normalizedText.includes(word));
  }

  if (normalizedPreference === "prewar details") {
    return normalizedText.includes("prewar") || normalizedText.includes("pre-war");
  }

  if (normalizedPreference === "laundry access") {
    return normalizedText.includes("laundry");
  }

  return normalizedText.includes(normalizedPreference);
}

function textIncludes(listing: Listing, terms: string[]) {
  const text = normalize(combinedListingText(listing));
  return terms.some((term) => text.includes(normalize(term)));
}

function combinedListingText(listing: Listing) {
  return [
    listing.title,
    listing.address,
    listing.unit,
    listing.neighborhood,
    listing.borough,
    listing.rawText,
    listing.personalNotes,
    ...listing.amenities,
    ...listing.fees,
    ...listing.redFlags,
    ...listing.openQuestions,
  ]
    .filter(Boolean)
    .join(" ");
}

function effectiveRent(listing: Listing) {
  return listing.rentMonthly ?? listing.netEffectiveRent ?? null;
}

function parseDateOnly(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysBetween(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function normalize(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  return trimmed ? `${trimmed[0].toUpperCase()}${trimmed.slice(1)}` : trimmed;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function withFallback(values: string[], fallback: string) {
  return values.length ? values : [fallback];
}

function clampScore(value: number, maximum: number) {
  return Math.max(0, Math.min(maximum, Math.round(value)));
}
