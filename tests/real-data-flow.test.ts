import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

type DatabaseSetupModule = typeof import("../scripts/init-db");
type ListingRepositoryModule = typeof import("../src/lib/listing-repository");
type ListingViewModelsModule = typeof import("../src/lib/listing-view-models");

let tempDir: string;
let createListing: ListingRepositoryModule["createListing"];
let getAllListingBundles: ListingViewModelsModule["getAllListingBundles"];
let getBoardColumns: ListingViewModelsModule["getBoardColumns"];
let getListingBundle: ListingViewModelsModule["getListingBundle"];
let getNeedsFollowUp: ListingViewModelsModule["getNeedsFollowUp"];
let getNeedsOutreach: ListingViewModelsModule["getNeedsOutreach"];
let getRecentlyKilled: ListingViewModelsModule["getRecentlyKilled"];
let getTopCandidates: ListingViewModelsModule["getTopCandidates"];
let getTourStatusBundles: ListingViewModelsModule["getTourStatusBundles"];
let listListings: ListingRepositoryModule["listListings"];
let runDatabaseSetup: DatabaseSetupModule["runDatabaseSetup"];

beforeAll(async () => {
  tempDir = mkdtempSync(path.join(tmpdir(), "stoop-real-data-"));
  process.env.STOOP_DATABASE_PATH = path.join(tempDir, "stoop.sqlite");

  ({ runDatabaseSetup } = await import("../scripts/init-db"));
  ({ createListing, listListings } = await import("../src/lib/listing-repository"));
  ({
    getAllListingBundles,
    getBoardColumns,
    getListingBundle,
    getNeedsFollowUp,
    getNeedsOutreach,
    getRecentlyKilled,
    getTopCandidates,
    getTourStatusBundles,
  } = await import("../src/lib/listing-view-models"));
});

beforeEach(() => {
  runDatabaseSetup({ reset: true });
});

afterAll(() => {
  rmSync(tempDir, { force: true, recursive: true });
  delete process.env.STOOP_DATABASE_PATH;
});

describe("real-data database setup", () => {
  it("initializes an empty database without seed records", () => {
    const result = runDatabaseSetup();

    expect(result.listingCount).toBe(0);
    expect(listListings()).toEqual([]);
  });

  it("preserves local listings on init and only clears them on reset", () => {
    createListing({ id: "unit-test-listing", title: "Unit test listing" });

    expect(runDatabaseSetup().listingCount).toBe(1);
    expect(runDatabaseSetup({ reset: true }).listingCount).toBe(0);
    expect(listListings()).toEqual([]);
  });
});

describe("real-data listing view models", () => {
  it("returns empty collections without fallback listings", () => {
    expect(getAllListingBundles()).toEqual([]);
    expect(getTopCandidates()).toEqual([]);
    expect(getNeedsOutreach()).toEqual([]);
    expect(getNeedsFollowUp()).toEqual([]);
    expect(getRecentlyKilled()).toEqual([]);
    expect(getTourStatusBundles()).toEqual([]);
    expect(getBoardColumns().every((column) => column.listings.length === 0)).toBe(true);
  });

  it("derives ListingView fields from a persisted listing", () => {
    createListing({
      id: "view-model-test",
      title: "View model test listing",
      status: "new",
    });

    const bundle = getListingBundle("view-model-test");

    expect(bundle?.listing.id).toBe("view-model-test");
    expect(bundle?.listing.title).toBe("View model test listing");
    expect(bundle?.listing.nextAction).toBe("Resolve hard filters or kill this listing.");
    expect(bundle?.listing.mainRisk).toBe("Address is missing after parse.");
    expect(bundle?.listing.moveInFit).toBe("Move-in unknown");
    expect(bundle?.listing.updatedAtLabel).toBeTruthy();
    expect(bundle?.evaluation.eligible).toBe(false);
  });
});
