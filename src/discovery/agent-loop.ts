import { extractListingDrafts } from "./extract";
import { collectSourceDocumentsWithErrors, formatSourceCollectionError, loadSourceConfigs, type SourceConfig } from "./sources";
import { loadPreferenceProfile, type PreferenceProfile } from "../core/preferences";
import type { Listing } from "../core/listings";
import { notifyIfInteresting } from "../notifications/ntfy";
import { createSourceEvent, markSourceEventFailed, markSourceEventProcessed, recordSourceCollectionFailure } from "../storage/discovery";
import { listRankedListings, upsertListing } from "../storage/listings";

export type DiscoveryRunOptions = {
  sources?: SourceConfig[];
  profile?: PreferenceProfile;
  notify?: boolean;
};

export type DiscoveryRunResult = {
  sourcesChecked: number;
  documentsSeen: number;
  duplicateDocuments: number;
  listingsFound: number;
  listingsSaved: Listing[];
  notificationsSent: number;
  notificationsFailed: number;
  errors: string[];
};

export async function runDiscoveryOnce(options: DiscoveryRunOptions = {}): Promise<DiscoveryRunResult> {
  const profile = options.profile ?? loadPreferenceProfile();
  const sources = options.sources ?? loadSourceConfigs();
  const result: DiscoveryRunResult = {
    sourcesChecked: sources.length,
    documentsSeen: 0,
    duplicateDocuments: 0,
    listingsFound: 0,
    listingsSaved: [],
    notificationsSent: 0,
    notificationsFailed: 0,
    errors: [],
  };

  const { documents, errors } = await collectSourceDocumentsWithErrors(sources);
  for (const error of errors) {
    recordSourceCollectionFailure({
      sourceId: error.sourceId,
      sourceType: error.sourceType,
      sourceRef: error.sourceRef,
      errorMessage: error.message,
      discoveredAt: error.discoveredAt,
    });
    result.errors.push(formatSourceCollectionError(error));
  }

  result.documentsSeen = documents.length;

  for (const document of documents) {
    const { event, duplicate } = createSourceEvent({
      sourceId: document.sourceId,
      sourceType: document.sourceType,
      sourceRef: document.sourceRef,
      rawText: document.rawText,
      discoveredAt: document.discoveredAt,
    });

    if (duplicate) {
      result.duplicateDocuments += 1;
      continue;
    }

    try {
      const drafts = await extractListingDrafts(document);
      result.listingsFound += drafts.length;
      const listings = drafts.map((draft) => upsertListing({
        ...draft,
        source: draft.source ?? document.sourceName,
      }, profile));
      result.listingsSaved.push(...listings);
      markSourceEventProcessed(event.id, listings.length);

    } catch (error) {
      const message = errorMessage(error);
      markSourceEventFailed(event.id, message);
      result.errors.push(`${document.sourceRef}: ${message}`);
    }
  }

  if (options.notify ?? true) {
    await notifyHotListings(profile, result);
  }

  return result;
}

async function notifyHotListings(profile: PreferenceProfile, result: DiscoveryRunResult) {
  for (const listing of listRankedListings(profile)) {
    const notification = await notifyIfInteresting(listing, profile);
    if (notification.sent) {
      result.notificationsSent += 1;
    } else if (!notification.skipped) {
      result.notificationsFailed += 1;
      result.errors.push(`notification:${listing.id}: ${notification.message}`);
    }
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
