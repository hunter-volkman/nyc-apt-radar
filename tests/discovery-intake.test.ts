import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultPreferenceProfile } from "../src/core/preferences";

const now = new Date("2026-06-12T18:00:00.000Z");
const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-discovery-test-"));
process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "discovery-intake.sqlite");
process.env.NYC_APT_RADAR_PREFERENCES_PATH = path.join(testWorkspace, "missing-preferences.json");
process.env.NYC_APT_RADAR_SEARCHES_PATH = path.join(testWorkspace, "missing-searches.json");

afterEach(async () => {
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
});

describe("discovery intake", () => {
  it("counts duplicate manual intake documents without upserting or notifying again", async () => {
    const sourceFile = path.join(testWorkspace, "manual-structured-listing.json");
    fs.writeFileSync(sourceFile, JSON.stringify({
      listings: [{
        id: "duplicate-manual-intake",
        source: "StreetEasy",
        sourceUrl: "https://fixture.test/duplicate-manual-intake",
        title: "Duplicate Chelsea Lead",
        address: "345 W 30th St #4B",
        neighborhood: "Chelsea",
        borough: "Manhattan",
        rent: 3700,
        bedrooms: 1,
        bathrooms: 1,
        amenities: ["dishwasher", "laundry"],
        pets: "cats_allowed",
        feeStatus: "no_fee",
        latitude: 40.7502,
        longitude: -73.997,
      }],
    }));
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "duplicate-topic";
    process.env.NYC_APT_RADAR_NTFY_BASE_URL = "https://ntfy.test";
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { intakeListings } = await import("../src/discovery/intake.js");
    const { listNotifications } = await import("../src/storage/notifications.js");
    const input = {
      inputs: [{ kind: "file" as const, value: sourceFile }],
      notify: true,
      profile: defaultPreferenceProfile,
      now,
    };

    const first = await intakeListings(input);
    const notificationsAfterFirst = listNotifications();
    const duplicate = await intakeListings(input);
    const notificationsAfterDuplicate = listNotifications();

    expect(first.listingsSaved).toHaveLength(1);
    expect(first.notificationsSent).toBe(1);
    expect(duplicate.duplicateDocuments).toBe(1);
    expect(duplicate.listingsFound).toBe(0);
    expect(duplicate.listingsSaved).toEqual([]);
    expect(duplicate.notificationsSent).toBe(0);
    expect(duplicate.notificationsFailed).toBe(0);
    expect(notificationsAfterDuplicate).toHaveLength(notificationsAfterFirst.length);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("adds URL-only drafts for discovered search URLs missing from JSON-LD drafts", async () => {
    const searchUrl = "https://streeteasy.com/for-rent/nyc/price:-4000";
    const structuredUrl = "https://streeteasy.com/building/345-west-30-street-new_york/4b";
    const urlOnlyGap = "https://streeteasy.com/building/52-ainslie-street-brooklyn/4g";
    const fetchMock = vi.fn(async () => new Response([
      `<a href="${structuredUrl}">Structured lead</a>`,
      `<a href="${urlOnlyGap}">URL-only gap</a>`,
      `<script type="application/ld+json">`,
      JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [{
          "@type": "Apartment",
          "@id": structuredUrl,
          url: structuredUrl,
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
            longitude: -73.997,
          },
          additionalProperty: [
            { "@type": "PropertyValue", name: "Monthly Rent", value: "$3,700/mo" },
          ],
        }],
      }),
      `</script>`,
    ].join(""), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const { runDiscoveryOnce } = await import("../src/discovery/agent-loop.js");
    const result = await runDiscoveryOnce({
      notificationMode: "off",
      searches: [{
        id: "partial-jsonld-search",
        provider: "streeteasy",
        searchUrl,
        sourceName: "StreetEasy",
      }],
    });

    expect(result.errors).toEqual([]);
    expect(result.documentsSeen).toBe(1);
    expect(result.listingsFound).toBe(2);
    expect(result.listingsSaved.map((listing) => listing.sourceUrl).sort()).toEqual([
      structuredUrl,
      urlOnlyGap,
    ].sort());
    expect(result.listingsSaved.find((listing) => listing.sourceUrl === structuredUrl)?.title).toBe("345 W 30th St #4B");
    expect(result.listingsSaved.find((listing) => listing.sourceUrl === urlOnlyGap)?.description).toContain("URL-only lead");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes search documents from the discovered URLs block instead of surrounding HTML", async () => {
    const { createSourceEvent, listSourceEvents } = await import("../src/storage/discovery.js");
    const sourceRef = "https://streeteasy.com/for-rent/nyc";
    const rawText = (html: string) => [
      "SOURCE: StreetEasy",
      `SEARCH_URL: ${sourceRef}`,
      "EXTRACTOR_VERSION: structured-jsonld-v1",
      "DISCOVERED_URLS:",
      "- https://streeteasy.com/building/345-west-30-street-new_york/4b",
      "- https://streeteasy.com/building/52-ainslie-street-brooklyn/4g",
      "",
      html,
    ].join("\n");

    const first = createSourceEvent({
      sourceId: "stable-search:search",
      sourceType: "url",
      sourceRef,
      rawText: rawText("<html>old ad slot</html>"),
      discoveredAt: "2026-06-12T12:00:00.000Z",
    });
    const second = createSourceEvent({
      sourceId: "stable-search:search",
      sourceType: "url",
      sourceRef,
      rawText: rawText("<html>new ad slot and tracking noise</html>"),
      discoveredAt: "2026-06-12T12:05:00.000Z",
    });

    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(second.event.status).toBe("duplicate");
    expect(listSourceEvents()).toHaveLength(1);
  });
});
