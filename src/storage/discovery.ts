import { createHash, randomUUID } from "node:crypto";
import { ensureDatabase, sqlite } from "./database";

export type SourceEventStatus = "processed" | "duplicate" | "failed";

export type SourceEventDraft = {
  sourceId: string;
  sourceType: string;
  sourceRef: string;
  rawText: string;
  discoveredAt?: string | null;
};

export type SourceCollectionFailureDraft = {
  sourceId: string;
  sourceType: string;
  sourceRef: string;
  errorMessage: string;
  discoveredAt?: string | null;
};

export type SourceEvent = SourceEventDraft & {
  id: string;
  fingerprint: string;
  status: SourceEventStatus;
  listingsFound: number;
  errorMessage: string | null;
  discoveredAt: string;
  processedAt: string | null;
};

type SourceEventRow = {
  id: string;
  source_id: string;
  source_type: string;
  source_ref: string;
  fingerprint: string;
  raw_text: string;
  status: SourceEventStatus;
  listings_found: number;
  error_message: string | null;
  discovered_at: string;
  processed_at: string | null;
};

export function createSourceEvent(draft: SourceEventDraft): { event: SourceEvent; duplicate: boolean } {
  ensureDatabase();

  const fingerprint = sourceFingerprint(draft);
  const now = draft.discoveredAt ?? new Date().toISOString();
  const existing = findSourceEventByFingerprint(fingerprint);

  if (existing) {
    return {
      event: {
        ...existing,
        status: "duplicate",
      },
      duplicate: true,
    };
  }

  const event: SourceEvent = {
    ...draft,
    id: `event-${randomUUID()}`,
    fingerprint,
    status: "processed",
    listingsFound: 0,
    errorMessage: null,
    discoveredAt: now,
    processedAt: null,
  };

  sqlite.prepare(`
    INSERT INTO source_events (
      id,
      source_id,
      source_type,
      source_ref,
      fingerprint,
      raw_text,
      status,
      listings_found,
      error_message,
      discovered_at,
      processed_at
    ) VALUES (
      @id,
      @sourceId,
      @sourceType,
      @sourceRef,
      @fingerprint,
      @rawText,
      @status,
      @listingsFound,
      @errorMessage,
      @discoveredAt,
      @processedAt
    )
  `).run(event);

  return { event, duplicate: false };
}

export function markSourceEventProcessed(id: string, listingsFound: number) {
  ensureDatabase();
  sqlite.prepare(`
    UPDATE source_events
    SET status = 'processed', listings_found = ?, processed_at = ?
    WHERE id = ?
  `).run(listingsFound, new Date().toISOString(), id);
}

export function markSourceEventFailed(id: string, error: string) {
  ensureDatabase();
  sqlite.prepare(`
    UPDATE source_events
    SET status = 'failed', error_message = ?, processed_at = ?
    WHERE id = ?
  `).run(error, new Date().toISOString(), id);
}

export function recordSourceCollectionFailure(draft: SourceCollectionFailureDraft) {
  ensureDatabase();
  const now = draft.discoveredAt ?? new Date().toISOString();
  const rawText = `SOURCE_COLLECTION_ERROR\n${draft.errorMessage}`;
  const fingerprint = sourceFingerprint({
    sourceId: draft.sourceId,
    sourceType: draft.sourceType,
    sourceRef: draft.sourceRef,
    rawText,
    discoveredAt: now,
  });
  const existing = findSourceEventByFingerprint(fingerprint);

  if (existing) {
    sqlite.prepare(`
      UPDATE source_events
      SET status = 'failed', error_message = ?, discovered_at = ?, processed_at = ?
      WHERE id = ?
    `).run(draft.errorMessage, now, now, existing.id);

    return {
      ...existing,
      status: "failed" as const,
      errorMessage: draft.errorMessage,
      discoveredAt: now,
      processedAt: now,
    };
  }

  const event: SourceEvent = {
    sourceId: draft.sourceId,
    sourceType: draft.sourceType,
    sourceRef: draft.sourceRef,
    rawText,
    id: `event-${randomUUID()}`,
    fingerprint,
    status: "failed",
    listingsFound: 0,
    errorMessage: draft.errorMessage,
    discoveredAt: now,
    processedAt: now,
  };

  sqlite.prepare(`
    INSERT INTO source_events (
      id,
      source_id,
      source_type,
      source_ref,
      fingerprint,
      raw_text,
      status,
      listings_found,
      error_message,
      discovered_at,
      processed_at
    ) VALUES (
      @id,
      @sourceId,
      @sourceType,
      @sourceRef,
      @fingerprint,
      @rawText,
      @status,
      @listingsFound,
      @errorMessage,
      @discoveredAt,
      @processedAt
    )
  `).run(event);

  return event;
}

export function clearSourceEvents() {
  ensureDatabase();
  sqlite.prepare("DELETE FROM source_events").run();
}

export function listSourceEvents(limit = 20) {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM source_events ORDER BY discovered_at DESC, processed_at DESC LIMIT ?")
    .all(limit) as SourceEventRow[];

  return rows.map(rowToSourceEvent);
}

function findSourceEventByFingerprint(fingerprint: string) {
  const row = sqlite
    .prepare("SELECT * FROM source_events WHERE fingerprint = ?")
    .get(fingerprint) as SourceEventRow | undefined;

  return row ? rowToSourceEvent(row) : null;
}

function rowToSourceEvent(row: SourceEventRow): SourceEvent {
  return {
    id: row.id,
    sourceId: row.source_id,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    fingerprint: row.fingerprint,
    rawText: row.raw_text,
    status: row.status,
    listingsFound: row.listings_found,
    errorMessage: row.error_message,
    discoveredAt: row.discovered_at,
    processedAt: row.processed_at,
  };
}

function sourceFingerprint(draft: SourceEventDraft) {
  return createHash("sha256")
    .update(`${draft.sourceId}\n${draft.sourceRef}\n${draft.rawText}`)
    .digest("hex");
}
