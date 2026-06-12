import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

type DatabaseSetupModule = typeof import("../scripts/init-db");
type RadarModule = typeof import("../src/lib/radar");

let tempDir: string;
let buildOutreachMessage: RadarModule["buildOutreachMessage"];
let getRadarDashboard: RadarModule["getRadarDashboard"];
let getRadarWatchIntervalMinutes: RadarModule["getRadarWatchIntervalMinutes"];
let importSourceEvent: RadarModule["importSourceEvent"];
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
  tempDir = mkdtempSync(path.join(tmpdir(), "stoop-radar-"));
  process.env.STOOP_DATABASE_PATH = path.join(tempDir, "stoop.sqlite");
  delete process.env.OPENAI_API_KEY;

  ({ runDatabaseSetup } = await import("../scripts/init-db"));
  ({
    buildOutreachMessage,
    getRadarDashboard,
    getRadarWatchIntervalMinutes,
    importSourceEvent,
    listNotifications,
    listSourceEvents,
    runRadarOnce,
  } = await import("../src/lib/radar"));
});

beforeEach(() => {
  runDatabaseSetup({ reset: true });
  delete process.env.STOOP_WATCH_INTERVAL_MINUTES;
});

afterAll(() => {
  rmSync(tempDir, { force: true, recursive: true });
  delete process.env.STOOP_DATABASE_PATH;
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
    expect(listNotifications().map((notification) => notification.type)).toContain("hot_listing");
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
});

describe("radar configuration and messages", () => {
  it("uses a 10 minute watch interval by default and honors the environment override", () => {
    expect(getRadarWatchIntervalMinutes()).toBe(10);

    process.env.STOOP_WATCH_INTERVAL_MINUTES = "3";

    expect(getRadarWatchIntervalMinutes()).toBe(3);
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
    expect(buildOutreachMessage(listing!, ["Fee language needs confirmation."])).toContain(
      "whether there is any tenant-paid broker fee",
    );
  });
});
