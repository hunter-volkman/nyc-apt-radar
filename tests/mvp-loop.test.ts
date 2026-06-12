import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ListingDraft } from "../src/core/listings";
import { finalizeListing } from "../src/core/finalize-listing";
import { generateOutreachDraft } from "../src/core/outreach";
import { defaultPreferenceProfile, loadPreferenceProfile } from "../src/core/preferences";
import { rankListings } from "../src/core/ranking";
import { scoreAndExplain, scoreListing } from "../src/core/scoring";
import { estimateCommutes } from "../src/core/transit";

const now = new Date("2026-06-12T18:00:00.000Z");
const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-test-"));
process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "radar.sqlite");

afterEach(async () => {
  vi.useRealTimers();
  const [
    { clearSourceEvents },
    { clearListings },
    { clearNotifications },
  ] = await Promise.all([
    import("../src/storage/discovery.js"),
    import("../src/storage/listings.js"),
    import("../src/storage/notifications.js"),
  ]);
  clearListings();
  clearSourceEvents();
  clearNotifications();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.NYC_APT_RADAR_NTFY_TOPIC;
  delete process.env.NYC_APT_RADAR_NTFY_BASE_URL;
  delete process.env.NYC_APT_RADAR_NTFY_TIMEOUT_MS;
  delete process.env.NYC_APT_RADAR_PREFERENCES_PATH;
  delete process.env.NYC_APT_RADAR_SOURCES_PATH;
  delete process.env.NYC_APT_RADAR_SOURCE_URLS;
  delete process.env.NYC_APT_RADAR_FETCH_TIMEOUT_MS;
  delete process.env.NYC_APT_RADAR_OPENAI_TIMEOUT_MS;
  delete process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES;
  delete process.env.OPENAI_API_KEY;
});

