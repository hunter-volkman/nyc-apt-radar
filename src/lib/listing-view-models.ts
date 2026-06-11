import {
  evaluations,
  listings as demoListings,
  searchProfile,
  tours,
} from "@/lib/demo-data";
import { getListing, listListings } from "@/lib/listing-repository";
import {
  listingStatuses,
  statusLabels,
  type DemoListing,
  type Listing,
  type ListingEvaluation,
  type ListingStatus,
  type RiskLevel,
} from "@/lib/types";

export { listingStatuses, statusLabels };

export type ListingBundle = {
  listing: DemoListing;
  evaluation: ListingEvaluation;
};

const demoListingById = new Map(demoListings.map((listing) => [listing.id, listing]));
const evaluationByListingId = new Map(evaluations.map((evaluation) => [evaluation.listingId, evaluation]));

export function getAllListingBundles(): ListingBundle[] {
  return listListings().map(toListingBundle);
}

export function getListingBundle(listingId: string) {
  const listing = getListing(listingId);
  return listing ? toListingBundle(listing) : null;
}

export function getTopCandidates(limit = 4) {
  return getAllListingBundles()
    .filter((bundle) => bundle.listing.status !== "dead" && bundle.listing.status !== "leased")
    .sort((left, right) => {
      if (left.evaluation.eligible !== right.evaluation.eligible) {
        return Number(right.evaluation.eligible) - Number(left.evaluation.eligible);
      }

      return right.evaluation.totalScore - left.evaluation.totalScore;
    })
    .slice(0, limit);
}

export function getNeedsOutreach() {
  return getAllListingBundles()
    .filter((bundle) => bundle.listing.status === "new" && bundle.evaluation.eligible)
    .map((bundle) => bundle.listing);
}

export function getNeedsFollowUp() {
  return getAllListingBundles()
    .filter((bundle) => bundle.listing.status === "contacted")
    .map((bundle) => bundle.listing);
}

export function getRecentlyKilled() {
  return getAllListingBundles()
    .filter((bundle) => bundle.listing.status === "dead")
    .map((bundle) => bundle.listing);
}

export function getBoardColumns() {
  const bundles = getAllListingBundles();

  return listingStatuses.map((status) => ({
    status,
    label: statusLabels[status],
    listings: bundles.filter((bundle) => bundle.listing.status === status),
  }));
}

export function getToursWithListings() {
  const listingById = new Map(getAllListingBundles().map((bundle) => [bundle.listing.id, bundle.listing]));

  return tours
    .map((tour) => ({
      tour,
      listing: listingById.get(tour.listingId),
    }))
    .filter((bundle): bundle is { tour: (typeof tours)[number]; listing: DemoListing } => Boolean(bundle.listing));
}

function toListingBundle(listing: Listing): ListingBundle {
  return {
    listing: toDemoListing(listing),
    evaluation: getEvaluationForListing(listing),
  };
}

function toDemoListing(listing: Listing): DemoListing {
  const demoListing = demoListingById.get(listing.id);

  return {
    ...listing,
    nextAction: demoListing?.nextAction ?? deriveNextAction(listing.status),
    mainRisk: demoListing?.mainRisk ?? deriveMainRisk(listing),
    moveInFit: demoListing?.moveInFit ?? deriveMoveInFit(listing.availableDate),
    riskLevel: demoListing?.riskLevel ?? deriveRiskLevel(listing),
    updatedAtLabel: formatUpdatedAtLabel(listing.updatedAt),
  };
}

function getEvaluationForListing(listing: Listing): ListingEvaluation {
  const demoEvaluation = evaluationByListingId.get(listing.id);

  if (demoEvaluation) {
    return demoEvaluation;
  }

  return {
    id: `eval-unscored-${listing.id}`,
    listingId: listing.id,
    eligible: false,
    totalScore: 0,
    scoreBreakdown: {
      location: 0,
      price: 0,
      apartmentFit: 0,
      moveInFit: 0,
      risk: 0,
      responsiveness: 0,
      subjectivePull: 0,
    },
    hardFilters: ["Not scored yet."],
    summary: "Saved from Inbox review. Final scoring still belongs to the scoring thread.",
    strengths: listing.amenities.length ? listing.amenities : ["Captured locally"],
    risks: listing.redFlags.length ? listing.redFlags : ["Needs scoring review"],
    openQuestions: listing.openQuestions.length ? listing.openQuestions : ["Run the scoring workflow once it exists."],
    confidence: "low",
    evaluatedAt: listing.updatedAt,
  };
}

function deriveNextAction(status: ListingStatus) {
  const actions: Record<ListingStatus, string> = {
    new: "Review fields, score manually, then decide whether to contact.",
    contacted: "Follow up with specific tour windows.",
    tour_scheduled: "Tour and verify the unresolved questions.",
    toured: "Record verdict and decide whether to apply.",
    applied: "Track response and keep application packet ready.",
    dead: "No action.",
    leased: "No action.",
  };

  return actions[status];
}

function deriveMainRisk(listing: Listing) {
  return listing.redFlags[0] ?? listing.fees[0] ?? "Not scored yet.";
}

function deriveRiskLevel(listing: Listing): RiskLevel {
  if (listing.redFlags.length >= 2) {
    return "high";
  }

  if (listing.redFlags.length || listing.fees.some((fee) => fee.toLowerCase().includes("broker"))) {
    return "medium";
  }

  return "low";
}

function deriveMoveInFit(availableDate: string | null) {
  if (!availableDate || !searchProfile.targetMoveInDate) {
    return "Move-in unknown";
  }

  const available = new Date(availableDate).getTime();
  const target = new Date(searchProfile.targetMoveInDate).getTime();
  const days = Math.round((available - target) / 86_400_000);

  if (days === 0) {
    return "Exact target date";
  }

  if (days < 0) {
    return `${Math.abs(days)} days early`;
  }

  if (days <= 7) {
    return `${days} days late`;
  }

  return "Later than target";
}

function formatUpdatedAtLabel(updatedAt: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(updatedAt).getTime()) / 60_000));

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hr ago`;
  }

  if (elapsedHours < 48) {
    return "Yesterday";
  }

  return `${Math.round(elapsedHours / 24)} days ago`;
}
