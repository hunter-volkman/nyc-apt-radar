import { describe, expect, it } from "vitest";
import { scoreListing, scoringWeights } from "../src/lib/scoring";
import type { Listing, SearchProfile } from "../src/lib/types";

const profile: SearchProfile = {
  id: "test-profile",
  name: "Test NYC search",
  targetMoveInDate: "2026-06-24",
  maxRentMonthly: 3800,
  budgetToleranceMonthly: 150,
  preferredNeighborhoods: ["Fort Greene", "Clinton Hill", "Park Slope", "Prospect Heights"],
  acceptableNeighborhoods: ["Upper West Side", "Astoria", "Crown Heights", "South Slope"],
  hardNoNeighborhoods: ["Far Rockaway", "East New York", "Brownsville"],
  commuteDestinations: [
    {
      label: "Midtown office",
      address: "Bryant Park, New York, NY",
      maxMinutes: 38,
    },
  ],
  bedroomsMin: 1,
  bedroomsMax: 2,
  mustHaves: ["real bedroom", "laundry access", "solid light", "reasonable commute"],
  niceToHaves: ["dishwasher", "outdoor space", "prewar details", "bike storage"],
  hardNos: ["basement apartment", "broker pressure tactics", "unresolved tenant-paid fee"],
};

const baseListing: Listing = {
  id: "listing-under-test",
  sourceName: "Test fixture",
  sourceUrl: null,
  rawText:
    "Fort Greene 1BR near Lafayette. Bright garden-facing apartment with dishwasher, laundry in building, bike storage, and no fee.",
  title: "Garden-facing 1BR near Lafayette Avenue",
  address: "238 Adelphi Street, Brooklyn, NY",
  unit: "2R",
  neighborhood: "Fort Greene",
  borough: "Brooklyn",
  rentMonthly: 3650,
  netEffectiveRent: null,
  bedrooms: 1,
  bathrooms: 1,
  squareFeet: 690,
  availableDate: "2026-06-20",
  contactName: "Leasing Desk",
  contactEmail: "leasing@example.com",
  contactPhone: "(917) 555-0194",
  status: "new",
  amenities: ["dishwasher", "laundry in building", "bright light", "bike storage"],
  fees: ["no fee"],
  redFlags: [],
  openQuestions: ["Can applications be reviewed same day?"],
  personalNotes: "Serious contender with strong fit.",
  createdAt: "2026-06-10T08:42:00-05:00",
  updatedAt: "2026-06-10T10:18:00-05:00",
};

describe("scoreListing", () => {
  it("scores a strong candidate as eligible with a high deterministic score", () => {
    const evaluation = scoreListing(baseListing, profile);

    expect(scoringWeights).toEqual({
      location: 30,
      price: 25,
      apartmentFit: 15,
      moveInFit: 10,
      risk: 10,
      responsiveness: 5,
      subjectivePull: 5,
    });
    expect(evaluation.eligible).toBe(true);
    expect(evaluation.hardFilters).toEqual([]);
    expect(evaluation.totalScore).toBeGreaterThanOrEqual(85);
    expect(evaluation.totalScore).toBe(
      Object.values(evaluation.scoreBreakdown).reduce((total, value) => total + value, 0),
    );
    expect(evaluation.strengths).toContain("Preferred neighborhood");
    expect(evaluation.confidence).toBe("high");
  });

  it("fails the hard filter when rent exceeds budget plus tolerance", () => {
    const evaluation = scoreListing(
      {
        ...baseListing,
        id: "over-budget",
        rentMonthly: 4100,
        rawText: "Williamsburg loft alcove, $4,100, roof deck, gym, no fee, July 1.",
      },
      profile,
    );

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.hardFilters).toContain("Rent exceeds max budget plus tolerance.");
    expect(evaluation.scoreBreakdown.price).toBeLessThan(scoringWeights.price);
  });

  it("fails the hard filter when address is missing after parse", () => {
    const evaluation = scoreListing(
      {
        ...baseListing,
        id: "missing-address",
        address: null,
      },
      profile,
    );

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.hardFilters).toContain("Address is missing after parse.");
    expect(evaluation.openQuestions).toContain("What is the exact address?");
  });

  it("fails the hard filter for suspicious or unresolved fee language", () => {
    const evaluation = scoreListing(
      {
        ...baseListing,
        id: "suspicious-fee",
        fees: ["tenant-paid broker fee unclear"],
        rawText: "Crown Heights 1BR. Tenant-paid broker fee unclear. Total move-in cash TBD.",
      },
      profile,
    );

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.hardFilters).toContain("Fee language is suspicious or unresolved.");
    expect(evaluation.risks).toContain("Tenant-paid broker fee unclear");
  });

  it("fails the hard filter for a hard-no neighborhood", () => {
    const evaluation = scoreListing(
      {
        ...baseListing,
        id: "hard-no-neighborhood",
        neighborhood: "East New York",
        address: "201 Something Street, Brooklyn, NY",
      },
      profile,
    );

    expect(evaluation.eligible).toBe(false);
    expect(evaluation.hardFilters).toContain("Neighborhood is marked hard-no.");
    expect(evaluation.scoreBreakdown.location).toBeLessThan(scoringWeights.location / 2);
  });
});
