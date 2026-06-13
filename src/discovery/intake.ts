import fs from "node:fs";
import path from "node:path";
import { fetchWithTimeout, readPositiveIntegerEnv } from "../config/timeouts";
import type { Listing, ListingDraft } from "../core/listings";
import { loadPreferenceProfile, type PreferenceProfile } from "../core/preferences";
import { notifyIfInteresting } from "../notifications/ntfy";
import { createSourceEvent, markSourceEventFailed, markSourceEventProcessed } from "../storage/discovery";
import { upsertListing } from "../storage/listings";
import type { DiscoveryDocument } from "./documents";
import { extractListingDrafts } from "./extract";

export type IntakeInputKind = "auto" | "file" | "url" | "text";

export type IntakeInput = {
  kind?: IntakeInputKind;
  value: string;
  sourceName?: string;
};

export type IntakeOptions = {
  inputs: IntakeInput[];
  profile?: PreferenceProfile;
  notify?: boolean;
  now?: Date;
};

export type IntakeResult = {
  inputs: number;
  documentsSeen: number;
  duplicateDocuments: number;
  listingsFound: number;
  listingsSaved: Listing[];
  urlOnlyListings: number;
  notificationsSent: number;
  notificationsFailed: number;
  warnings: string[];
  errors: string[];
};

type IntakeDocument = {
  document: DiscoveryDocument;
  urlOnlyDrafts?: ListingDraft[];
  warning?: string;
};

export async function intakeListings(options: IntakeOptions): Promise<IntakeResult> {
  const profile = options.profile ?? loadPreferenceProfile();
  const result: IntakeResult = {
    inputs: options.inputs.length,
    documentsSeen: 0,
    duplicateDocuments: 0,
    listingsFound: 0,
    listingsSaved: [],
    urlOnlyListings: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    warnings: [],
    errors: [],
  };

  for (const input of options.inputs) {
    const documents = await documentsFromInput(input);
    result.documentsSeen += documents.length;

    for (const warning of documents.flatMap((item) => item.warning ?? [])) {
      result.warnings.push(warning);
    }

    for (const item of documents) {
      await processDocument(item, profile, options, result);
    }
  }

  return result;
}

async function processDocument(
  item: IntakeDocument,
  profile: PreferenceProfile,
  options: IntakeOptions,
  result: IntakeResult,
) {
  const { document } = item;
  const { event, duplicate } = createSourceEvent({
    sourceId: document.sourceId,
    sourceType: document.sourceType,
    sourceRef: document.sourceRef,
    rawText: document.rawText,
    discoveredAt: document.discoveredAt,
  });

  if (duplicate) {
    result.duplicateDocuments += 1;
    return;
  }

  let drafts: ListingDraft[];
  try {
    drafts = item.urlOnlyDrafts ?? await extractListingDrafts(document);
  } catch (error) {
    if (document.sourceType === "url") {
      const draft = draftFromUrl(document.sourceRef, document.sourceName);
      drafts = [draft];
      result.urlOnlyListings += 1;
      result.warnings.push(`${document.sourceRef}: ${errorMessage(error)} Saved URL-only lead.`);
    } else {
      const message = errorMessage(error);
      if (!duplicate) {
        markSourceEventFailed(event.id, message);
      }
      result.errors.push(`${document.sourceRef}: ${message}`);
      return;
    }
  }

  result.listingsFound += drafts.length;
  const listings = drafts.map((draft) => upsertListing({
    ...draft,
    source: draft.source ?? document.sourceName,
  }, profile, options.now));
  result.listingsSaved.push(...listings);
  result.urlOnlyListings += item.urlOnlyDrafts?.length ?? 0;

  if (!duplicate) {
    markSourceEventProcessed(event.id, listings.length);
  }

  if (options.notify) {
    for (const listing of listings) {
      const notification = await notifyIfInteresting(listing, profile);
      if (notification.sent) {
        result.notificationsSent += 1;
      } else if (!notification.skipped) {
        result.notificationsFailed += 1;
        result.errors.push(`notification:${listing.id}: ${notification.message}`);
      }
    }
  }
}