describe("MVP apartment radar loop", () => {
  it("scores a strong listing with deterministic weighted categories", () => {
    const listing = scoreAndExplain(makeListing({
      title: "Chelsea 1BR near Penn",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      borough: "Manhattan",
      rent: 3795,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      amenities: ["dishwasher", "laundry", "near subway"],
    }), defaultPreferenceProfile, now);

    expect(listing.score).toBeGreaterThanOrEqual(90);
    expect(listing.scoreExplanation).toContain("under target budget");
    expect(listing.scoreExplanation).toContain("preferred neighborhood");
    expect(listing.scoreExplanation).toContain("cats allowed");
  });

  it("caps listings blocked by dealbreakers", () => {
    const evaluation = scoreListing(makeListing({
      title: "No pets apartment",
      neighborhood: "Chelsea",
      rent: 3500,
      pets: "no_pets",
    }), defaultPreferenceProfile, now);

    expect(evaluation.dealbreakers).toContain("Cats are not allowed.");
    expect(evaluation.score).toBeLessThanOrEqual(49);
  });

  it("handles unknown fields by lowering confidence instead of rejecting the listing", () => {
    const evaluation = scoreListing(makeListing({
      title: "Mystery lead",
      sourceUrl: null,
      address: null,
      borough: null,
      rent: null,
      bedrooms: null,
      bathrooms: null,
      neighborhood: null,
      pets: "unknown",
      feeStatus: "unknown",
    }), defaultPreferenceProfile, now);

    expect(evaluation.score).toBeGreaterThan(0);
    expect(evaluation.dealbreakers).toEqual([]);
    expect(evaluation.confidence).toBe("low");
    expect(evaluation.explanation).toContain("rent unknown");
    expect(evaluation.explanation).toContain("fee status unknown");
  });

  it("ranks by score before recency", () => {
    const weaker = scoreAndExplain(makeListing({
      id: "weaker",
      title: "Stretch rent Williamsburg",
      neighborhood: "Williamsburg",
      rent: 4095,
      firstSeenAt: "2026-06-12T17:30:00.000Z",
      lastSeenAt: "2026-06-12T17:30:00.000Z",
    }), defaultPreferenceProfile, now);
    const stronger = scoreAndExplain(makeListing({
      id: "stronger",
      title: "Chelsea fit",
      neighborhood: "Chelsea",
      rent: 3700,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      firstSeenAt: "2026-06-12T15:00:00.000Z",
      lastSeenAt: "2026-06-12T15:00:00.000Z",
    }), defaultPreferenceProfile, now);

    expect(rankListings([weaker, stronger])[0]?.id).toBe("stronger");
  });

  it("estimates commute details with train lines, walk time, switches, and total time", () => {
    const listing = makeListing({
      title: "Chelsea 1BR near Penn",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      rent: 3795,
    });
    const commute = estimateCommutes(listing, defaultPreferenceProfile)[0];

    expect(commute).toBeDefined();
    expect(commute?.targetLabel).toBe("Bryant Park");
    expect(commute?.totalMinutes).toBeLessThanOrEqual(20);
    expect(commute?.walkToTrainMinutes).toBeGreaterThan(0);
    expect(commute?.lines.length).toBeGreaterThan(0);
    expect(commute?.transfers).toBeGreaterThanOrEqual(0);
    expect(commute?.summary).toContain("min via");
  });

  it("loads arbitrary commute targets from a JSON preference profile", () => {
    const preferencesPath = path.join(testWorkspace, "preferences.json");
    fs.writeFileSync(preferencesPath, JSON.stringify({
      name: "Config profile",
      commuteTargets: [
        {
          label: "Bryant Park",
          address: "Bryant Park, New York, NY",
          latitude: 40.7536,
          longitude: -73.9832,
          maxMinutes: 35,
        },
        {
          label: "Union Square",
          address: "Union Square, New York, NY",
          latitude: 40.7359,
          longitude: -73.9911,
          maxMinutes: 35,
        },
        {
          label: "Grand Central",
          address: "Grand Central Terminal, New York, NY",
          latitude: 40.7527,
          longitude: -73.9772,
          maxMinutes: 40,
        },
      ],
    }));

    const profile = loadPreferenceProfile(preferencesPath);
    const estimates = estimateCommutes(makeListing({
      title: "Williamsburg lead",
      address: "56 Ainslie Street #4G",
      neighborhood: "Williamsburg",
      rent: 3999,
    }), profile);

    expect(profile.name).toBe("Config profile");
    expect(estimates).toHaveLength(3);
    expect(estimates.map((estimate) => estimate.targetLabel)).toEqual(["Bryant Park", "Union Square", "Grand Central"]);
  });

  it("generates a human editable outreach draft without sending anything", () => {
    const listing = scoreAndExplain(makeListing({
      title: "56 Ainslie Street #4G",
      address: "56 Ainslie Street #4G",
      neighborhood: "Williamsburg",
      rent: 3999,
      contactName: null,
      appointmentAt: "2026-06-14T21:00:00.000Z",
      pets: "unknown",
      feeStatus: "unknown",
    }), defaultPreferenceProfile, now);
    const draft = generateOutreachDraft(listing, defaultPreferenceProfile);

    expect(draft).toContain("Hi,");
    expect(draft).toContain("Is it still available?");
    expect(draft).toContain("Please confirm that viewing time still works.");
    expect(draft).toContain("pet policy");
    expect(draft).toContain("broker fee");
  });
});

