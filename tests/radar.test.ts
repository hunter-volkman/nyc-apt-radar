import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type DatabaseSetupModule = typeof import("../scripts/init-db");
type RadarModule = typeof import("../src/lib/radar");
type RadarSourceFilesModule = typeof import("../src/lib/radar-source-files");

let tempDir: string;
let buildOutreachMessage: RadarModule["buildOutreachMessage"];
let detectSourceName: RadarModule["detectSourceName"];
let getRadarDashboard: RadarModule["getRadarDashboard"];
let getPushNotificationStatus: RadarModule["getPushNotificationStatus"];
let getRadarWatchIntervalMinutes: RadarModule["getRadarWatchIntervalMinutes"];
let importSourceEvent: RadarModule["importSourceEvent"];
let importSourceEventsFromDirectory: RadarSourceFilesModule["importSourceEventsFromDirectory"];
let listNotifications: RadarModule["listNotifications"];
let listSourceEvents: RadarModule["listSourceEvents"];
let runDatabaseSetup: DatabaseSetupModule["runDatabaseSetup"];
let runRadarOnce: RadarModule["runRadarOnce"];

const hotAlertText = `
Fort Greene 1BR near Lafayette Avenue

238 Adelphi Street, Brooklyn, NY
Apt 2R

$3,650 per month. Available June 20. 1 bed, 1 bath, 690 sq ft.
Dishwasher, laundry in building, bright light, bike storage, near subway.
No fee. Contact Leasing Desk at leasing@example.com or (917) 555-0194.
https://alerts.example/listings/strong-fit
`;

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "nyc-apt-radar-"));
  process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(tempDir, "nyc-apt-radar.sqlite");
  delete process.env.OPENAI_API_KEY;

  ({ runDatabaseSetup } = await import("../scripts/init-db"));
  ({
    buildOutreachMessage,
    detectSourceName,
    getRadarDashboard,
    getPushNotificationStatus,
    getRadarWatchIntervalMinutes,
    importSourceEvent,
    importSourceEventsFromDirectory,
    listNotifications,
    listSourceEvents,
    runRadarOnce,
  } = await import("../src/lib/radar"));
  ({ importSourceEventsFromDirectory } = await import("../src/lib/radar-source-files"));
});

beforeEach(() => {
  runDatabaseSetup({ reset: true });
  vi.unstubAllGlobals();
  delete process.env.NYC_APT_RADAR_NOTIFY_CHANNEL;
  delete process.env.NYC_APT_RADAR_NTFY_BASE_URL;
  delete process.env.NYC_APT_RADAR_NTFY_TOPIC;
  delete process.env.NYC_APT_RADAR_SOURCE_DIR;
  delete process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES;
  delete process.env.APARTMENT_RADAR_NOTIFY_CHANNEL;
  delete process.env.APARTMENT_RADAR_NTFY_BASE_URL;
  delete process.env.APARTMENT_RADAR_NTFY_TOPIC;
  delete process.env.APARTMENT_RADAR_SOURCE_DIR;
  delete process.env.APARTMENT_RADAR_WATCH_INTERVAL_MINUTES;
  delete process.env.STOOP_NOTIFY_CHANNEL;
  delete process.env.STOOP_NTFY_BASE_URL;
  delete process.env.STOOP_NTFY_TOPIC;
  delete process.env.STOOP_SOURCE_DIR;
  delete process.env.STOOP_WATCH_INTERVAL_MINUTES;
});

afterAll(() => {
  vi.unstubAllGlobals();
  rmSync(tempDir, { force: true, recursive: true });
  delete process.env.NYC_APT_RADAR_DATABASE_PATH;
  delete process.env.STOOP_WATCH_INTERVAL_MINUTES;
});

describe("radar source-event import", () => {
  it("records duplicates by normalized source URL and normalized fingerprint", () => {
    const first = importSourceEvent({
      sourceName: "Alert source",
      sourceUrl: "https://alerts.example/listings/123?utm_source=email#details",
      rawText: hotAlertText,
      importedAt: "2026-06-12T11:55:00.000Z",
    });
    const duplicateUrl = importSourceEvent({
      sourceName: "Alert source",
      sourceUrl: "https://alerts.example/listings/123?utm_source=push",
      rawText: "Updated alert body with the same source URL.",
      importedAt: "2026-06-12T11:56:00.000Z",
    });
    const duplicateFingerprint = importSourceEvent({
      sourceName: "Second alert source",
      rawText: hotAlertText,
      importedAt: "2026-06-12T11:57:00.000Z",
    });

    expect(first.wasDuplicate).toBe(false);
    expect(duplicateUrl.wasDuplicate).toBe(true);
    expect(duplicateUrl.duplicateOf?.id).toBe(first.event.id);
    expect(duplicateFingerprint.wasDuplicate).toBe(true);
    expect(duplicateFingerprint.duplicateOf?.id).toBe(first.event.id);
    expect(listSourceEvents()).toHaveLength(3);
  });

  it("imports source message files exactly once", () => {
    const sourceDir = path.join(tempDir, "source-events");
    const sourceFile = path.join(sourceDir, "streeteasy-alert.txt");

    mkdirSync(sourceDir, { recursive: true });
    writeFileSync(sourceFile, hotAlertText);

    const firstImport = importSourceEventsFromDirectory(sourceDir);
    const secondImport = importSourceEventsFromDirectory(sourceDir);
    const events = listSourceEvents();

    expect(firstImport.filesSeen).toBe(1);
    expect(firstImport.eventsImported).toBe(1);
    expect(firstImport.duplicatesSkipped).toBe(0);
    expect(secondImport.filesSeen).toBe(1);
    expect(secondImport.eventsImported).toBe(0);
    expect(secondImport.duplicatesSkipped).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0].sourceFilePath).toBe(sourceFile);
  });

  it("detects main apartment sources from URLs and text", () => {
    expect(detectSourceName({ sourceUrl: "https://streeteasy.com/building/example/1" })).toBe("StreetEasy");
    expect(detectSourceName({ sourceUrl: "https://www.zillow.com/homedetails/example" })).toBe("Zillow");
    expect(detectSourceName({ sourceUrl: "https://newyork.craigslist.org/brk/apa/example.html" })).toBe("Craigslist");
    expect(detectSourceName({ rawText: "New Nooklyn listing in Bed-Stuy" })).toBe("Nooklyn");
  });
});