async function documentsFromInput(input: IntakeInput): Promise<IntakeDocument[]> {
  const kind = input.kind ?? "auto";
  const value = input.value.trim();

  if (!value) {
    return [];
  }

  if (kind === "file" || (kind === "auto" && isReadableFile(value))) {
    return documentsFromFile(value, input.sourceName);
  }

  if (kind === "url" || (kind === "auto" && isHttpUrl(value))) {
    return documentsFromUrl(value, input.sourceName);
  }

  const urls = urlLines(value);
  if (urls.length) {
    const nested = await Promise.all(urls.map((url) => documentsFromUrl(url, input.sourceName)));
    return nested.flat();
  }

  return documentsFromText(value, input.sourceName);
}

async function documentsFromFile(filePath: string, sourceName?: string): Promise<IntakeDocument[]> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const rawText = fs.readFileSync(absolutePath, "utf8");
  const urls = urlLines(rawText);

  if (urls.length) {
    const nested = await Promise.all(urls.map((url) => documentsFromUrl(url, sourceName)));
    return nested.flat();
  }

  return [{
    document: {
      sourceId: `intake-file:${path.basename(absolutePath)}`,
      sourceType: "file",
      sourceName: sourceName ?? path.basename(absolutePath),
      sourceRef: absolutePath,
      rawText,
      discoveredAt: new Date(fs.statSync(absolutePath).mtime).toISOString(),
    },
  }];
}

async function documentsFromUrl(rawUrl: string, sourceName?: string): Promise<IntakeDocument[]> {
  const source = sourceName ?? sourceNameFromUrl(rawUrl);
  const sourceId = `intake-url:${stableUrlId(rawUrl)}`;

  try {
    const response = await fetchWithTimeout(rawUrl, {
      headers: {
        "User-Agent": "nyc-apt-radar/0.1 local-first apartment search assistant",
        Accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
      },
    }, readPositiveIntegerEnv("NYC_APT_RADAR_FETCH_TIMEOUT_MS", 15000));

    if (!response.ok) {
      throw new Error(`Fetch failed for ${rawUrl}: ${response.status} ${response.statusText}`);
    }

    return [{
      document: {
        sourceId,
        sourceType: "url",
        sourceName: source,
        sourceRef: rawUrl,
        rawText: await response.text(),
        discoveredAt: new Date().toISOString(),
      },
    }];
  } catch (error) {
    return [{
      document: {
        sourceId,
        sourceType: "url",
        sourceName: source,
        sourceRef: rawUrl,
        rawText: rawUrl,
        discoveredAt: new Date().toISOString(),
      },
      urlOnlyDrafts: [draftFromUrl(rawUrl, source)],
      warning: `${sourceId}: ${errorMessage(error)}. Saved URL-only lead.`,
    }];
  }
}

function documentsFromText(rawText: string, sourceName?: string): IntakeDocument[] {
  return [{
    document: {
      sourceId: "intake-text",
      sourceType: "file",
      sourceName: sourceName ?? "Pasted listing text",
      sourceRef: "stdin",
      rawText,
      discoveredAt: new Date().toISOString(),
    },
  }];
}

function draftFromUrl(rawUrl: string, sourceName?: string): ListingDraft {
  return {
    source: sourceName ?? sourceNameFromUrl(rawUrl),
    sourceUrl: rawUrl,
    title: titleFromUrl(rawUrl),
    description: "URL-only lead. Paste listing text or run intake on an export to fill missing facts.",
    amenities: [],
    pets: "unknown",
    feeStatus: "unknown",
    status: "new",
  };
}

function titleFromUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const parts = url.pathname.split("/").filter(Boolean);
    const unit = parts.at(-1);
    const building = parts.at(-2);

    if (building && unit) {
      return `${humanizePathSegment(building)} #${unit.toUpperCase()}`;
    }

    return humanizePathSegment(parts.at(-1) ?? url.hostname);
  } catch {
    return rawUrl;
  }
}

function sourceNameFromUrl(rawUrl: string) {
  try {
    const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
    return hostname === "streeteasy.com" ? "StreetEasy" : hostname;
  } catch {
    return "URL intake";
  }
}

function stableUrlId(rawUrl: string) {
  return rawUrl
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "url";
}

function humanizePathSegment(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .trim();
}

function urlLines(value: string) {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length && lines.every(isHttpUrl) ? lines : [];
}

function isReadableFile(value: string) {
  return fs.existsSync(value) && fs.statSync(value).isFile();
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