describe("automated discovery loop", () => {
  it("discovers listings from a watched source file and sends hot-match ntfy notifications", async () => {
    const sourceFile = path.join(testWorkspace, "source-file.json");
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "discovery-topic";
    process.env.NYC_APT_RADAR_NTFY_BASE_URL = "https://ntfy.test";
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    fs.writeFileSync(sourceFile, JSON.stringify({
      listings: [{
        title: "345 W 30th St #4B",
        sourceUrl: "https://streeteasy.com/building/345-west-30-street-new_york/4b",
        address: "345 W 30th St #4B",
        neighborhood: "Chelsea",
        borough: "Manhattan",
        rent: 3795,
        bedrooms: 1,
        bathrooms: 1,
        pets: "cats_allowed",
        feeStatus: "no_fee",
        amenities: ["laundry", "dishwasher"],
      }],
    }));

    const { runDiscoveryOnce } = await import("../src/discovery/agent-loop.js");
    const { listRankedListings } = await import("../src/storage/listings.js");
    const { listNotifications } = await import("../src/storage/notifications.js");

    const result = await runDiscoveryOnce({
      sources: [{
        id: "test-source",
        type: "file",
        path: sourceFile,
        sourceName: "Test source",
      }],
    });
    const listings = listRankedListings();
    const notifications = listNotifications();

    expect(result.documentsSeen).toBe(1);
    expect(result.listingsFound).toBe(1);
    expect(listings[0]?.title).toContain("345 W 30th St");
    expect(listings[0]?.score).toBeGreaterThanOrEqual(defaultPreferenceProfile.hotScore);
    expect(result.notificationsSent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(notifications[0]?.channel).toBe("ntfy");
    expect(notifications[0]?.status).toBe("sent");
    expect(notifications[0]?.body).toContain("Bryant Park");
  });

  it("lists source-event history for processed and failed documents", async () => {
    const {
      createSourceEvent,
      listSourceEvents,
      markSourceEventFailed,
      markSourceEventProcessed,
    } = await import("../src/storage/discovery.js");

    const processed = createSourceEvent({
      sourceId: "history-good",
      sourceType: "file",
      sourceRef: "good.txt",
      rawText: "345 W 30th St #4B\n$3,795",
      discoveredAt: "2026-06-12T12:00:00.000Z",
    });
    markSourceEventProcessed(processed.event.id, 1);

    const failed = createSourceEvent({
      sourceId: "history-bad",
      sourceType: "url",
      sourceRef: "https://fixture.test/bad-feed",
      rawText: "bad",
      discoveredAt: "2026-06-12T12:01:00.000Z",
    });
    markSourceEventFailed(failed.event.id, "Fetch failed");

    const events = listSourceEvents();

    expect(events).toHaveLength(2);
    expect(events.map((event) => event.status).sort()).toEqual(["failed", "processed"]);
    expect(events.find((event) => event.sourceId === "history-good")?.listingsFound).toBe(1);
    expect(events.find((event) => event.sourceId === "history-bad")?.errorMessage).toContain("Fetch failed");
  });

  it("collects listings from configured public URL sources with plain fetch", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      listings: [{
        title: "Chelsea 1BR near Penn",
        url: "https://fixture.test/chelsea-1br",
        address: "345 W 30th St #4B",
        neighborhood: "Chelsea",
        borough: "Manhattan",
        rent: 3795,
        beds: 1,
        baths: 1,
        pets: "cats_allowed",
        fee_status: "no_fee",
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { runDiscoveryOnce } = await import("../src/discovery/agent-loop.js");
    const result = await runDiscoveryOnce({
      notify: false,
      sources: [{
        id: "public-url-source",
        type: "url",
        url: "https://fixture.test/listings.json",
        sourceName: "Public URL source",
      }],
    });

    expect(fetchMock).toHaveBeenCalledWith("https://fixture.test/listings.json", expect.objectContaining({
      signal: expect.any(AbortSignal),
      headers: expect.objectContaining({
        Accept: expect.stringContaining("application/json"),
      }),
    }));
    expect(result.errors).toEqual([]);
    expect(result.documentsSeen).toBe(1);
    expect(result.listingsFound).toBe(1);
    expect(result.listingsSaved[0]?.sourceUrl).toBe("https://fixture.test/chelsea-1br");
  });

  it("uses OpenAI structured extraction for unstructured source text", async () => {
    const sourceFile = path.join(testWorkspace, "unstructured-source.txt");
    process.env.OPENAI_API_KEY = "test-key";
    fs.writeFileSync(sourceFile, [
      "345 W 30th St #4B",
      "$3,795",
      "Chelsea 1BR near Penn Station. Cats allowed. No fee.",
    ].join("\n"));
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.text.format.type).toBe("json_schema");
      expect(body.input[0].content[0].text).toContain("Do not browse");

      return new Response(JSON.stringify({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({
            listings: [openAiDraft({
              title: "345 W 30th St #4B",
              sourceUrl: "https://streeteasy.com/building/345-west-30-street-new_york/4b",
              address: "345 W 30th St #4B",
              neighborhood: "Chelsea",
              borough: "Manhattan",
              rent: 3795,
              pets: "cats_allowed",
              feeStatus: "no_fee",
            })],
          }) }],
        }],
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runDiscoveryOnce } = await import("../src/discovery/agent-loop.js");
    const result = await runDiscoveryOnce({
      notify: false,
      sources: [{
        id: "openai-text-source",
        type: "file",
        path: sourceFile,
        sourceName: "OpenAI text source",
      }],
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST",
    }));
    expect(result.errors).toEqual([]);
    expect(result.listingsFound).toBe(1);
    expect(result.listingsSaved[0]?.title).toBe("345 W 30th St #4B");
  });

  it("intakes a pasted URL and saves a URL-only lead when plain fetch is unavailable", async () => {
    const url = "https://streeteasy.com/building/345-west-30-street-new_york/4b";
    const fetchMock = vi.fn(async () => new Response("blocked", {
      status: 403,
      statusText: "Forbidden",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { intakeListings } = await import("../src/discovery/intake.js");
    const result = await intakeListings({
      inputs: [{ value: url }],
      notify: false,
      profile: defaultPreferenceProfile,
      now,
    });

    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({
      headers: expect.objectContaining({
        Accept: expect.stringContaining("text/html"),
      }),
    }));
    expect(result.errors).toEqual([]);
    expect(result.warnings[0]).toContain("Saved URL-only lead");
    expect(result.urlOnlyListings).toBe(1);
    expect(result.listingsSaved[0]?.source).toBe("StreetEasy");
    expect(result.listingsSaved[0]?.sourceUrl).toBe(url);
    expect(result.listingsSaved[0]?.title).toContain("#4B");
  });

  it("intakes a file of URLs as separate URL leads", async () => {
    const sourceFile = path.join(testWorkspace, "url-leads.txt");
    fs.writeFileSync(sourceFile, [
      "https://streeteasy.com/building/392-broadway-brooklyn/4",
      "https://streeteasy.com/building/52-ainslie-street-brooklyn/4g",
    ].join("\n"));
    const fetchMock = vi.fn(async () => new Response("blocked", {
      status: 403,
      statusText: "Forbidden",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const { intakeListings } = await import("../src/discovery/intake.js");
    const result = await intakeListings({
      inputs: [{ kind: "file", value: sourceFile }],
      notify: false,
      profile: defaultPreferenceProfile,
      now,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.documentsSeen).toBe(2);
    expect(result.listingsSaved).toHaveLength(2);
    expect(result.urlOnlyListings).toBe(2);
    expect(result.listingsSaved.map((listing) => listing.sourceUrl)).toEqual([
      "https://streeteasy.com/building/392-broadway-brooklyn/4",
      "https://streeteasy.com/building/52-ainslie-street-brooklyn/4g",
    ]);
  });

  it("intakes a file with listing text through OpenAI and saves the ranked listing", async () => {
    const sourceFile = path.join(testWorkspace, "intake-listing.txt");
    process.env.OPENAI_API_KEY = "test-key";
    fs.writeFileSync(sourceFile, [
      "56 Ainslie Street #4G",
      "$3,999",
      "Williamsburg apartment. Cats allowed. Broker fee unknown.",
    ].join("\n"));
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.text.format.type).toBe("json_schema");

      return new Response(JSON.stringify({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({
            listings: [openAiDraft({
              title: "56 Ainslie Street #4G",
              sourceUrl: "https://streeteasy.com/building/52-ainslie-street-brooklyn/4g",
              address: "56 Ainslie Street #4G",
              neighborhood: "Williamsburg",
              borough: "Brooklyn",
              rent: 3999,
              pets: "cats_allowed",
              feeStatus: "unknown",
            })],
          }) }],
        }],
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { intakeListings } = await import("../src/discovery/intake.js");
    const result = await intakeListings({
      inputs: [{ kind: "file", value: sourceFile }],
      notify: false,
      profile: defaultPreferenceProfile,
      now,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST",
    }));
    expect(result.errors).toEqual([]);
    expect(result.listingsSaved).toHaveLength(1);
    expect(result.listingsSaved[0]?.title).toBe("56 Ainslie Street #4G");
    expect(result.listingsSaved[0]?.scoreExplanation).toContain("cats allowed");
  });

  it("reports timed-out source fetches without stopping other sources", async () => {
    const sourceFile = path.join(testWorkspace, "timeout-fallback-source.json");
    fs.writeFileSync(sourceFile, JSON.stringify({
      listings: [{
        title: "56 Ainslie Street #4G",
        address: "56 Ainslie Street #4G",
        neighborhood: "Williamsburg",
        borough: "Brooklyn",
        rent: 3999,
      }],
    }));
    process.env.NYC_APT_RADAR_FETCH_TIMEOUT_MS = "5";
    const fetchMock = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        const error = new Error("aborted");
        error.name = "AbortError";
        reject(error);
      });
    }));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const { runDiscoveryOnce } = await import("../src/discovery/agent-loop.js");
    const pending = runDiscoveryOnce({
      notify: false,
      sources: [
        {
          id: "slow-public-url",
          type: "url",
          url: "https://fixture.test/slow-listings.json",
          sourceName: "Slow URL",
        },
        {
          id: "fallback-file",
          type: "file",
          path: sourceFile,
          sourceName: "Fallback file",
        },
      ],
    });
    await vi.advanceTimersByTimeAsync(5);
    const result = await pending;
    const { listSourceEvents } = await import("../src/storage/discovery.js");
    const events = listSourceEvents();

    expect(result.sourcesChecked).toBe(2);
    expect(result.errors).toContain("slow-public-url: Request timed out after 5 ms.");
    expect(result.documentsSeen).toBe(1);
    expect(result.listingsFound).toBe(1);
    expect(result.listingsSaved[0]?.title).toContain("56 Ainslie");
    expect(events.find((event) => event.sourceId === "slow-public-url")?.status).toBe("failed");
    expect(events.find((event) => event.sourceId === "slow-public-url")?.errorMessage).toContain("timed out");
  });

  it("collects configured sources concurrently so a slow source does not block a fast source from starting", async () => {
    process.env.NYC_APT_RADAR_FETCH_TIMEOUT_MS = "25";
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      if (String(url).includes("slow")) {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }

      return Promise.resolve(new Response(JSON.stringify({
        listings: [{
          id: "fast-public-source-lead",
          title: "Fast Chelsea Lead",
          sourceUrl: "https://fixture.test/fast-listing",
          address: "345 W 30th St #4B",
          neighborhood: "Chelsea",
          borough: "Manhattan",
          rent: 3795,
        }],
      }), { status: 200 }));
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const { runDiscoveryOnce } = await import("../src/discovery/agent-loop.js");
    const pending = runDiscoveryOnce({
      notify: false,
      sources: [
        {
          id: "slow-url-first",
          type: "url",
          url: "https://fixture.test/slow-listings.json",
          sourceName: "Slow URL",
        },
        {
          id: "fast-url-second",
          type: "url",
          url: "https://fixture.test/fast-listings.json",
          sourceName: "Fast URL",
        },
      ],
    });

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(25);
    const result = await pending;

    expect(result.errors).toContain("slow-url-first: Request timed out after 25 ms.");
    expect(result.documentsSeen).toBe(1);
    expect(result.listingsSaved[0]?.id).toBe("fast-public-source-lead");
  });

  it("preserves explicit ids from JSON source events and can reprocess after dedupe reset", async () => {
    const sourceFile = path.join(testWorkspace, "json-source-event.json");
    fs.writeFileSync(sourceFile, JSON.stringify({
      listings: [{
        id: "json-explicit-id",
        source: "StreetEasy",
        sourceUrl: "https://fixture.test/json-explicit-id",
        title: "JSON Chelsea Lead",
        address: "345 W 30th St #4B",
        neighborhood: "Chelsea",
        borough: "Manhattan",
        rent: 3795,
        status: "scheduled",
        appointmentAt: "2026-06-13T11:00:00-04:00",
      }],
    }));

    const { runDiscoveryOnce } = await import("../src/discovery/agent-loop.js");
    const { clearSourceEvents } = await import("../src/storage/discovery.js");
    const { getListing } = await import("../src/storage/listings.js");

    const first = await runDiscoveryOnce({
      notify: false,
      sources: [{
        id: "json-source-event",
        type: "file",
        path: sourceFile,
        sourceName: "JSON source event",
      }],
    });
    const duplicate = await runDiscoveryOnce({
      notify: false,
      sources: [{
        id: "json-source-event",
        type: "file",
        path: sourceFile,
        sourceName: "JSON source event",
      }],
    });
    clearSourceEvents();
    const afterReset = await runDiscoveryOnce({
      notify: false,
      sources: [{
        id: "json-source-event",
        type: "file",
        path: sourceFile,
        sourceName: "JSON source event",
      }],
    });

    expect(first.listingsSaved[0]?.id).toBe("json-explicit-id");
    expect(getListing("json-explicit-id")?.status).toBe("scheduled");
    expect(duplicate.duplicateDocuments).toBe(1);
    expect(afterReset.duplicateDocuments).toBe(0);
    expect(afterReset.listingsFound).toBe(1);
  });

  it("sends ntfy push notifications for hot matches and records the attempt", async () => {
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "radar-secret-topic";
    process.env.NYC_APT_RADAR_NTFY_BASE_URL = "https://ntfy.test";
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { notifyIfInteresting } = await import("../src/notifications/ntfy.js");
    const { listNotifications } = await import("../src/storage/notifications.js");
    const listing = scoreAndExplain(makeListing({
      id: "hot-ntfy-listing",
      title: "Chelsea hot lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      rent: 3700,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      amenities: ["laundry", "dishwasher"],
    }), defaultPreferenceProfile, now);

    const result = await notifyIfInteresting(listing, defaultPreferenceProfile);
    const record = listNotifications().find((notification) => notification.dedupeKey === `hot:${listing.id}:${listing.score}`);

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://ntfy.test/radar-secret-topic", expect.objectContaining({
      method: "POST",
      signal: expect.any(AbortSignal),
      headers: expect.objectContaining({
        Title: expect.stringContaining("Chelsea hot lead"),
      }),
      body: expect.stringContaining("Bryant Park"),
    }));
    expect(record?.channel).toBe("ntfy");
    expect(record?.status).toBe("sent");
  });

  it("builds commute-rich listing ntfy messages for realistic phone smoke tests", async () => {
    const { ntfyMessageForListing } = await import("../src/notifications/ntfy.js");
    const listing = scoreAndExplain(makeListing({
      id: "hot-message-listing",
      title: "Chelsea message lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      rent: 3700,
      pets: "cats_allowed",
      feeStatus: "no_fee",
    }), defaultPreferenceProfile, now);
    const message = ntfyMessageForListing(listing, defaultPreferenceProfile);

    expect(message.title).toContain("Chelsea message lead");
    expect(message.priority).toBe("high");
    expect(message.body).toContain("$3,700");
    expect(message.body).toContain("Bryant Park");
    expect(message.body).toContain("min via");
    expect(message.body).toContain("Mark interested");
  });

  it("retries a failed ntfy notification for the same hot listing score", async () => {
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "retry-topic";
    process.env.NYC_APT_RADAR_NTFY_BASE_URL = "https://ntfy.test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("temporary failure", { status: 503 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { notifyIfInteresting } = await import("../src/notifications/ntfy.js");
    const { listNotifications } = await import("../src/storage/notifications.js");
    const listing = scoreAndExplain(makeListing({
      id: "hot-ntfy-retry-listing",
      title: "Retry Chelsea lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      rent: 3700,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      amenities: ["laundry", "dishwasher"],
    }), defaultPreferenceProfile, now);

    const failed = await notifyIfInteresting(listing, defaultPreferenceProfile);
    const sent = await notifyIfInteresting(listing, defaultPreferenceProfile);
    const record = listNotifications().find((notification) => notification.dedupeKey === `hot:${listing.id}:${listing.score}`);

    expect(failed.sent).toBe(false);
    expect(failed.skipped).toBe(false);
    expect(sent.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(record?.status).toBe("sent");
    expect(record?.errorMessage).toBe(null);
  });

  it("records a failed ntfy notification when the topic is missing", async () => {
    const { notifyIfInteresting } = await import("../src/notifications/ntfy.js");
    const { listNotifications } = await import("../src/storage/notifications.js");
    const listing = scoreAndExplain(makeListing({
      id: "hot-missing-ntfy-listing",
      title: "Missing ntfy lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      rent: 3700,
      pets: "cats_allowed",
      feeStatus: "no_fee",
    }), defaultPreferenceProfile, now);

    delete process.env.NYC_APT_RADAR_NTFY_TOPIC;
    const result = await notifyIfInteresting(listing, defaultPreferenceProfile);
    const record = listNotifications().find((notification) => notification.dedupeKey === `hot:${listing.id}:${listing.score}`);

    expect(result.sent).toBe(false);
    expect(result.skipped).toBe(false);
    expect(result.message).toContain("NYC_APT_RADAR_NTFY_TOPIC");
    expect(record?.channel).toBe("ntfy");
    expect(record?.status).toBe("failed");
    expect(record?.errorMessage).toContain("NYC_APT_RADAR_NTFY_TOPIC");
  });

  it("updates post-showing facts and recalculates score", async () => {
    const { addListing, updateListingFacts } = await import("../src/storage/listings.js");
    const listing = addListing({
      id: "post-showing-update",
      source: "manual",
      title: "Post showing lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      borough: "Manhattan",
      rent: 3795,
      bedrooms: 1,
      bathrooms: 1,
      pets: "unknown",
      feeStatus: "unknown",
      firstSeenAt: "2026-06-12T12:00:00.000Z",
      lastSeenAt: "2026-06-12T12:00:00.000Z",
    }, defaultPreferenceProfile, now);

    const updated = updateListingFacts(listing.id, {
      pets: "no_pets",
      feeStatus: "broker_fee",
      notes: "Broker confirmed no cats and a tenant-paid fee.",
    }, defaultPreferenceProfile, now);

    expect(updated.score).toBeLessThanOrEqual(49);
    expect(updated.scoreExplanation).toContain("cats are not allowed");
    expect(updated.description).toContain("Broker confirmed no cats");
  });
});

