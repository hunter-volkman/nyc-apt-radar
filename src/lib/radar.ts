import { createHash, randomUUID } from "node:crypto";
import { asc, desc, eq, or } from "drizzle-orm";
import { db } from "@/db/client";
import { ensureDatabase } from "@/db/ensure";
import {
  notificationToRow,
  rowToNotification,
  rowToSourceEvent,
  rowToWatchRun,
  sourceEventToRow,
  watchRunToRow,
} from "@/db/radar-mappers";
import {
  notificationsTable,
  sourceEventsTable,
  watchRunsTable,
} from "@/db/schema";
import { createListing, listListings } from "@/lib/listing-repository";
import {
  getListingBundle,
  type ListingBundle,
} from "@/lib/listing-view-models";
import { parseListing } from "@/lib/parser";
import { scoreListing } from "@/lib/scoring";
import { searchProfile } from "@/lib/search-profile";
import {
  statusLabels,
  type Listing,
  type ListingEvaluation,
  type NotificationChannel,
  type NotificationStatus,
  type Notification,
  type NotificationType,
  type RadarClassification,
  type SourceEvent,
  type WatchRun,
  type WatchRunType,
} from "@/lib/types";

export const defaultOutreachCopy = `Hi, I'm interested in [address/unit]. Is this still available?

If so, I'd like to schedule the earliest possible tour.

Could you also send a quick video walkthrough and confirm total move-in costs, including any broker fee?`;

export const feeAddressClarificationCopy = `Hi, I'm interested in [address/unit]. Before scheduling, could you confirm the exact address, total move-in cash required, and whether there is any tenant-paid broker fee?`;

const defaultWatchIntervalMinutes = 10;
const freshWindowHours = 24;
const defaultSourceDirectory = "data/source-events";
const defaultNtfyBaseUrl = "https://ntfy.sh";
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

export type SourceEventDraft = {
  sourceName?: string | null;
  sourceUrl?: string | null;
  sourceFilePath?: string | null;
  rawText: string;
  importedAt?: string | null;
};

export type SourceEventImportResult = {
  event: SourceEvent;
  duplicateOf: SourceEvent | null;
  wasDuplicate: boolean;
};

export type RadarRunOptions = {
  runType?: WatchRunType;
  intervalMinutes?: number;
  eventsImported?: number;
  now?: Date;
};

export type ProcessSourceEventResult = {
  event: SourceEvent;
  listing: Listing | null;
  classification: RadarClassification;
  notificationCreated: boolean;
  duplicate: boolean;
};

export type RadarRunResult = WatchRun & {
  processedEvents: SourceEvent[];
  failedEvents: SourceEvent[];
};

export type RadarRow = {
  id: string;
  sourceEvent: SourceEvent;
  bundle: ListingBundle | null;
  classification: RadarClassification;
  source: string;
  sourceUrl: string | null;
  ageLabel: string;
  rentLabel: string;
  neighborhoodLabel: string;
  scoreLabel: string;
  blockers: string[];
  nextAction: string;
  message: string | null;
  canMarkContacted: boolean;
  canKill: boolean;
};

export type RadarDashboard = {
  rows: RadarRow[];
  rowsByClassification: Record<RadarClassification, RadarRow[]>;
  lastRun: WatchRun | null;
  notifications: Notification[];
  intervalMinutes: number;
  sourceDirectory: string;
  pushStatus: PushNotificationStatus;
};

export type PushNotificationStatus = {
  channel: NotificationChannel;
  configured: boolean;
  label: string;
};

type NtfyConfig = {
  baseUrl: string;
  topic: string;
};

export function getRadarWatchIntervalMinutes(
  value = process.env.APARTMENT_RADAR_WATCH_INTERVAL_MINUTES ?? process.env.STOOP_WATCH_INTERVAL_MINUTES,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultWatchIntervalMinutes;
}

export function getSourceDirectory(
  value = process.env.APARTMENT_RADAR_SOURCE_DIR ?? process.env.STOOP_SOURCE_DIR,
) {
  const directory = cleanString(value) ?? defaultSourceDirectory;

  return resolveWorkspacePath(directory);
}

