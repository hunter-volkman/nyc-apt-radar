import { extractListingDrafts } from "./extract";
import { activeSearchConfigs, collectSearchDocumentsWithErrors, loadSearchConfigs, type SearchConfig } from "./searches";
import { formatDiscoveryCollectionError } from "./documents";
import { loadPreferenceProfile, type PreferenceProfile } from "../core/preferences";
import type { Listing, ListingDraft } from "../core/listings";
import { notifyIfInteresting, recordNotificationDecisionWithoutSending } from "../notifications/ntfy";
import { createSourceEvent, markSourceEventFailed, markSourceEventProcessed, recordSourceCollectionFailure } from "../storage/discovery";
import { listRankedListings, upsertListing } from "../storage/listings";

export type DiscoveryRunOptions = {
  searches?: SearchConfig[];
  profile?: PreferenceProfile;
  notify?: boolean;
  notificationMode?: "send" | "dry-run" | "off";
};

export type DiscoveryRunResult = {
  searchesChecked: number;
  documentsSeen: number;
  duplicateDocuments: number;
  listingsFound: number;
  listingsSaved: Listing[];
  notificationsSent: number;
  notificationsSkipped: number;
  notificationsFailed: number;
  errors: string[];
};

export async function runDiscoveryOnce(options: DiscoveryRunOptions = {}): Promise<DiscoveryRunResult> {
  const profile = options.profile ?? loadPreferenceProfile();
  const discovery = await collectDiscoveryDocuments(options);
  const result: DiscoveryRunResult = {
    searchesChecked: discovery.checked,
    documentsSeen: 0,
    duplicateDocuments: 0,
    listingsFound: 0,
    listingsSaved: [],
    notificationsSent: 0,
    notificationsSkipped: 0,
    notificationsFailed: 0,
    errors: [],
  };

  for (const error of discovery.errors) {
    recordSourceCollectionFailure({
      sourceId: error.sourceId,
      sourceType: error.sourceType,
      sourceRef: error.sourceRef,
      errorMessage: error.message,
      discoveredAt: error.discoveredAt,
    });
    result.errors.push(formatDiscoveryCollectionError(error));
  }

  result.documentsSeen = discovery.documents.length;

  for (const document of discovery.documents) {
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

    const directUrlOnlyDraft = urlOnlyDraftForUrlOnlyDocument(document);
    if (directUrlOnlyDraft) {
      const listing = upsertListing(directUrlOnlyDraft, profile);
      result.listingsFound += 1;
      result.listingsSaved.push(listing);
      markSourceEventProcessed(event.id, 1);
      continue;
    }

    try {
      const drafts = appendUrlOnlyGapDrafts(await extractListingDrafts(document), document);
      result.listingsFound += drafts.length;
      const listings = drafts.map((draft) => upsertListing({
        ...draft,
        source: draft.source ?? document.sourceName,
        sourceUrl: draft.sourceUrl ?? urlSourceRef(document.sourceRef),
      }, profile));
      result.listingsSaved.push(...listings);
      markSourceEventProcessed(event.id, listings.length);

    } catch (error) {
      const message = errorMessage(error);
      const urlOnlyDrafts = urlOnlyDraftsForDocument(document);

      if (urlOnlyDrafts.length) {
        const listings = urlOnlyDrafts.map((draft) => upsertListing(draft, profile));
        result.listingsFound += listings.length;
        result.listingsSaved.push(...listings);
        markSourceEventProcessed(event.id, listings.length);
        if (!isMissingStructuredListingData(message)) {
          result.errors.push(`${document.sourceRef}: ${message} Saved ${listings.length} URL-only lead${listings.length === 1 ? "" : "s"}.`);
        }
      } else {
        markSourceEventFailed(event.id, message);
        result.errors.push(`${document.sourceRef}: ${message}`);
      }
    }
  }

  const notificationMode = resolveNotificationMode(options);
  if (notificationMode !== "off") {
    await processNotificationDecisions(profile, result, notificationMode);
  }

  return result;
}

async function collectDiscoveryDocuments(options: DiscoveryRunOptions) {
  const searches = options.searches ?? activeSearchConfigs(loadSearchConfigs());
  if (searches.length) {
    const result = await collectSearchDocumentsWithErrors(searches);
    return {
      checked: searches.length,
      documents: result.documents,
      errors: result.errors,
    };
  }

  return {
    checked: 0,
    documents: [],
    errors: [{
      sourceId: "searches",
      sourceType: "url" as const,
      sourceRef: "data/searches.json",
      message: "No active StreetEasy searches configured.",
      discoveredAt: new Date().toISOString(),
    }],
  };
}