describe("operator readiness", () => {
  it("reports sources, preferences, commute targets, database, OpenAI, and ntfy readiness", async () => {
    const sourceDirectory = path.join(testWorkspace, "doctor-source-events");
    const sourcesPath = path.join(testWorkspace, "sources.json");
    const preferencesPath = path.join(testWorkspace, "doctor-preferences.json");
    fs.mkdirSync(sourceDirectory, { recursive: true });
    fs.writeFileSync(path.join(sourceDirectory, "lead.txt"), "345 W 30th St #4B\n$3,795");
    fs.writeFileSync(sourcesPath, JSON.stringify({
      sources: [{
        id: "doctor-local",
        type: "directory",
        path: sourceDirectory,
        sourceName: "Doctor local source",
      }],
    }));
    fs.writeFileSync(preferencesPath, JSON.stringify({
      name: "Doctor profile",
      commuteTargets: [
        {
          label: "Bryant Park",
          address: "Bryant Park, New York, NY",
          latitude: 40.7536,
          longitude: -73.9832,
          maxMinutes: 35,
        },
        {
          label: "Union Square",
          address: "Union Square, New York, NY",
          latitude: 40.7359,
          longitude: -73.9911,
          maxMinutes: 35,
        },
      ],
    }));
    process.env.NYC_APT_RADAR_SOURCES_PATH = sourcesPath;
    process.env.NYC_APT_RADAR_PREFERENCES_PATH = preferencesPath;
    process.env.OPENAI_API_KEY = "doctor-openai-key";
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "doctor-topic";

    const { getRadarReadiness } = await import("../src/diagnostics/readiness.js");
    const report = getRadarReadiness();

    expect(report.ready).toBe(true);
    expect(report.profileName).toBe("Doctor profile");
    expect(report.sourceCount).toBe(1);
    expect(report.commuteTargetCount).toBe(2);
    expect(report.openaiConfigured).toBe(true);
    expect(report.ntfyConfigured).toBe(true);
    expect(report.checks.some((check) => check.name === "commute:Bryant Park")).toBe(true);
    expect(report.checks.find((check) => check.name === "source:doctor-local")?.detail).toContain("1 supported file");
  });

  it("fails readiness when ntfy is not configured", async () => {
    process.env.OPENAI_API_KEY = "doctor-openai-key";
    delete process.env.NYC_APT_RADAR_NTFY_TOPIC;
    const { getRadarReadiness } = await import("../src/diagnostics/readiness.js");
    const report = getRadarReadiness();

    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.name === "ntfy")?.status).toBe("fail");
  });

  it("fails readiness when OpenAI is not configured", async () => {
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "doctor-topic";
    delete process.env.OPENAI_API_KEY;
    const { getRadarReadiness } = await import("../src/diagnostics/readiness.js");
    const report = getRadarReadiness();

    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.name === "openai")?.status).toBe("fail");
  });
});