export function getPushNotificationStatus(): PushNotificationStatus {
  const config = getNtfyConfig();

  if (config) {
    return {
      channel: "ntfy",
      configured: true,
      label: "ntfy push configured",
    };
  }

  return {
    channel: "local",
    configured: false,
    label: "Push not configured",
  };
}

export function importSourceEvent(draft: SourceEventDraft): SourceEventImportResult {
  ensureDatabase();

  const rawText = cleanString(draft.rawText);

  if (!rawText) {
    throw new Error("Source message text is required.");
  }

  const sourceFilePath = normalizeSourceFilePath(draft.sourceFilePath);
  const fileEvent = sourceFilePath ? findSourceEventBySourceFilePath(sourceFilePath) : null;

  if (fileEvent) {
    return {
      event: fileEvent,
      duplicateOf: fileEvent,
      wasDuplicate: true,
    };
  }

  const sourceUrl = cleanString(draft.sourceUrl) ?? extractFirstUrl(rawText);
  const normalizedSourceUrl = normalizeSourceUrl(sourceUrl);
  const normalizedFingerprint = createSourceFingerprint(rawText);
  const duplicateOf = findDuplicateSourceEvent(normalizedSourceUrl, normalizedFingerprint);
  const now = cleanString(draft.importedAt) ?? new Date().toISOString();
  const sourceName = detectSourceName({
    rawText,
    sourceName: draft.sourceName,
    sourceUrl,
  });
  const event: SourceEvent = {
    id: makeId("source-event"),
    sourceName,
    sourceUrl,
    normalizedSourceUrl,
    normalizedFingerprint,
    sourceFilePath,
    rawText,
    status: duplicateOf ? "duplicate" : "pending",
    duplicateOfEventId: duplicateOf?.id ?? null,
    listingId: duplicateOf?.listingId ?? null,
    classification: duplicateOf ? "rejected" : null,
    classificationBlockers: duplicateOf ? ["Duplicate source event"] : [],
    errorMessage: null,
    importedAt: now,
    processedAt: duplicateOf ? now : null,
    createdAt: now,
    updatedAt: now,
  };

  db.insert(sourceEventsTable).values(sourceEventToRow(event)).run();

  return {
    event,
    duplicateOf,
    wasDuplicate: Boolean(duplicateOf),
  };
}

export async function runRadarOnce(options: RadarRunOptions = {}): Promise<RadarRunResult> {
  ensureDatabase();

  const now = options.now ?? new Date();
  const pendingEvents = listPendingSourceEvents();
  const run = createWatchRun({
    runType: options.runType ?? "one_shot",
    intervalMinutes: options.intervalMinutes ?? getRadarWatchIntervalMinutes(),
    eventsImported: options.eventsImported ?? 0,
    eventsSeen: pendingEvents.length,
    startedAt: now.toISOString(),
  });
  const processedEvents: SourceEvent[] = [];
  const failedEvents: SourceEvent[] = [];
  let listingsCreated = 0;
  let duplicatesFound = 0;
  let notificationsCreated = 0;

  for (const event of pendingEvents) {
    try {
      const result = await processSourceEvent(event, now);
      processedEvents.push(result.event);
      listingsCreated += result.listing ? 1 : 0;
      duplicatesFound += result.duplicate ? 1 : 0;
      notificationsCreated += result.notificationCreated ? 1 : 0;
    } catch (error) {
      const failedEvent = markSourceEventFailed(event, getErrorMessage(error), now);
      failedEvents.push(failedEvent);
    }
  }

  if (failedEvents.length > 0) {
    const recorded = await recordNotification({
      type: "watch_failure",
      sourceEventId: null,
      listingId: null,
      title: "Radar run failed",
      body: `${failedEvents.length} source event${failedEvents.length === 1 ? "" : "s"} failed during processing.`,
      dedupeKey: `watch_failure:${run.id}`,
    });
    notificationsCreated += recorded ? 1 : 0;
  }

  const finished = finishWatchRun(run.id, {
    status: failedEvents.length > 0 ? "failed" : "succeeded",
    finishedAt: new Date().toISOString(),
    eventsProcessed: processedEvents.length,
    listingsCreated,
    duplicatesFound,
    notificationsCreated,
    errorMessage: failedEvents.length > 0 ? "One or more source events failed." : null,
  });

  return {
    ...finished,
    processedEvents,
    failedEvents,
  };
}

