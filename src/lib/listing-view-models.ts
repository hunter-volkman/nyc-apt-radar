import { getListing, listListings } from "@/lib/listing-repository";
import { scoreListing } from "@/lib/scoring";
import { searchProfile } from "@/lib/search-profile";
import {
  listingStatuses,
  statusLabels,
  type Listing,
  type ListingEvaluation,
  type ListingStatus,
  type ListingView,
  type RiskLevel,
} from "@/lib/types";

export { listingStatuses, statusLabels };

export type ListingBundle = {
  listing: ListingView;
  evaluation: ListingEvaluation;
};

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
    .filter((bundle) => bundle.listing.status === "new" && bundle.evaluation.eligible);
}

export function getNeedsFollowUp() {
  return getAllListingBundles()
    .filter((bundle) => bundle.listing.status === "contacted");
}

export function getRecentlyKilled() {
  return getAllListingBundles().filter((bundle) => bundle.listing.status === "dead");
}

export function getBoardColumns() {
  const bundles = getAllListingBundles();

  return listingStatuses.map((status) => ({
    status,
    label: statusLabels[status],
    listings: bundles.filter((bundle) => bundle.listing.status === status),
  }));
}

export function getTourStatusBundles() {
  return getAllListingBundles().filter((bundle) => (
    bundle.listing.status === "tour_scheduled" || bundle.listing.status === "toured"
  ));
}

function toListingBundle(listing: Listing): ListingBundle {
  const evaluation = scoreListing(listing, searchProfile);

  return {
    listing: toListingView(listing, evaluation),
    evaluation,
  };
}

function toListingView(listing: Listing, evaluation: ListingEvaluation): ListingView {
  return {
    ...listing,
    nextAction: deriveNextAction(listing.status, evaluation),
    mainRisk: deriveMainRisk(evaluation),
    moveInFit: deriveMoveInFit(listing.availableDate),
    riskLevel: deriveRiskLevel(evaluation),
    updatedAtLabel: formatUpdatedAtLabel(listing.updatedAt),
  };
}

function deriveNextAction(status: ListingStatus, evaluation: ListingEvaluation) {
  if (status === "new" && !evaluation.eligible) {
    return "Resolve hard filters or kill this listing.";
  }

  if (status === "new" && evaluation.openQuestions.length > 0) {
    return `Contact broker and resolve: ${evaluation.openQuestions[0]}`;
  }

  const actions: Record<ListingStatus, string> = {
    new: "Contact broker with concrete tour windows.",
    contacted: "Follow up with specific tour windows.",
    tour_scheduled: "Tour and verify unresolved questions.",
    toured: "Record verdict and decide whether to apply.",
    applied: "Track response and keep application packet ready.",
    dead: "No action.",
    leased: "No action.",
  };

  return actions[status];
}

function deriveMainRisk(evaluation: ListingEvaluation) {
  return evaluation.hardFilters[0] ?? evaluation.risks[0] ?? "No major risk captured yet";
}

function deriveRiskLevel(evaluation: ListingEvaluation): RiskLevel {
  if (!evaluation.eligible || evaluation.scoreBreakdown.risk <= 3) {
    return "high";
  }

  if (evaluation.scoreBreakdown.risk <= 7) {
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
