import type { ListingBundle } from "@/lib/listing-view-models";
import type { DailyBrief } from "@/lib/types";

export function buildDailyBriefing({
  topCandidates,
  needsOutreach,
  needsFollowUp,
  tourStatusBundles,
  recentlyKilled,
}: {
  topCandidates: ListingBundle[];
  needsOutreach: ListingBundle[];
  needsFollowUp: ListingBundle[];
  tourStatusBundles: ListingBundle[];
  recentlyKilled: ListingBundle[];
}): DailyBrief {
  const recommendedNextActions = [
    ...needsOutreach.slice(0, 2).map(({ listing }) => `Contact ${listing.title}: ${listing.nextAction}`),
    ...needsFollowUp.slice(0, 2).map(({ listing }) => `Follow up on ${listing.title}: ${listing.nextAction}`),
    ...tourStatusBundles.slice(0, 1).map(({ listing }) => `Prepare tour checklist for ${listing.title}.`),
  ];

  if (topCandidates.length === 0) {
    recommendedNextActions.push("Capture the first real listing from Inbox.");
  }

  return {
    generatedAt: new Date().toISOString(),
    bestCandidates: topCandidates.map(({ listing }) => listing.title),
    followUps: needsFollowUp.map(({ listing }) => listing.title),
    upcomingTours: tourStatusBundles.map(({ listing }) => listing.title),
    deadOrRiskyListings: recentlyKilled.map(({ listing }) => listing.title),
    applicationReadinessGaps: ["Readiness state is not stored yet."],
    recommendedNextActions,
  };
}