export function getRadarDashboard(): RadarDashboard {
  const rows = listSourceEvents().map(toRadarRow);
  const rowsByClassification = {
    hot: rows.filter((row) => row.classification === "hot"),
    watch: rows.filter((row) => row.classification === "watch"),
    needs_review: rows.filter((row) => row.classification === "needs_review"),
    rejected: rows.filter((row) => row.classification === "rejected"),
  } satisfies Record<RadarClassification, RadarRow[]>;

  return {
    rows,
    rowsByClassification,
    lastRun: listWatchRuns(1)[0] ?? null,
    notifications: listNotifications(8),
    intervalMinutes: getRadarWatchIntervalMinutes(),
    sourceDirectory: getSourceDirectory(),
    pushStatus: getPushNotificationStatus(),
  };
}

export function classifyRadarListing({
  sourceEvent,
  listing,
  evaluation,
  now = new Date(),
}: {
  sourceEvent: SourceEvent;
  listing: Listing;
  evaluation: ListingEvaluation;
  now?: Date;
}): { classification: RadarClassification; blockers: string[] } {
  const blockers: string[] = [];
  const hardFilters = evaluation.hardFilters;
  const severeFilters = hardFilters.filter((filter) =>
    [
      "Rent exceeds max budget plus tolerance.",
      "Move-in date is impossible for the target window.",
      "Neighborhood is marked hard-no.",
      "Scam language is obvious.",
      "Listing is already unavailable.",
    ].includes(filter),
  );
  const feeNeedsReview = hardFilters.includes("Fee language is suspicious or unresolved.");
  const rent = effectiveRent(listing);
  const maxRent = searchProfile.maxRentMonthly;
  const budgetTolerance = searchProfile.budgetToleranceMonthly ?? 0;
  const fresh = isFresh(sourceEvent.importedAt, now);
  const addressKnown = hasKnownAddress(listing.address);
  const statusBlocksHot = listing.status !== "new";
  const commuteFailed = hardFilters.some((filter) => /commute/i.test(filter));

  if (listing.status === "dead" || listing.status === "leased") {
    return {
      classification: "rejected",
      blockers: [`Status is ${statusLabels[listing.status]}.`],
    };
  }

  if (severeFilters.length > 0 || commuteFailed) {
    return {
      classification: "rejected",
      blockers: unique([
        ...severeFilters,
        commuteFailed ? "Commute failed." : null,
      ]),
    };
  }

  if (!fresh) {
    blockers.push(`Older than ${freshWindowHours} hours.`);
  }

  if (statusBlocksHot) {
    blockers.push(`Status is ${statusLabels[listing.status]}.`);
  }

  if (rent === null) {
    blockers.push("Rent is missing.");
  } else if (maxRent !== null && rent > maxRent + budgetTolerance) {
    blockers.push("Rent exceeds acceptable range.");
  }

  if (!addressKnown) {
    blockers.push("Address is missing after parse.");
  }

  if (feeNeedsReview) {
    blockers.push("Fee language needs confirmation.");
  }

  if (!evaluation.eligible) {
    blockers.push(...hardFilters.filter((filter) => !severeFilters.includes(filter)));
  }

  const uniqueBlockers = unique(blockers);
  const hasReviewBlocker = uniqueBlockers.some((blocker) =>
    /address|rent is missing|fee|hard filter/i.test(blocker),
  );

  if (hasReviewBlocker || !evaluation.eligible) {
    return {
      classification: "needs_review",
      blockers: uniqueBlockers,
    };
  }

  if (!fresh || statusBlocksHot) {
    return {
      classification: "watch",
      blockers: uniqueBlockers,
    };
  }

  return {
    classification: "hot",
    blockers: [],
  };
}

