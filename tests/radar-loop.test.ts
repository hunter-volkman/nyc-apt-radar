import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
const missingPreferencesPath = path.join(testWorkspace, "missing-preferences.json");
const missingSearchesPath = path.join(testWorkspace, "missing-searches.json");

beforeEach(() => {
  process.env.NYC_APT_RADAR_PREFERENCES_PATH = missingPreferencesPath;
  process.env.NYC_APT_RADAR_SEARCHES_PATH = missingSearchesPath;
  process.env.OPENAI_API_KEY = "test-openai-key";
});

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
  delete process.env.NYC_APT_RADAR_SEARCHES_PATH;
  delete process.env.NYC_APT_RADAR_SEARCH_RESULT_LIMIT;
  delete process.env.NYC_APT_RADAR_FETCH_TIMEOUT_MS;
  delete process.env.OPENAI_API_KEY;
});

describe("apartment radar loop", () => {
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
      latitude: 40.7502,
      longitude: -73.9970,
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
      latitude: 40.7502,
      longitude: -73.9970,
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
      latitude: 40.7502,
      longitude: -73.9970,
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
      latitude: 40.7124,
      longitude: -73.9508,
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
  it("saves URL-only leads from StreetEasy search links when JSON-LD is unavailable", async () => {
    const searchUrl = "https://streeteasy.com/for-rent/nyc";
    const listingUrl = "https://streeteasy.com/building/345-west-30-street-new_york/4b";

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === searchUrl) {
        return new Response(`<a href="/building/345-west-30-street-new_york/4b">345 W 30th</a>`, { status: 200 });
      }

      throw new Error(`Unexpected fetch ${String(url)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runDiscoveryOnce } = await import("../src/discovery/discovery-pass.js");
    const result = await runDiscoveryOnce({
      notificationMode: "off",
      searches: [{
        id: "streeteasy-test-search",
        provider: "streeteasy",
        searchUrl,
        sourceName: "StreetEasy",
      }],
    });

    expect(result.searchesChecked).toBe(1);
    expect(result.documentsSeen).toBe(1);
    expect(result.listingsFound).toBe(1);
    expect(result.listingsSaved[0]?.source).toBe("StreetEasy");
    expect(result.listingsSaved[0]?.sourceUrl).toBe(listingUrl);
    expect(result.listingsSaved[0]?.description).toContain("URL-only lead");
    expect(result.errors).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(searchUrl, expect.objectContaining({
      headers: expect.objectContaining({
        Accept: expect.stringContaining("text/html"),
      }),
    }));
    expect(fetchMock).not.toHaveBeenCalledWith(listingUrl, expect.anything());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("extracts StreetEasy JSON-LD search results without model calls", async () => {
    const searchUrl = "https://streeteasy.com/for-rent/nyc/price:-4000";
    const listingUrl = "https://streeteasy.com/building/122-boerum-street-brooklyn/3r";

    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === searchUrl) {
        return new Response([
          `<script type="application/ld+json">`,
          JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Apartment",
                "@id": listingUrl,
                url: listingUrl,
                name: "122 Boerum Street #3R",
                numberOfBedrooms: 1,
                numberOfBathroomsTotal: 1,
                address: {
                  "@type": "PostalAddress",
                  streetAddress: "122 Boerum Street",
                  addressLocality: "Williamsburg",
                  addressRegion: "NY",
                },
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: 40.70557,
                  longitude: -73.944016,
                },
                additionalProperty: [
                  { "@type": "PropertyValue", name: "Monthly Rent", value: "$3,729/mo" },
                ],
              },
            ],
          }),
          `</script>`,
        ].join(""), { status: 200 });
      }

      throw new Error(`Unexpected fetch ${String(url)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runDiscoveryOnce } = await import("../src/discovery/discovery-pass.js");
    const result = await runDiscoveryOnce({
      notificationMode: "off",
      searches: [{
        id: "streeteasy-jsonld-search",
        provider: "streeteasy",
        searchUrl,
        sourceName: "StreetEasy",
      }],
    });

    expect(result.errors).toEqual([]);
    expect(result.listingsFound).toBe(1);
    expect(result.listingsSaved[0]?.title).toBe("122 Boerum Street #3R");
    expect(result.listingsSaved[0]?.rent).toBe(3729);
    expect(result.listingsSaved[0]?.neighborhood).toBe("Williamsburg");
    expect(result.listingsSaved[0]?.sourceUrl).toBe(listingUrl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("extracts only StreetEasy building links from search pages", async () => {
    const { extractListingUrls } = await import("../src/discovery/searches.js");
    const otherSiteListing = "https://example.com/building/345-west-30-street-new_york/4b";
    const streetEasyListing = "https://streeteasy.com/building/345-west-30-street-new_york/4b";

    expect(extractListingUrls("streeteasy", "https://streeteasy.com/for-rent/nyc", [
      `<a href="/building/345-west-30-street-new_york/4b">StreetEasy listing</a>`,
      `<a href="/rental/123456">Disallowed rental path</a>`,
      `<a href="${otherSiteListing}">Wrong site</a>`,
    ].join("\n"))).toEqual([streetEasyListing]);
  });

  it("discovers listings from a StreetEasy search and sends hot-match ntfy notifications", async () => {
    const searchUrl = "https://streeteasy.com/for-rent/nyc/price:-4000";
    const listingUrl = "https://streeteasy.com/building/345-west-30-street-new_york/4b";
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "discovery-topic";
    process.env.NYC_APT_RADAR_NTFY_BASE_URL = "https://ntfy.test";
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      if (String(url) === searchUrl) {
        return new Response([
          `<a href="${listingUrl}">345 W 30th</a>`,
          `<script type="application/ld+json">`,
          JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [{
              "@type": "Apartment",
              "@id": listingUrl,
              url: listingUrl,
              name: "345 W 30th St #4B",
              numberOfBedrooms: 1,
              numberOfBathroomsTotal: 1,
              address: {
                "@type": "PostalAddress",
                addressLocality: "Chelsea",
              },
              geo: {
                "@type": "GeoCoordinates",
                latitude: 40.7502,
                longitude: -73.9970,
              },
              additionalProperty: [
                { "@type": "PropertyValue", name: "Monthly Rent", value: "$3,795/mo" },
              ],
            }],
          }),
          `</script>`,
        ].join(""), { status: 200 });
      }

      return new Response("ok", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { runDiscoveryOnce } = await import("../src/discovery/discovery-pass.js");
    const { listRankedListings } = await import("../src/storage/listings.js");
    const { listNotifications } = await import("../src/storage/notifications.js");

    const result = await runDiscoveryOnce({
      searches: [{
        id: "test-search",
        provider: "streeteasy",
        searchUrl,
        sourceName: "StreetEasy",
      }],
    });
    const listings = listRankedListings();
    const notifications = listNotifications();

    expect(result.documentsSeen).toBe(1);
    expect(result.listingsFound).toBe(1);
    expect(listings[0]?.title).toContain("345 W 30th St");
    expect(listings[0]?.score).toBeGreaterThanOrEqual(defaultPreferenceProfile.hotScore);
    expect(result.notificationsSent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
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
      sourceType: "url",
      sourceRef: "https://fixture.test/good-feed",
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

  it("records timed-out StreetEasy search fetches", async () => {
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

    const { runDiscoveryOnce } = await import("../src/discovery/discovery-pass.js");
    const pending = runDiscoveryOnce({
      notify: false,
      searches: [{
        id: "slow-streeteasy",
        provider: "streeteasy",
        searchUrl: "https://streeteasy.com/for-rent/nyc",
        sourceName: "StreetEasy",
      }],
    });
    await vi.advanceTimersByTimeAsync(5);
    const result = await pending;
    const { listSourceEvents } = await import("../src/storage/discovery.js");
    const events = listSourceEvents();

    expect(result.searchesChecked).toBe(1);
    expect(result.errors).toContain("slow-streeteasy: Request timed out after 5 ms.");
    expect(result.documentsSeen).toBe(0);
    expect(result.listingsFound).toBe(0);
    expect(events.find((event) => event.sourceId === "slow-streeteasy")?.status).toBe("failed");
    expect(events.find((event) => event.sourceId === "slow-streeteasy")?.errorMessage).toContain("timed out");
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
      latitude: 40.7502,
      longitude: -73.9970,
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
      latitude: 40.7502,
      longitude: -73.9970,
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
      latitude: 40.7502,
      longitude: -73.9970,
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
      latitude: 40.7502,
      longitude: -73.9970,
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

  it("records notification decisions without sending during no-notify smoke runs", async () => {
    const searchUrl = "https://streeteasy.com/for-rent/nyc/price:-4000";
    const listingUrl = "https://streeteasy.com/building/345-west-30-street-new_york/4b";
    const fetchMock = vi.fn(async () => new Response([
      `<a href="${listingUrl}">345 W 30th</a>`,
      `<script type="application/ld+json">`,
      JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [{
          "@type": "Apartment",
          "@id": listingUrl,
          url: listingUrl,
          name: "345 W 30th St #4B",
          numberOfBedrooms: 1,
          numberOfBathroomsTotal: 1,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Chelsea",
          },
          geo: {
            "@type": "GeoCoordinates",
            latitude: 40.7502,
            longitude: -73.9970,
          },
          additionalProperty: [
            { "@type": "PropertyValue", name: "Monthly Rent", value: "$3,700/mo" },
          ],
        }],
      }),
      `</script>`,
    ].join(""), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { runDiscoveryOnce } = await import("../src/discovery/discovery-pass.js");
    const { listNotifications } = await import("../src/storage/notifications.js");
    const result = await runDiscoveryOnce({
      notificationMode: "dry-run",
      searches: [{
        id: "dry-run-search",
        provider: "streeteasy",
        searchUrl,
        sourceName: "StreetEasy",
      }],
    });
    const notifications = listNotifications();

    expect(result.documentsSeen).toBe(1);
    expect(result.notificationsSkipped).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(notifications.some((notification) => notification.status === "skipped")).toBe(true);
  });

  it("updates post-showing facts and recalculates score", async () => {
    const { addListing, updateListingFacts } = await import("../src/storage/listings.js");
    const listing = addListing({
      id: "post-showing-update",
      source: "StreetEasy",
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
  it("reports StreetEasy searches, preferences, commute targets, database, and ntfy readiness", async () => {
    const searchesPath = path.join(testWorkspace, "doctor-searches.json");
    const preferencesPath = path.join(testWorkspace, "doctor-preferences.json");
    fs.writeFileSync(searchesPath, JSON.stringify({
      searches: [{
        id: "doctor-streeteasy",
        provider: "streeteasy",
        searchUrl: "https://streeteasy.com/for-rent/nyc",
        sourceName: "StreetEasy",
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
    process.env.NYC_APT_RADAR_SEARCHES_PATH = searchesPath;
    process.env.NYC_APT_RADAR_PREFERENCES_PATH = preferencesPath;
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "doctor-topic";

    const { getRadarReadiness } = await import("../src/diagnostics/readiness.js");
    const report = getRadarReadiness();

    expect(report.ready).toBe(true);
    expect(report.profileName).toBe("Doctor profile");
    expect(report.searchCount).toBe(1);
    expect(report.commuteTargetCount).toBe(2);
    expect(report.ntfyConfigured).toBe(true);
    expect(report.checks.some((check) => check.name === "commute:Bryant Park")).toBe(true);
    expect(report.checks.find((check) => check.name === "search:doctor-streeteasy")?.detail).toContain("streeteasy");
  });

  it("fails readiness when no active StreetEasy search is configured", async () => {
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "doctor-topic";
    const { getRadarReadiness } = await import("../src/diagnostics/readiness.js");
    const report = getRadarReadiness();

    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.name === "searches")?.status).toBe("fail");
  });

  it("fails readiness when ntfy is not configured", async () => {
    const searchesPath = path.join(testWorkspace, "doctor-searches.json");
    fs.writeFileSync(searchesPath, JSON.stringify({
      searches: [{
        id: "doctor-streeteasy",
        provider: "streeteasy",
        searchUrl: "https://streeteasy.com/for-rent/nyc",
        sourceName: "StreetEasy",
      }],
    }));
    process.env.NYC_APT_RADAR_SEARCHES_PATH = searchesPath;
    delete process.env.NYC_APT_RADAR_NTFY_TOPIC;
    const { getRadarReadiness } = await import("../src/diagnostics/readiness.js");
    const report = getRadarReadiness();

    expect(report.ready).toBe(false);
    expect(report.checks.find((check) => check.name === "ntfy")?.status).toBe("fail");
  });
});

describe("local environment loading", () => {
  it("parses env files and does not override shell values", async () => {
    const envPath = path.join(testWorkspace, "radar.env");
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "shell-topic";
    fs.writeFileSync(envPath, [
      "# local config",
      "NYC_APT_RADAR_NTFY_TOPIC=file-topic",
      "NYC_APT_RADAR_SEARCH_RESULT_LIMIT=\"7\"",
      "BAD LINE",
    ].join("\n"));

    const { loadLocalEnv, parseEnvFile } = await import("../src/config/env.js");
    const loaded = loadLocalEnv([envPath]);

    expect(loaded).toEqual([envPath]);
    expect(process.env.NYC_APT_RADAR_NTFY_TOPIC).toBe("shell-topic");
    expect(process.env.NYC_APT_RADAR_SEARCH_RESULT_LIMIT).toBe("7");
    expect(parseEnvFile("A=1\nB='two'\nC=\"three\"")).toEqual([
      ["A", "1"],
      ["B", "two"],
      ["C", "three"],
    ]);
  });

});

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
