import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultPreferenceProfile } from "../src/core/preferences";

const now = new Date("2026-06-12T18:00:00.000Z");
const later = new Date("2026-06-13T18:00:00.000Z");
const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-storage-test-"));
process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "storage-listings.sqlite");

afterEach(async () => {
  const { clearListings } = await import("../src/storage/listings.js");
  clearListings();
});

describe("listing storage", () => {
  it("merges source refreshes without wiping operator-controlled fields or known facts", async () => {
    const { getListing, upsertListing } = await import("../src/storage/listings.js");

    upsertListing({
      id: "merge-lead",
      source: "operator",
      sourceUrl: "https://fixture.test/merge-lead",
      title: "Original Chelsea Lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      rent: 3795,
      bedrooms: 1,
      bathrooms: 1,
      description: "Operator note: broker confirmed the showing window.",
      amenities: ["laundry"],
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.7502,
      longitude: -73.997,
      status: "scheduled",
      firstSeenAt: "2026-06-01T12:00:00.000Z",
      lastSeenAt: "2026-06-01T12:00:00.000Z",
      contactName: "Maya",
      appointmentAt: "2026-06-15T20:00:00.000Z",
    }, defaultPreferenceProfile, now);

    const merged = upsertListing({
      id: "merge-lead",
      source: "StreetEasy",
      sourceUrl: "",
      title: "",
      address: "",
      neighborhood: null,
      borough: "Manhattan",
      rent: null,
      bedrooms: null,
      bathrooms: null,
      availableDate: "2026-07-01",
      description: "Fresh source says dishwasher and in-building laundry.",
      amenities: ["dishwasher"],
      pets: "unknown",
      feeStatus: "unknown",
      latitude: 41,
      longitude: -74,
      status: "new",
      contactName: null,
      appointmentAt: null,
    }, defaultPreferenceProfile, later);
    const stored = getListing("merge-lead");

    expect(merged.status).toBe("scheduled");
    expect(merged.firstSeenAt).toBe("2026-06-01T12:00:00.000Z");
    expect(merged.lastSeenAt).toBe(later.toISOString());
    expect(merged.contactName).toBe("Maya");
    expect(merged.appointmentAt).toBe("2026-06-15T20:00:00.000Z");
    expect(merged.sourceUrl).toBe("https://fixture.test/merge-lead");
    expect(merged.title).toBe("Original Chelsea Lead");
    expect(merged.address).toBe("345 W 30th St #4B");
    expect(merged.neighborhood).toBe("Chelsea");
    expect(merged.rent).toBe(3795);
    expect(merged.bedrooms).toBe(1);
    expect(merged.bathrooms).toBe(1);
    expect(merged.borough).toBe("Manhattan");
    expect(merged.availableDate).toBe("2026-07-01");
    expect(merged.pets).toBe("cats_allowed");
    expect(merged.feeStatus).toBe("no_fee");
    expect(merged.latitude).toBe(40.7502);
    expect(merged.longitude).toBe(-73.997);
    expect(merged.amenities).toEqual(["laundry", "dishwasher"]);
    expect(merged.description).toContain("Operator note");
    expect(merged.description).toContain("Fresh source says dishwasher");
    expect(stored).toMatchObject({
      status: "scheduled",
      firstSeenAt: "2026-06-01T12:00:00.000Z",
      contactName: "Maya",
      appointmentAt: "2026-06-15T20:00:00.000Z",
    });
  });

  it("fills missing policy and coordinate facts from richer source refreshes", async () => {
    const { upsertListing } = await import("../src/storage/listings.js");

    upsertListing({
      id: "missing-facts",
      source: "StreetEasy",
      title: "Mystery lead",
      pets: "unknown",
      feeStatus: "unknown",
    }, defaultPreferenceProfile, now);

    const filled = upsertListing({
      id: "missing-facts",
      source: "StreetEasy",
      title: "Mystery lead",
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.7124,
      longitude: -73.9508,
    }, defaultPreferenceProfile, later);

    expect(filled.pets).toBe("cats_allowed");
    expect(filled.feeStatus).toBe("no_fee");
    expect(filled.latitude).toBe(40.7124);
    expect(filled.longitude).toBe(-73.9508);
  });

  it("returns rescored ranked listings without saving those scores", async () => {
    const { addListing, getListing, listRankedListings } = await import("../src/storage/listings.js");
    const saved = addListing({
      id: "read-only-ranking",
      source: "StreetEasy",
      title: "Chelsea read-only lead",
      neighborhood: "Chelsea",
      rent: 3700,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.7502,
      longitude: -73.997,
      firstSeenAt: "2026-06-12T12:00:00.000Z",
      lastSeenAt: "2026-06-12T12:00:00.000Z",
    }, defaultPreferenceProfile, now);

    const strictProfile = {
      ...defaultPreferenceProfile,
      budget: {
        targetRent: 1000,
        maxRent: 1200,
        stretchRent: 1500,
      },
    };
    const ranked = listRankedListings(strictProfile, later);
    const stored = getListing("read-only-ranking");

    expect(ranked[0]?.score).not.toBe(saved.score);
    expect(stored?.score).toBe(saved.score);
    expect(stored?.scoreExplanation).toBe(saved.scoreExplanation);
  });
});
