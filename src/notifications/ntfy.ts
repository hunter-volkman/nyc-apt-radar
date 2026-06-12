import { nextActionForListing } from "../core/ranking";
import { commuteSummary } from "../core/transit";
import type { Listing } from "../core/listings";
import type { PreferenceProfile } from "../core/preferences";
import { fetchWithTimeout, readPositiveIntegerEnv } from "../config/timeouts";
import { getNotification, recordNotification } from "../storage/notifications";

export type NotificationResult = {
  sent: boolean;
  skipped: boolean;
  channel: "ntfy";
  message: string;
};

export type NtfyMessage = {
  title: string;
  body: string;
  priority?: "min" | "low" | "default" | "high" | "urgent";
  tags?: string;
};

export function ntfyMessageForListing(listing: Listing, profile: PreferenceProfile): NtfyMessage {
  return {
    title: `${listing.score}/100 ${listing.title}`,
    body: [
      listing.rent === null ? "Rent unknown" : `$${listing.rent.toLocaleString("en-US")}`,
      listing.neighborhood ?? "Neighborhood unknown",
      commuteSummary(listing, profile),
      nextActionForListing(listing),
      listing.sourceUrl ?? null,
    ].filter(Boolean).join("\n"),
    tags: "house,rotating_light",
    priority: listing.score >= 85 ? "high" : "default",
  };
}

export async function sendNtfyMessage(message: NtfyMessage) {
  const topic = process.env.NYC_APT_RADAR_NTFY_TOPIC;
  if (!topic) {
    throw new Error("NYC_APT_RADAR_NTFY_TOPIC is required to send ntfy notifications.");
  }

  const baseUrl = process.env.NYC_APT_RADAR_NTFY_BASE_URL ?? "https://ntfy.sh";
  const response = await fetchWithTimeout(`${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(topic)}`, {
    method: "POST",
    headers: {
      Title: message.title,
      Tags: message.tags ?? "house",
      Priority: message.priority ?? "default",
    },
    body: message.body,
  }, readPositiveIntegerEnv("NYC_APT_RADAR_NTFY_TIMEOUT_MS", 10000));

  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`);
  }
}

export async function notifyIfInteresting(listing: Listing, profile: PreferenceProfile): Promise<NotificationResult> {
  if (listing.status === "rejected" || listing.score < profile.hotScore) {
    return {
      sent: false,
      skipped: true,
      channel: "ntfy",
      message: "Listing did not meet notification threshold.",
    };
  }

  const dedupeKey = `hot:${listing.id}:${listing.score}`;
  const existingNotification = getNotification(dedupeKey);
  const hasTopic = Boolean(process.env.NYC_APT_RADAR_NTFY_TOPIC);

  if (existingNotification?.status === "sent") {
    return {
      sent: false,
      skipped: true,
      channel: "ntfy",
      message: "Notification already sent for this score.",
    };
  }

  const message = ntfyMessageForListing(listing, profile);

  if (!hasTopic) {
    recordNotification({
      listingId: listing.id,
      dedupeKey,
      channel: "ntfy",
      status: "failed",
      title: message.title,
      body: message.body,
      errorMessage: "Missing NYC_APT_RADAR_NTFY_TOPIC.",
    });

    return {
      sent: false,
      skipped: false,
      channel: "ntfy",
      message: "Missing NYC_APT_RADAR_NTFY_TOPIC.",
    };
  }

  try {
    await sendNtfyMessage(message);

    recordNotification({
      listingId: listing.id,
      dedupeKey,
      channel: "ntfy",
      status: "sent",
      title: message.title,
      body: message.body,
      errorMessage: null,
      sentAt: new Date().toISOString(),
    });

    return {
      sent: true,
      skipped: false,
      channel: "ntfy",
      message: "Sent ntfy notification.",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    recordNotification({
      listingId: listing.id,
      dedupeKey,
      channel: "ntfy",
      status: "failed",
      title: message.title,
      body: message.body,
      errorMessage,
    });

    return {
      sent: false,
      skipped: false,
      channel: "ntfy",
      message: errorMessage,
    };
  }
}