describe("local environment loading", () => {
  it("parses env files and does not override shell values", async () => {
    const envPath = path.join(testWorkspace, "radar.env");
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "shell-topic";
    delete process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES;
    fs.writeFileSync(envPath, [
      "# local config",
      "NYC_APT_RADAR_NTFY_TOPIC=file-topic",
      "NYC_APT_RADAR_WATCH_INTERVAL_MINUTES=\"7\"",
      "BAD LINE",
    ].join("\n"));

    const { loadLocalEnv, parseEnvFile } = await import("../src/config/env.js");
    const loaded = loadLocalEnv([envPath]);

    expect(loaded).toEqual([envPath]);
    expect(process.env.NYC_APT_RADAR_NTFY_TOPIC).toBe("shell-topic");
    expect(process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES).toBe("7");
    expect(parseEnvFile("A=1\nB='two'\nC=\"three\"")).toEqual([
      ["A", "1"],
      ["B", "two"],
      ["C", "three"],
    ]);
  });

  it("appends missing ntfy config without overwriting existing env values", async () => {
    const { appendMissingEnvValues, generateNtfyTopic } = await import("../src/config/ntfy-setup.js");
    const topic = generateNtfyTopic();

    expect(topic).toMatch(/^nyc-apt-radar-[a-f0-9]{48}$/);
    expect(appendMissingEnvValues("A=1\n", {
      NYC_APT_RADAR_NTFY_TOPIC: "topic",
      NYC_APT_RADAR_NTFY_BASE_URL: "https://ntfy.sh",
    })).toContain("NYC_APT_RADAR_NTFY_TOPIC=topic");
    expect(appendMissingEnvValues("NYC_APT_RADAR_NTFY_TOPIC=existing\n", {
      NYC_APT_RADAR_NTFY_TOPIC: "new",
    })).toBe("NYC_APT_RADAR_NTFY_TOPIC=existing\n");
  });
});

