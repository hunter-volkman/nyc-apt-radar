import type {
  NewNotificationRow,
  NewSourceEventRow,
  NewWatchRunRow,
  NotificationRow,
  SourceEventRow,
  WatchRunRow,
} from "@/db/schema";
import type { Notification, SourceEvent, WatchRun } from "@/lib/types";

export function rowToSourceEvent(row: SourceEventRow): SourceEvent {
  return {
    id: row.id,
    sourceName: row.sourceName,
    sourceUrl: row.sourceUrl,
    normalizedSourceUrl: row.normalizedSourceUrl,
    normalizedFingerprint: row.normalizedFingerprint,
    rawText: row.rawText,
    status: row.status,
    duplicateOfEventId: row.duplicateOfEventId,
    listingId: row.listingId,
    classification: row.classification,
    classificationBlockers: row.classificationBlockers,
    errorMessage: row.errorMessage,
    importedAt: row.importedAt,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function sourceEventToRow(event: SourceEvent): NewSourceEventRow {
  return {
    id: event.id,
    sourceName: event.sourceName,
    sourceUrl: event.sourceUrl,
    normalizedSourceUrl: event.normalizedSourceUrl,
    normalizedFingerprint: event.normalizedFingerprint,
    rawText: event.rawText,
    status: event.status,
    duplicateOfEventId: event.duplicateOfEventId,
    listingId: event.listingId,
    classification: event.classification,
    classificationBlockers: event.classificationBlockers,
    errorMessage: event.errorMessage,
    importedAt: event.importedAt,
    processedAt: event.processedAt,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

export function rowToWatchRun(row: WatchRunRow): WatchRun {
  return {
    id: row.id,
    runType: row.runType,
    status: row.status,
    intervalMinutes: row.intervalMinutes,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    eventsSeen: row.eventsSeen,
    eventsImported: row.eventsImported,
    eventsProcessed: row.eventsProcessed,
    listingsCreated: row.listingsCreated,
    duplicatesFound: row.duplicatesFound,
    notificationsCreated: row.notificationsCreated,
    errorMessage: row.errorMessage,
  };
}

export function watchRunToRow(run: WatchRun): NewWatchRunRow {
  return {
    id: run.id,
    runType: run.runType,
    status: run.status,
    intervalMinutes: run.intervalMinutes,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    eventsSeen: run.eventsSeen,
    eventsImported: run.eventsImported,
    eventsProcessed: run.eventsProcessed,
    listingsCreated: run.listingsCreated,
    duplicatesFound: run.duplicatesFound,
    notificationsCreated: run.notificationsCreated,
    errorMessage: run.errorMessage,
  };
}

export function rowToNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    sourceEventId: row.sourceEventId,
    listingId: row.listingId,
    type: row.type,
    channel: row.channel,
    status: row.status,
    title: row.title,
    body: row.body,
    dedupeKey: row.dedupeKey,
    createdAt: row.createdAt,
    recordedAt: row.recordedAt,
  };
}

export function notificationToRow(notification: Notification): NewNotificationRow {
  return {
    id: notification.id,
    sourceEventId: notification.sourceEventId,
    listingId: notification.listingId,
    type: notification.type,
    channel: notification.channel,
    status: notification.status,
    title: notification.title,
    body: notification.body,
    dedupeKey: notification.dedupeKey,
    createdAt: notification.createdAt,
    recordedAt: notification.recordedAt,
  };
}
