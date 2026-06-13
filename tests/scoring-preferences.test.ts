import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Listing } from "../src/core/listings";
import { defaultPreferenceProfile, loadPreferenceProfile, type PreferenceProfile } from "../src/core/preferences";
import { scoreListing } from "../src/core/scoring";
import { loadSearchConfigs } from "../src/discovery/searches";

const now = new Date("2026-06-12T18:00:00.000Z");

describe("scoring preferences", () => {
  it("requires every configured pet type and explains dog-specific misses", () => {
    const profile = withPets({ cats: true, dogs: true });
    const catsOnly = scoreListing(makeListing({ pets: "cats_allowed" }), profile, now);
    const noPets = scoreListing(makeListing({ pets: "no_pets" }), profile, now);
    const bothAllowed = scoreListing(makeListing({ pets: "cats_and_dogs_allowed" }), profile, now);

    expect(catsOnly.categoryScores.petFit).toBe(0);
    expect(catsOnly.dealbreakers).toContain("Dogs are not allowed.");
    expect(catsOnly.explanation).toContain("dogs not allowed");

    expect(noPets.dealbreakers).toContain("Cats and dogs are not allowed.");
    expect(noPets.explanation).toContain("cats and dogs not allowed");

    expect(bothAllowed.categoryScores.petFit).toBe(10);
    expect(bothAllowed.dealbreakers).toEqual([]);
    expect(bothAllowed.explanation).toContain("cats and dogs allowed");
  });

  it("penalizes broker fees only for no-fee profiles with known broker-fee listings", () => {
    const noFee = scoreListing(makeListing({ feeStatus: "no_fee" }), defaultPreferenceProfile, now);
    const unknown = scoreListing(makeListing({ feeStatus: "unknown" }), defaultPreferenceProfile, now);
    const brokerFee = scoreListing(makeListing({ feeStatus: "broker_fee" }), defaultPreferenceProfile, now);
    const flexible = scoreListing(
      makeListing({ feeStatus: "broker_fee" }),
      { ...defaultPreferenceProfile, feePreference: "flexible" },
      now,
    );

    expect(unknown.categoryScores.priceFit).toBe(noFee.categoryScores.priceFit);
    expect(brokerFee.categoryScores.priceFit).toBe(noFee.categoryScores.priceFit - 5);
    expect(flexible.categoryScores.priceFit).toBe(noFee.categoryScores.priceFit);
  });

  it.each([
    ["budget bounds", { budget: { targetRent: 4200, maxRent: 4000 } }, /budget must satisfy/],
    ["hot score", { hotScore: 101 }, /hotScore/],
    ["neighborhood arrays", { neighborhoods: { preferred: ["Chelsea", 7] } }, /neighborhoods\.preferred/],
    [
      "commute target coordinates",
      { commuteTargets: [{ label: "Work", address: "Office", latitude: "40.7", longitude: -73.9, maxMinutes: 30 }] },
      /commuteTargets\[0\]\.latitude/,
    ],
    ["bedroom bounds", { bedroomPreference: { min: 3, max: 1 } }, /bedroomPreference must satisfy/],
    ["bathroom bounds", { bathroomPreference: { min: -1 } }, /bathroomPreference\.min/],
    ["pet booleans", { petRequirements: { cats: "yes" } }, /petRequirements\.cats/],
    ["dealbreaker strings", { dealbreakers: ["wire deposit", ""] }, /dealbreakers/],
    ["nice-to-have strings", { niceToHaves: ["laundry", false] }, /niceToHaves/],
    ["move-in date", { targetMoveIn: "July" }, /targetMoveIn/],
    ["fee preference", { feePreference: "never" }, /feePreference/],
  ])("rejects invalid preference JSON for %s", (_label, value, errorPattern) => {
    const preferencesPath = tempJsonPath("preferences");
    fs.writeFileSync(preferencesPath, JSON.stringify(value));

    expect(() => loadPreferenceProfile(preferencesPath)).toThrow(errorPattern);
  });

  it("rejects non-positive search result limits", () => {
    const searchesPath = tempJsonPath("searches");
    fs.writeFileSync(searchesPath, JSON.stringify({
      searches: [{
        id: "bad-limit",
        provider: "streeteasy",
        searchUrl: "https://streeteasy.com/for-rent/nyc",
        resultLimit: 0,
      }],
    }));

    expect(() => loadSearchConfigs(searchesPath)).toThrow(/resultLimit must be a positive integer/);
  });

  it("rejects insecure autonomous StreetEasy search URLs", () => {
    const searchesPath = tempJsonPath("searches");
    fs.writeFileSync(searchesPath, JSON.stringify({
      searches: [{
        id: "insecure-search",
        provider: "streeteasy",
        searchUrl: "http://streeteasy.com/for-rent/nyc",
      }],
    }));

    expect(() => loadSearchConfigs(searchesPath)).toThrow(/https searchUrl/);
  });
});

function withPets(petRequirements: PreferenceProfile["petRequirements"]): PreferenceProfile {
  return {
    ...defaultPreferenceProfile,
    petRequirements,
  };
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "listing-1",
    source: "manual",
    sourceUrl: "https://streeteasy.com/building/example/1",
    title: "Chelsea 1BR",
    address: "345 W 30th St #4B",
    neighborhood: "Chelsea",
    borough: "Manhattan",
    rent: 3700,
    bedrooms: 1,
    bathrooms: 1,
    availableDate: null,
    description: "Bright apartment near transit.",
    amenities: ["dishwasher", "laundry"],
    pets: "cats_allowed",
    feeStatus: "no_fee",
    latitude: 40.7502,
    longitude: -73.9970,
    status: "new",
    firstSeenAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    score: 0,
    scoreExplanation: "",
    contactName: null,
    appointmentAt: null,
    ...overrides,
  };
}

function tempJsonPath(prefix: string) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `nyc-apt-radar-${prefix}-`));
  return path.join(directory, `${prefix}.json`);
}
