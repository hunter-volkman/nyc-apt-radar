import { nextActionForListing } from "../core/ranking";
import { commuteSummary } from "../core/transit";
import type { Listing } from "../core/listings";
import type { PreferenceProfile } from "../core/preferences";
import { fetchWithTimeout, readPositiveIntegerEnv } from "../config/timeouts";
import {
  claimNotificationSend,
  getNotification,
  markNotificationFailed,
  markNotificationSent,
  recordNotification,
} from "../storage/notifications";

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

export type NtfyConfig = {
  topic: string;
  baseUrl: string;
  publishUrl: string;
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

export function readNtfyConfig(): NtfyConfig {
  const topic = validateNtfyTopic(process.env.NYC_APT_RADAR_NTFY_TOPIC);
  const baseUrl = validateNtfyBaseUrl(process.env.NYC_APT_RADAR_NTFY_BASE_URL ?? "https://ntfy.sh");

  return {
    topic,
    baseUrl,
    publishUrl: `${baseUrl}/${encodeURIComponent(topic)}`,
  };
}

export function validateNtfyTopic(topic: string | undefined) {
  const trimmed = topic?.trim();

  if (!trimmed) {
    throw new Error("NYC_APT_RADAR_NTFY_TOPIC is required to send ntfy notifications.");
  }

  if (/[/?#]/.test(trimmed)) {
    throw new Error("NYC_APT_RADAR_NTFY_TOPIC must be a topic name, not a path or URL.");
  }

  return trimmed;
}

export function validateNtfyBaseUrl(baseUrl: string) {
  let parsed: URL;

  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error("NYC_APT_RADAR_NTFY_BASE_URL must be a valid HTTPS origin, such as https://ntfy.sh.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("NYC_APT_RADAR_NTFY_BASE_URL must use HTTPS.");
  }

  if (parsed.username || parsed.password || (parsed.pathname !== "" && parsed.pathname !== "/") || parsed.search || parsed.hash) {
    throw new Error("NYC_APT_RADAR_NTFY_BASE_URL must be an HTTPS origin only, such as https://ntfy.sh.");
  }

  return parsed.origin;
}

export async function sendNtfyMessage(message: NtfyMessage) {
  const config = readNtfyConfig();
  const response = await fetchWithTimeout(config.publishUrl, {
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
  const message = ntfyMessageForListing(listing, profile);
  const claim = claimNotificationSend({
    listingId: listing.id,
    dedupeKey,
    channel: "ntfy",
    title: message.title,
    body: message.body,
  });

  if (!claim.claimed) {
    const status = claim.notification?.status;
    recordNotification({
      listingId: listing.id,
      dedupeKey: `deduped:${listing.id}:${listing.score}`,
      channel: "ntfy",
      status: "deduped",
      title: message.title,
      body: message.body,
      errorMessage: status === "sending"
        ? "Notification is already being sent for this listing score."
        : "Notification already sent for this listing score.",
    });

    return {
      sent: false,
      skipped: true,
      channel: "ntfy",
      message: status === "sending"
        ? "Notification is already being sent for this score."
        : "Notification already sent for this score.",
    };
  }

  try {
    await sendNtfyMessage(message);
    markNotificationSent(dedupeKey);

    return {
      sent: true,
      skipped: false,
      channel: "ntfy",
      message: "Sent ntfy notification.",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    markNotificationFailed(dedupeKey, errorMessage);

    return {
      sent: false,
      skipped: false,
      channel: "ntfy",
      message: errorMessage,
    };
  }
}

export function recordNotificationDecisionWithoutSending(
  listing: Listing,
  profile: PreferenceProfile,
  reason = "Live notification disabled by --no-notify.",
): NotificationResult {
  const message = ntfyMessageForListing(listing, profile);

  if (listing.status === "rejected") {
    recordNotification({
      listingId: listing.id,
      dedupeKey: `skipped:${listing.id}:${listing.score}:rejected`,
      channel: "ntfy",
      status: "skipped",
      title: message.title,
      body: message.body,
      errorMessage: "Listing is rejected.",
    });

    return {
      sent: false,
      skipped: true,
      channel: "ntfy",
      message: "Listing is rejected.",
    };
  }

  if (listing.score < profile.hotScore) {
    recordNotification({
      listingId: listing.id,
      dedupeKey: `skipped:${listing.id}:${listing.score}:below-threshold`,
      channel: "ntfy",
      status: "skipped",
      title: message.title,
      body: message.body,
      errorMessage: `Score ${listing.score} is below hot threshold ${profile.hotScore}.`,
    });

    return {
      sent: false,
      skipped: true,
      channel: "ntfy",
      message: `Score ${listing.score} is below hot threshold ${profile.hotScore}.`,
    };
  }

  const alreadySent = getNotification(`hot:${listing.id}:${listing.score}`)?.status === "sent";
  if (alreadySent) {
    recordNotification({
      listingId: listing.id,
      dedupeKey: `deduped:${listing.id}:${listing.score}`,
      channel: "ntfy",
      status: "deduped",
      title: message.title,
      body: message.body,
      errorMessage: "Notification already sent for this listing score.",
    });

    return {
      sent: false,
      skipped: true,
      channel: "ntfy",
      message: "Notification already sent for this score.",
    };
  }

  recordNotification({
    listingId: listing.id,
    dedupeKey: `skipped:${listing.id}:${listing.score}:no-live-send`,
    channel: "ntfy",
    status: "skipped",
    title: message.title,
    body: message.body,
    errorMessage: reason,
  });

  return {
    sent: false,
    skipped: true,
    channel: "ntfy",
    message: reason,
  };
}