describe("radar run", () => {
  it("processes a pending source event into a hot listing and local notification", async () => {
    importSourceEvent({
      sourceName: "Alert source",
      sourceUrl: "https://alerts.example/listings/strong-fit",
      rawText: hotAlertText,
      importedAt: "2026-06-12T11:55:00.000Z",
    });

    const run = await runRadarOnce({
      now: new Date("2026-06-12T12:00:00.000Z"),
      runType: "one_shot",
    });
    const dashboard = getRadarDashboard();
    const hotRow = dashboard.rowsByClassification.hot[0];

    expect(run.status).toBe("succeeded");
    expect(run.eventsSeen).toBe(1);
    expect(run.eventsProcessed).toBe(1);
    expect(run.listingsCreated).toBe(1);
    expect(hotRow.bundle?.listing.address).toBe("238 Adelphi Street, Brooklyn, NY");
    expect(hotRow.bundle?.evaluation.eligible).toBe(true);
    expect(hotRow.blockers).toEqual([]);
    expect(listNotifications()[0]).toMatchObject({
      channel: "local",
      errorMessage: null,
      status: "recorded",
      type: "hot_listing",
    });
  });

  it("classifies unresolved address or fee facts as needs review", async () => {
    importSourceEvent({
      sourceName: "Alert source",
      rawText:
        "Crown Heights 1BR, $3,200. Tenant-paid broker fee unclear. Total move-in cash TBD. Available now.",
      importedAt: "2026-06-12T11:55:00.000Z",
    });

    await runRadarOnce({
      now: new Date("2026-06-12T12:00:00.000Z"),
      runType: "one_shot",
    });

    const dashboard = getRadarDashboard();
    const reviewRow = dashboard.rowsByClassification.needs_review[0];

    expect(reviewRow.blockers).toEqual(
      expect.arrayContaining(["Address is missing after parse.", "Fee language needs confirmation."]),
    );
    expect(listNotifications().map((notification) => notification.type)).toContain("needs_review");
  });

  it("sends ntfy push for hot listings when configured", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);
    process.env.NYC_APT_RADAR_NOTIFY_CHANNEL = "ntfy";
    process.env.NYC_APT_RADAR_NTFY_TOPIC = "secret-topic";

    importSourceEvent({
      sourceName: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/238-adelphi/2r",
      rawText: hotAlertText,
      importedAt: "2026-06-12T11:55:00.000Z",
    });

    await runRadarOnce({
      now: new Date("2026-06-12T12:00:00.000Z"),
      runType: "one_shot",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ntfy.sh/secret-topic",
      expect.objectContaining({
        body: expect.stringContaining("Source: StreetEasy"),
        method: "POST",
      }),
    );
    expect(listNotifications()[0]).toMatchObject({
      channel: "ntfy",
      errorMessage: null,
      status: "sent",
      type: "hot_listing",
    });
    expect(getPushNotificationStatus()).toEqual({
      channel: "ntfy",
      configured: true,
      label: "ntfy push configured",
    });
  });
});

describe("radar configuration and messages", () => {
  it("uses a 10 minute watch interval, honors old aliases, and prefers new env names", () => {
    expect(getRadarWatchIntervalMinutes()).toBe(10);

    process.env.STOOP_WATCH_INTERVAL_MINUTES = "3";

    expect(getRadarWatchIntervalMinutes()).toBe(3);

    process.env.APARTMENT_RADAR_WATCH_INTERVAL_MINUTES = "6";

    expect(getRadarWatchIntervalMinutes()).toBe(6);

    process.env.NYC_APT_RADAR_WATCH_INTERVAL_MINUTES = "8";

    expect(getRadarWatchIntervalMinutes()).toBe(8);
  });

  it("builds default and clarification copy without personal names", async () => {
    importSourceEvent({
      sourceName: "Alert source",
      sourceUrl: "https://alerts.example/listings/strong-fit",
      rawText: hotAlertText,
      importedAt: "2026-06-12T11:55:00.000Z",
    });

    await runRadarOnce({
      now: new Date("2026-06-12T12:00:00.000Z"),
      runType: "one_shot",
    });

    const listing = getRadarDashboard().rowsByClassification.hot[0].bundle?.listing;

    expect(listing).toBeDefined();
    expect(buildOutreachMessage(listing!, [])).toContain("quick video walkthrough");
    expect(buildOutreachMessage(listing!, [])).not.toMatch(/Hunter|girlfriend/i);
    expect(buildOutreachMessage(listing!, ["Fee language needs confirmation."])).toContain(
      "whether there is any tenant-paid broker fee",
    );
    expect(buildOutreachMessage(listing!, ["Fee language needs confirmation."])).not.toMatch(/Hunter|girlfriend/i);
  });
});