export function buildOutreachMessage(listing: Listing, blockers: string[] = []) {
  const addressUnit = formatAddressUnit(listing);
  const needsClarification = !hasKnownAddress(listing.address) || blockers.some((blocker) => /address|fee/i.test(blocker));
  const template = needsClarification ? feeAddressClarificationCopy : defaultOutreachCopy;

  return template.replace("[address/unit]", addressUnit);
}

export function listSourceEvents() {
  ensureDatabase();
  return db.select().from(sourceEventsTable).orderBy(desc(sourceEventsTable.importedAt)).all().map(rowToSourceEvent);
}

export function listPendingSourceEvents() {
  ensureDatabase();
  return db
    .select()
    .from(sourceEventsTable)
    .where(eq(sourceEventsTable.status, "pending"))
    .orderBy(asc(sourceEventsTable.importedAt))
    .all()
    .map(rowToSourceEvent);
}

export function listWatchRuns(limit = 10) {
  ensureDatabase();
  return db
    .select()
    .from(watchRunsTable)
    .orderBy(desc(watchRunsTable.startedAt))
    .limit(limit)
    .all()
    .map(rowToWatchRun);
}

export function listNotifications(limit = 10) {
  ensureDatabase();
  return db
    .select()
    .from(notificationsTable)
    .orderBy(desc(notificationsTable.createdAt))
    .limit(limit)
    .all()
    .map(rowToNotification);
}

export function clearRadarData() {
  ensureDatabase();
  db.delete(notificationsTable).run();
  db.delete(watchRunsTable).run();
  db.delete(sourceEventsTable).run();
}

export function normalizeSourceUrl(value: string | null | undefined) {
  const trimmed = cleanString(value);

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    url.hostname = url.hostname.toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmed.toLowerCase().replace(/\s+/g, "");
  }
}

export function createSourceFingerprint(rawText: string) {
  const normalized = rawText
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\w$]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return createHash("sha256").update(normalized).digest("hex");
}

