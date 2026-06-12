import { randomUUID } from "node:crypto";
import { ensureDatabase, sqlite } from "./database";

export type NotificationStatus = "sent" | "failed";

export type NotificationRecord = {
  id: string;
  listingId: string;
  dedupeKey: string;
  channel: "ntfy";
  status: NotificationStatus;
  title: string;
  body: string;
  errorMessage: string | null;
  createdAt: string;
  sentAt: string | null;
};

type NotificationRow = {
  id: string;
  listing_id: string;
  dedupe_key: string;
  channel: "ntfy";
  status: NotificationStatus;
  title: string;
  body: string;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
};

export function getNotification(dedupeKey: string) {
  ensureDatabase();
  const row = sqlite.prepare("SELECT * FROM notifications WHERE dedupe_key = ?").get(dedupeKey) as NotificationRow | undefined;
  return row ? rowToNotification(row) : null;
}

export function hasNotification(dedupeKey: string, statuses?: NotificationStatus[]) {
  const notification = getNotification(dedupeKey);

  if (!notification) {
    return false;
  }

  return statuses ? statuses.includes(notification.status) : true;
}

export function recordNotification(draft: Omit<NotificationRecord, "id" | "createdAt" | "sentAt"> & { sentAt?: string | null }) {
  ensureDatabase();

  const record: NotificationRecord = {
    ...draft,
    id: `notification-${randomUUID()}`,
    createdAt: new Date().toISOString(),
    sentAt: draft.sentAt ?? null,
  };

  sqlite.prepare(`
    INSERT INTO notifications (
      id,
      listing_id,
      dedupe_key,
      channel,
      status,
      title,
      body,
      error_message,
      created_at,
      sent_at
    ) VALUES (
      @id,
      @listingId,
      @dedupeKey,
      @channel,
      @status,
      @title,
      @body,
      @errorMessage,
      @createdAt,
      @sentAt
    )
    ON CONFLICT(dedupe_key) DO UPDATE SET
      listing_id = excluded.listing_id,
      channel = excluded.channel,
      status = excluded.status,
      title = excluded.title,
      body = excluded.body,
      error_message = excluded.error_message,
      sent_at = excluded.sent_at
  `).run(record);

  return record;
}

export function listNotifications() {
  ensureDatabase();
  const rows = sqlite
    .prepare("SELECT * FROM notifications ORDER BY created_at DESC")
    .all() as NotificationRow[];

  return rows.map(rowToNotification);
}

export function clearNotifications() {
  ensureDatabase();
  sqlite.prepare("DELETE FROM notifications").run();
}

function rowToNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    listingId: row.listing_id,
    dedupeKey: row.dedupe_key,
    channel: row.channel,
    status: row.status,
    title: row.title,
    body: row.body,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}
