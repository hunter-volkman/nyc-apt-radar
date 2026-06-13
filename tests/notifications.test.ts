import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListingDraft } from "../src/core/listings";
import { finalizeListing } from "../src/core/finalize-listing";
import { defaultPreferenceProfile } from "../src/core/preferences";
import { scoreAndExplain } from "../src/core/scoring";

const now = new Date("2026-06-12T18:00:00.000Z");
const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-notifications-test-"));
process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "radar.sqlite");

afterEach(async () => {
  const { clearNotifications } = await import("../src/storage/notifications.js");
  clearNotifications();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.NYC_APT_RADAR_NTFY_TOPIC;
  delete process.env.NYC_APT_RADAR_NTFY_BASE_URL;
  delete process.env.NYC_APT_RADAR_NTFY_TIMEOUT_MS;
});

describe("notification delivery claims", () => {
  it("claims a hot notification before sending and dedupes an in-flight send", async () => {
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "claim-topic";
    process.env.NYC_APT_RADAR_NTFY_BASE_URL = "https://ntfy.test";
    let resolveFetch: (response: Response) => void = () => {
      throw new Error("fetch was not called.");
    };
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { notifyIfInteresting } = await import("../src/notifications/ntfy.js");
    const { listNotifications } = await import("../src/storage/notifications.js");
    const listing = hotListing({ id: "in-flight-hot-listing" });

    const first = notifyIfInteresting(listing, defaultPreferenceProfile);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const duplicate = await notifyIfInteresting(listing, defaultPreferenceProfile);
    resolveFetch(new Response("ok", { status: 200 }));
    const sent = await first;
    const notifications = listNotifications();
    const hotRecord = notifications.find((notification) => notification.dedupeKey === `hot:${listing.id}:${listing.score}`);

    expect(sent.sent).toBe(true);
    expect(duplicate.sent).toBe(false);
    expect(duplicate.skipped).toBe(true);
    expect(duplicate.message).toContain("already being sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(hotRecord?.status).toBe("sent");
    expect(notifications.some((notification) => notification.status === "deduped")).toBe(true);
  });

  it("allows failed notification claims to be retried but blocks sent claims", async () => {
    const {
      claimNotificationSend,
      markNotificationFailed,
      markNotificationSent,
    } = await import("../src/storage/notifications.js");
    const draft = {
      listingId: "retry-claim-listing",
      dedupeKey: "hot:retry-claim-listing:91",
      channel: "ntfy" as const,
      title: "91/100 Retry claim",
      body: "Retry body",
    };

    const first = claimNotificationSend(draft);
    const inFlight = claimNotificationSend(draft);
    const failed = markNotificationFailed(draft.dedupeKey, "temporary failure");
    const retry = claimNotificationSend(draft);
    const sent = markNotificationSent(draft.dedupeKey);
    const afterSent = claimNotificationSend(draft);

    expect(first.claimed).toBe(true);
    expect(first.notification?.status).toBe("sending");
    expect(inFlight.claimed).toBe(false);
    expect(inFlight.notification?.status).toBe("sending");
    expect(failed?.status).toBe("failed");
    expect(retry.claimed).toBe(true);
    expect(retry.notification?.status).toBe("sending");
    expect(sent?.status).toBe("sent");
    expect(afterSent.claimed).toBe(false);
    expect(afterSent.notification?.status).toBe("sent");
  });
});

describe("ntfy config validation", () => {
  it("defaults to https://ntfy.sh and posts to the configured topic", async () => {
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "private-topic";
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { sendNtfyMessage } = await import("../src/notifications/ntfy.js");
    await sendNtfyMessage({
      title: "Test",
      body: "Body",
    });

    expect(fetchMock).toHaveBeenCalledWith("https://ntfy.sh/private-topic", expect.objectContaining({
      method: "POST",
    }));
  });

  it("rejects topics that include path, query, or fragment separators", async () => {
    const { sendNtfyMessage } = await import("../src/notifications/ntfy.js");

    for (const topic of ["private/topic", "private?topic", "private#topic"]) {
      process.env.NYC_APT_RADAR_NTFY_TOPIC = topic;
      await expect(sendNtfyMessage({ title: "Test", body: "Body" })).rejects.toThrow(/topic name/);
    }
  });

  it("requires an HTTPS origin-only ntfy base URL", async () => {
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "private-topic";
    const { sendNtfyMessage } = await import("../src/notifications/ntfy.js");

    for (const baseUrl of ["http://ntfy.test", "https://ntfy.test/custom", "https://ntfy.test?topic=private"]) {
      process.env.NYC_APT_RADAR_NTFY_BASE_URL = baseUrl;
      await expect(sendNtfyMessage({ title: "Test", body: "Body" })).rejects.toThrow(/HTTPS|origin/);
    }
  });
});

function hotListing(overrides: ListingDraft) {
  return scoreAndExplain(finalizeListing({
    source: "test",
    sourceUrl: "https://fixture.test/listing",
    title: "Chelsea hot lead",
    address: "345 W 30th St #4B",
    neighborhood: "Chelsea",
    borough: "Manhattan",
    rent: 3700,
    bedrooms: 1,
    bathrooms: 1,
    availableDate: "2026-07-01",
    description: "",
    amenities: ["laundry", "dishwasher"],
    pets: "cats_allowed",
    feeStatus: "no_fee",
    latitude: 40.7502,
    longitude: -73.9970,
    firstSeenAt: "2026-06-12T12:00:00.000Z",
    lastSeenAt: "2026-06-12T12:00:00.000Z",
    ...overrides,
  }, now), defaultPreferenceProfile, now);
}