describe("background automation setup", () => {
  it("generates a LaunchAgent that runs one watch cycle on an interval", async () => {
    const { buildLaunchAgentPlist } = await import("../src/automation/launchd.js");
    const plist = buildLaunchAgentPlist({
      cwd: "/tmp/nyc-apt-radar",
      label: "com.test.nyc-apt-radar",
      intervalMinutes: 7,
      logDirectory: "/tmp/nyc-apt-radar/logs",
    });

    expect(plist).toContain("<string>com.test.nyc-apt-radar</string>");
    expect(plist).toContain("<string>/tmp/nyc-apt-radar</string>");
    expect(plist).toContain("<string>watch</string>");
    expect(plist).toContain("<string>--once</string>");
    expect(plist).not.toContain("--allow-local-notifications");
    expect(plist).toContain("<integer>420</integer>");
    expect(plist).toContain("/tmp/nyc-apt-radar/logs/watch.log");
  });
});

describe("OpenAI extraction boundary", () => {
  it("uses Responses API structured output without storage and validates parsed drafts", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const structuredDraft = openAiDraft({
      source: "StreetEasy",
      sourceUrl: "https://fixture.test/listing",
      title: "56 Ainslie Street #4G",
      address: "56 Ainslie Street #4G",
      neighborhood: "Williamsburg",
      borough: "Brooklyn",
      rent: 3999,
      bedrooms: null,
      bathrooms: null,
      availableDate: null,
      description: "Listing text",
      amenities: ["laundry"],
      pets: "unknown",
      feeStatus: "unknown",
      contactName: null,
      appointmentAt: null,
    });
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.store).toBe(false);
      expect(body.max_output_tokens).toBe(2400);
      expect(body.text.format.type).toBe("json_schema");
      expect(body.input[0].content[0].text).toContain("Do not browse");

      return new Response(JSON.stringify({
        output: [{
          type: "message",
          content: [{ type: "output_text", text: JSON.stringify({ listings: [structuredDraft] }) }],
        }],
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { extractListingDraftsWithOpenAI, parseOpenAIListingDrafts } = await import("../src/core/openai-extract.js");
    const [draft] = await extractListingDraftsWithOpenAI("56 Ainslie listing text");

    expect(draft?.title).toBe("56 Ainslie Street #4G");
    expect(draft?.rent).toBe(3999);
    expect(() => parseOpenAIListingDrafts({
      output: [{
        content: [{ type: "output_text", text: JSON.stringify({ listings: [{ ...structuredDraft, rent: "3999" }] }) }],
      }],
    })).toThrow("rent");
    expect(() => parseOpenAIListingDrafts({
      output: [{
        content: [{ type: "refusal", refusal: "I cannot help with that." }],
      }],
    })).toThrow("refused listing extraction");
  });
});

function openAiDraft(overrides: ListingDraft): ListingDraft {
  return {
    id: null,
    source: null,
    sourceUrl: null,
    title: null,
    address: null,
    neighborhood: null,
    borough: null,
    rent: null,
    bedrooms: null,
    bathrooms: null,
    availableDate: null,
    description: null,
    amenities: [],
    pets: "unknown",
    feeStatus: "unknown",
    latitude: null,
    longitude: null,
    status: null,
    firstSeenAt: null,
    lastSeenAt: null,
    contactName: null,
    appointmentAt: null,
    ...overrides,
  };
}

function makeListing(overrides: ListingDraft) {
  return finalizeListing({
    source: "test",
    sourceUrl: "https://fixture.test/listing",
    title: "Test listing",
    address: "123 Test St",
    neighborhood: "Chelsea",
    borough: "Manhattan",
    rent: 3800,
    bedrooms: 1,
    bathrooms: 1,
    availableDate: "2026-07-01",
    description: "",
    amenities: [],
    pets: "cats_allowed",
    feeStatus: "no_fee",
    firstSeenAt: "2026-06-12T12:00:00.000Z",
    lastSeenAt: "2026-06-12T12:00:00.000Z",
    ...overrides,
  }, now);
}