async function processNotificationDecisions(
  profile: PreferenceProfile,
  result: DiscoveryRunResult,
  mode: "send" | "dry-run",
) {
  for (const listing of listRankedListings(profile)) {
    const notification = mode === "send"
      ? await notifyIfInteresting(listing, profile)
      : recordNotificationDecisionWithoutSending(listing, profile);

    if (notification.sent) {
      result.notificationsSent += 1;
    } else if (notification.skipped) {
      result.notificationsSkipped += 1;
    } else {
      result.notificationsFailed += 1;
      result.errors.push(`notification:${listing.id}: ${notification.message}`);
    }
  }
}

function resolveNotificationMode(options: DiscoveryRunOptions): "send" | "dry-run" | "off" {
  if (options.notificationMode) {
    return options.notificationMode;
  }

  return options.notify === false ? "off" : "send";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isMissingStructuredListingData(message: string) {
  return message.startsWith("No structured listing data found.");
}

function urlSourceRef(sourceRef: string) {
  try {
    const url = new URL(sourceRef);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function urlOnlyDraftForUrlDocument(document: { sourceType: string; sourceName: string; sourceRef: string }): ListingDraft | null {
  const sourceUrl = urlSourceRef(document.sourceRef);
  if (document.sourceType !== "url" || !sourceUrl) {
    return null;
  }

  return urlOnlyDraftForUrl(document.sourceName, sourceUrl);
}

function urlOnlyDraftForUrl(sourceName: string, sourceUrl: string): ListingDraft {
  return {
    source: sourceName,
    sourceUrl,
    title: titleFromUrl(sourceUrl),
    description: "URL-only lead. The search found this listing, but detail fetch or extraction failed. Open it manually or rerun after fixing access/extraction.",
    amenities: [],
    pets: "unknown",
    feeStatus: "unknown",
    status: "new",
  };
}

function urlOnlyDraftsForDocument(document: { sourceType: string; sourceName: string; sourceRef: string; urlOnlyLeadUrls?: string[] }): ListingDraft[] {
  if (document.urlOnlyLeadUrls?.length) {
    return document.urlOnlyLeadUrls
      .map(urlSourceRef)
      .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl))
      .map((sourceUrl) => urlOnlyDraftForUrl(document.sourceName, sourceUrl));
  }

  const draft = urlOnlyDraftForUrlDocument(document);
  return draft ? [draft] : [];
}

function appendUrlOnlyGapDrafts(
  drafts: ListingDraft[],
  document: { sourceName: string; urlOnlyLeadUrls?: string[] },
) {
  if (!document.urlOnlyLeadUrls?.length) {
    return drafts;
  }

  const representedUrls = new Set(drafts
    .map((draft) => canonicalListingUrl(draft.sourceUrl))
    .filter((value): value is string => Boolean(value)));

  const gapDrafts = document.urlOnlyLeadUrls
    .map(urlSourceRef)
    .filter((sourceUrl): sourceUrl is string => Boolean(sourceUrl))
    .filter((sourceUrl) => {
      const key = canonicalListingUrl(sourceUrl);
      if (!key || representedUrls.has(key)) {
        return false;
      }

      representedUrls.add(key);
      return true;
    })
    .map((sourceUrl) => urlOnlyDraftForUrl(document.sourceName, sourceUrl));

  return gapDrafts.length ? [...drafts, ...gapDrafts] : drafts;
}

function urlOnlyDraftForUrlOnlyDocument(document: { sourceType: string; sourceName: string; sourceRef: string; rawText: string }) {
  if (document.rawText.trim() !== document.sourceRef.trim()) {
    return null;
  }

  return urlOnlyDraftForUrlDocument(document);
}

function titleFromUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const unit = parts.at(-1);
    const building = parts.at(-2);

    if (building === "building" && unit) {
      return humanizePathSegment(unit);
    }

    if (building && unit && !unit.includes("_")) {
      return `${humanizePathSegment(building)} #${unit.toUpperCase()}`;
    }

    return humanizePathSegment(parts.at(-1) ?? url.hostname);
  } catch {
    return rawUrl;
  }
}

function humanizePathSegment(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function canonicalListingUrl(rawUrl: string | null | undefined) {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}