async function processSourceEvent(event: SourceEvent, now: Date): Promise<ProcessSourceEventResult> {
  const existingListing = findExistingListingBySourceUrl(event.normalizedSourceUrl);

  if (existingListing) {
    const updatedEvent = updateSourceEvent(event.id, {
      status: "duplicate",
      listingId: existingListing.id,
      classification: "rejected",
      classificationBlockers: ["Listing already captured from this source URL."],
      processedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return {
      event: updatedEvent,
      listing: null,
      classification: "rejected",
      notificationCreated: false,
      duplicate: true,
    };
  }

  const parsed = await parseListing({
    listingText: event.rawText,
    sourceUrl: event.sourceUrl,
    referenceDate: now.toISOString().slice(0, 10),
  });
  const listing = createListing({
    ...parsed.listing,
    sourceName: event.sourceName,
    sourceUrl: event.sourceUrl,
    rawText: event.rawText,
    status: "new",
  });
  const evaluation = scoreListing(listing, searchProfile);
  const { classification, blockers } = classifyRadarListing({
    sourceEvent: event,
    listing,
    evaluation,
    now,
  });
  const updatedEvent = updateSourceEvent(event.id, {
    status: "processed",
    listingId: listing.id,
    classification,
    classificationBlockers: blockers,
    processedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
  const notificationCreated = await recordNotificationForClassification(
    updatedEvent,
    listing,
    evaluation,
    classification,
    blockers,
  );

  return {
    event: updatedEvent,
    listing,
    classification,
    notificationCreated,
    duplicate: false,
  };
}

function toRadarRow(sourceEvent: SourceEvent): RadarRow {
  const bundle = sourceEvent.listingId ? getListingBundle(sourceEvent.listingId) : null;
  const listing = bundle?.listing ?? null;
  const classification = sourceEvent.classification ?? fallbackClassification(sourceEvent);
  const blockers = sourceEvent.classification
    ? sourceEvent.classificationBlockers
    : sourceEvent.classificationBlockers.length
      ? sourceEvent.classificationBlockers
      : fallbackBlockers(sourceEvent);

  return {
    id: sourceEvent.id,
    sourceEvent,
    bundle,
    classification,
    source: sourceEvent.sourceName,
    sourceUrl: sourceEvent.sourceUrl,
    ageLabel: formatAgeLabel(sourceEvent.importedAt),
    rentLabel: listing ? formatRentLabel(listing) : "Unknown",
    neighborhoodLabel: listing?.neighborhood ?? "Unknown",
    scoreLabel: bundle ? String(bundle.evaluation.totalScore) : "Not scored",
    blockers,
    nextAction: listing ? listing.nextAction : fallbackNextAction(sourceEvent),
    message: listing ? buildOutreachMessage(listing, blockers) : null,
    canMarkContacted: listing?.status === "new",
    canKill: Boolean(listing && listing.status !== "dead" && listing.status !== "leased"),
  };
}

function fallbackClassification(sourceEvent: SourceEvent): RadarClassification {
  if (sourceEvent.status === "pending") {
    return "needs_review";
  }

  return "rejected";
}

function fallbackBlockers(sourceEvent: SourceEvent) {
  if (sourceEvent.status === "pending") {
    return ["Pending radar run."];
  }

  if (sourceEvent.status === "failed") {
    return [sourceEvent.errorMessage ?? "Processing failed."];
  }

  if (sourceEvent.status === "duplicate") {
    return ["Duplicate source event."];
  }

  return ["No blockers recorded."];
}

function fallbackNextAction(sourceEvent: SourceEvent) {
  if (sourceEvent.status === "pending") {
    return "Run radar to parse this source event.";
  }

  if (sourceEvent.status === "failed") {
    return "Review the source message and import it again if the listing is still real.";
  }

  if (sourceEvent.status === "duplicate") {
    return "No action. This source event was already captured.";
  }

  return "No action.";
}

function createWatchRun({
  eventsImported,
  eventsSeen,
  intervalMinutes,
  runType,
  startedAt,
}: {
  eventsImported: number;
  eventsSeen: number;
  intervalMinutes: number;
  runType: WatchRunType;
  startedAt: string;
}) {
  const run: WatchRun = {
    id: makeId("watch-run"),
    runType,
    status: "running",
    intervalMinutes,
    startedAt,
    finishedAt: null,
    eventsSeen,
    eventsImported,
    eventsProcessed: 0,
    listingsCreated: 0,
    duplicatesFound: 0,
    notificationsCreated: 0,
    errorMessage: null,
  };

  db.insert(watchRunsTable).values(watchRunToRow(run)).run();
  return run;
}

function finishWatchRun(id: string, patch: Partial<WatchRun>) {
  const current = db.select().from(watchRunsTable).where(eq(watchRunsTable.id, id)).get();

  if (!current) {
    throw new Error("Watch run not found.");
  }

  const next: WatchRun = {
    ...rowToWatchRun(current),
    ...patch,
    id,
  };

  db.update(watchRunsTable).set(watchRunToRow(next)).where(eq(watchRunsTable.id, id)).run();
  return next;
}

function updateSourceEvent(id: string, patch: Partial<SourceEvent>) {
  const current = db.select().from(sourceEventsTable).where(eq(sourceEventsTable.id, id)).get();

  if (!current) {
    throw new Error("Source event not found.");
  }

  const next: SourceEvent = {
    ...rowToSourceEvent(current),
    ...patch,
    id,
  };

  db.update(sourceEventsTable).set(sourceEventToRow(next)).where(eq(sourceEventsTable.id, id)).run();
  return next;
}

function markSourceEventFailed(event: SourceEvent, message: string, now: Date) {
  return updateSourceEvent(event.id, {
    status: "failed",
    classification: "rejected",
    classificationBlockers: [message],
    errorMessage: message,
    processedAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });
}

async function recordNotificationForClassification(
  sourceEvent: SourceEvent,
  listing: Listing,
  evaluation: ListingEvaluation,
  classification: RadarClassification,
  blockers: string[],
) {
  if (classification !== "hot" && classification !== "needs_review") {
    return false;
  }

  const type: NotificationType = classification === "hot" ? "hot_listing" : "needs_review";
  const title = classification === "hot" ? "Hot listing" : "Listing needs review";
  const blockerText = blockers.length ? blockers.join("; ") : "Ready for outreach.";
  const location = listing.address ?? listing.neighborhood ?? "Location unknown";
  const body = [
    `${listing.title}`,
    `Source: ${sourceEvent.sourceName}`,
    `Rent: ${formatRentLabel(listing)}`,
    `Location: ${location}`,
    `Score: ${evaluation.totalScore}`,
    `Action: ${blockerText}`,
    sourceEvent.sourceUrl ? `Open: ${sourceEvent.sourceUrl}` : null,
  ].filter((line): line is string => Boolean(line)).join("\n");

  return recordNotification({
    type,
    sourceEventId: sourceEvent.id,
    listingId: listing.id,
    title,
    body,
    dedupeKey: `${type}:${listing.id}`,
    clickUrl: sourceEvent.sourceUrl,
  });
}

async function recordNotification({
  body,
  clickUrl,
  dedupeKey,
  listingId,
  sourceEventId,
  title,
  type,
}: {
  body: string;
  clickUrl?: string | null;
  dedupeKey: string;
  listingId: string | null;
  sourceEventId: string | null;
  title: string;
  type: NotificationType;
}) {
  const existing = db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.dedupeKey, dedupeKey))
    .get();

  if (existing) {
    return false;
  }

  const now = new Date().toISOString();
  const pushResult = await sendPushNotification({ body, clickUrl, title });
  const notification: Notification = {
    id: makeId("notification"),
    sourceEventId,
    listingId,
    type,
    channel: pushResult.channel,
    status: pushResult.status,
    title,
    body,
    dedupeKey,
    errorMessage: pushResult.errorMessage,
    createdAt: now,
    recordedAt: now,
  };

  db.insert(notificationsTable).values(notificationToRow(notification)).run();
  return true;
}

async function sendPushNotification({
  body,
  clickUrl,
  title,
}: {
  body: string;
  clickUrl?: string | null;
  title: string;
}): Promise<{ channel: NotificationChannel; errorMessage: string | null; status: NotificationStatus }> {
  const config = getNtfyConfig();

  if (!config) {
    return {
      channel: "local",
      errorMessage: null,
      status: "recorded",
    };
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "text/plain; charset=utf-8",
      Priority: "high",
      Tags: "house,rotating_light",
      Title: title,
    };

    if (clickUrl) {
      headers.Click = clickUrl;
    }

    const response = await fetch(`${config.baseUrl}/${encodeURIComponent(config.topic)}`, {
      body,
      headers,
      method: "POST",
    });

    if (!response.ok) {
      return {
        channel: "ntfy",
        errorMessage: `ntfy returned ${response.status}`,
        status: "failed",
      };
    }

    return {
      channel: "ntfy",
      errorMessage: null,
      status: "sent",
    };
  } catch (error) {
    return {
      channel: "ntfy",
      errorMessage: getErrorMessage(error),
      status: "failed",
    };
  }
}

function getNtfyConfig(): NtfyConfig | null {
  const channel = cleanString(
    process.env.APARTMENT_RADAR_NOTIFY_CHANNEL ?? process.env.STOOP_NOTIFY_CHANNEL,
  )?.toLowerCase();
  const topic = cleanString(process.env.APARTMENT_RADAR_NTFY_TOPIC ?? process.env.STOOP_NTFY_TOPIC);

  if (channel !== "ntfy" || !topic) {
    return null;
  }

  return {
    baseUrl: (cleanString(process.env.APARTMENT_RADAR_NTFY_BASE_URL ?? process.env.STOOP_NTFY_BASE_URL)
      ?? defaultNtfyBaseUrl).replace(/\/+$/, ""),
    topic,
  };
}

function findDuplicateSourceEvent(normalizedSourceUrl: string | null, normalizedFingerprint: string) {
  const whereClause = normalizedSourceUrl
    ? or(
        eq(sourceEventsTable.normalizedSourceUrl, normalizedSourceUrl),
        eq(sourceEventsTable.normalizedFingerprint, normalizedFingerprint),
      )
    : eq(sourceEventsTable.normalizedFingerprint, normalizedFingerprint);
  const rows = db
    .select()
    .from(sourceEventsTable)
    .where(whereClause)
    .orderBy(asc(sourceEventsTable.importedAt))
    .all()
    .map(rowToSourceEvent);

  return rows.find((row) => !row.duplicateOfEventId) ?? rows[0] ?? null;
}

function findSourceEventBySourceFilePath(sourceFilePath: string) {
  const row = db
    .select()
    .from(sourceEventsTable)
    .where(eq(sourceEventsTable.sourceFilePath, sourceFilePath))
    .get();

  return row ? rowToSourceEvent(row) : null;
}

function findExistingListingBySourceUrl(normalizedSourceUrl: string | null) {
  if (!normalizedSourceUrl) {
    return null;
  }

  return listListings().find((listing) => normalizeSourceUrl(listing.sourceUrl) === normalizedSourceUrl) ?? null;
}

export function detectSourceName({
  rawText,
  sourceName,
  sourceUrl,
}: {
  rawText?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
}) {
  const explicit = cleanString(sourceName);

  if (explicit) {
    return explicit;
  }

  const haystack = `${sourceUrl ?? ""}\n${rawText ?? ""}`.toLowerCase();
  const sources = [
    ["streeteasy", "StreetEasy"],
    ["zillow", "Zillow"],
    ["craigslist", "Craigslist"],
    ["nooklyn", "Nooklyn"],
  ] as const;
  const match = sources.find(([needle]) => haystack.includes(needle));

  if (match) {
    return match[1];
  }

  return deriveSourceName(sourceUrl ?? extractFirstUrl(rawText ?? ""));
}

function deriveSourceName(sourceUrl: string | null) {
  const normalized = normalizeSourceUrl(sourceUrl);

  if (!normalized) {
    return "Source message";
  }

  try {
    return new URL(normalized).hostname.replace(/^www\./, "");
  } catch {
    return "Source message";
  }
}

function normalizeSourceFilePath(value: string | null | undefined) {
  const cleaned = cleanString(value);

  if (!cleaned) {
    return null;
  }

  return resolveWorkspacePath(cleaned);
}

function resolveWorkspacePath(value: string) {
  if (/^(?:\/|[A-Za-z]:[\\/])/.test(value)) {
    return value;
  }

  return `${process.cwd()}/${value.replace(/^(?:\.\/)+/, "")}`;
}

function extractFirstUrl(text: string) {
  const match = text.match(/https?:\/\/[^\s<>)"']+/i)?.[0];
  return cleanString(match?.replace(/[.,;:!?]+$/, ""));
}

function isFresh(importedAt: string, now: Date) {
  const importedTime = new Date(importedAt).getTime();

  if (Number.isNaN(importedTime)) {
    return false;
  }

  return now.getTime() - importedTime <= freshWindowHours * 60 * 60 * 1000;
}

function hasKnownAddress(address: string | null) {
  const normalized = normalizeText(address);

  return Boolean(
    normalized &&
      !missingAddressMarkers.some((marker) => normalized === marker || normalized.includes(marker)),
  );
}

function effectiveRent(listing: Listing) {
  return listing.rentMonthly ?? listing.netEffectiveRent ?? null;
}

function formatAddressUnit(listing: Listing) {
  const address = cleanString(listing.address);
  const unit = cleanString(listing.unit);

  if (address && unit && !address.toLowerCase().includes(unit.toLowerCase())) {
    return `${address}, ${unit}`;
  }

  return address ?? listing.title;
}

function formatAgeLabel(value: string) {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));

  if (elapsedMinutes < 1) {
    return "Just now";
  }

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} min`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);

  if (elapsedHours < 24) {
    return `${elapsedHours} hr`;
  }

  return `${Math.round(elapsedHours / 24)} days`;
}

function formatRentLabel(listing: Listing) {
  const rent = effectiveRent(listing);

  if (rent === null) {
    return "Unknown";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(rent);
}

function cleanString(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function unique(values: Array<string | null>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function makeId(prefix: string) {
  return `${prefix}-${randomUUID().slice(0, 12)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Radar processing failed.";
}
