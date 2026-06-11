import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDailyBriefing } from "../src/lib/briefing";
import { draftOutreach, draftOutreachFallback } from "../src/lib/outreach";
import type {
  ApplicationReadinessItem,
  Listing,
  OutreachKind,
  SearchProfile,
  Tour,
} from "../src/lib/types";

const originalApiKey = process.env.OPENAI_API_KEY;

const profile: SearchProfile & { applicationReadiness: ApplicationReadinessItem[] } = {
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
  applicationReadiness: [
    { id: "photo-id", label: "Photo identification ready", ready: true, blocking: false },
    { id: "bank-statements", label: "Bank statements ready", ready: false, blocking: true },
    { id: "landlord-reference", label: "Landlord reference ready", ready: false, blocking: true },
    { id: "guarantor-docs", label: "Guarantor documents ready, if needed", ready: false, blocking: false },
  ],
};

const fortGreeneListing: Listing = {
  id: "fort-greene-garden",
  sourceName: "Broker email",
  sourceUrl: null,
  rawText:
    "Fort Greene 1BR near Lafayette. Garden-facing, dishwasher, laundry in building. $3,650, June 20. Fee language says owner may cover.",
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
  contactName: "Maya Rosen",
  contactEmail: "maya@example.com",
  contactPhone: "(917) 555-0194",
  status: "new",
  amenities: ["dishwasher", "laundry in building", "garden view", "bike room"],
  fees: ["owner-paid fee claimed; needs written confirmation"],
  redFlags: ["fee language not explicit"],
  openQuestions: ["Is the broker fee fully owner-paid?", "Can applications be reviewed same day?"],
  personalNotes: "Looks fast, serious, and close enough to trains.",
  createdAt: "2026-06-10T08:42:00-05:00",
  updatedAt: "2026-06-10T10:18:00-05:00",
};

const uwsListing: Listing = {
  ...fortGreeneListing,
  id: "uws-riverside-prewar",
  title: "Quiet prewar 1BR by Riverside",
  address: "315 West 96th Street, New York, NY",
  neighborhood: "Upper West Side",
  borough: "Manhattan",
  rentMonthly: 3450,
  contactName: "Daniel Kim",
  contactEmail: "daniel@example.com",
  status: "contacted",
  fees: ["standard application fee"],
  redFlags: [],
  openQuestions: ["Is there a dishwasher?", "How loud is Broadway side traffic?"],
  updatedAt: "2026-06-10T09:52:00-05:00",
};

const crownHeightsListing: Listing = {
  ...fortGreeneListing,
  id: "crown-heights-renovated",
  title: "Renovated 1.5BR near Franklin Avenue",
  address: "742 Franklin Avenue, Brooklyn, NY",
  unit: "3F",
  neighborhood: "Crown Heights",
  rentMonthly: 3200,
  bedrooms: 1.5,
  contactName: "Nina Patel",
  contactEmail: "nina@example.com",
  status: "tour_scheduled",
  fees: ["tenant-paid broker fee unclear"],
  redFlags: ["fee unresolved", "open house could be crowded"],
  openQuestions: ["Is laundry in building or nearby?", "What is the total move-in cash?"],
  updatedAt: "2026-06-10T10:04:00-05:00",
};

const bushwickListing: Listing = {
  ...fortGreeneListing,
  id: "bushwick-basement",
  title: "Garden-level studio near Myrtle Wyckoff",
  address: "Address withheld until showing",
  unit: null,
  neighborhood: "Bushwick",
  rentMonthly: 2700,
  bedrooms: 0,
  contactName: "Unknown broker",
  contactEmail: "fastkeys@example.invalid",
  status: "dead",
  fees: ["cash deposit requested"],
  redFlags: ["address withheld", "cash deposit pressure", "basement-like language"],
  openQuestions: ["Is this legal occupancy?", "Why are photos not available?"],
  updatedAt: "2026-06-10T08:05:00-05:00",
};

const crownHeightsTour: Tour = {
  id: "tour-crown-heights-renovated",
  listingId: "crown-heights-renovated",
  startsAt: "2026-06-10T18:30:00-05:00",
  endsAt: "2026-06-10T19:00:00-05:00",
  notes: "Verify bedroom size, laundry, hallway smell, and total move-in cash.",
  verdict: "unknown",
  checklist: {
    Noise: false,
    Light: false,
  },
  createdAt: "2026-06-10T10:04:00-05:00",
  updatedAt: "2026-06-10T10:04:00-05:00",
};

afterEach(() => {
  vi.unstubAllGlobals();

  if (originalApiKey === undefined) {
    delete process.env.OPENAI_API_KEY;
  } else {
    process.env.OPENAI_API_KEY = originalApiKey;
  }
});

describe("draftOutreach fallback", () => {
  it.each<{
    kind: OutreachKind;
    expected: string;
  }>([
    { kind: "first_contact", expected: "earliest available tour time" },
    { kind: "follow_up", expected: "following up" },
    { kind: "fee_clarification", expected: "total move-in cash" },
    { kind: "tour_request", expected: "I would like to tour" },
    { kind: "post_tour_interest", expected: "application timeline" },
  ])("generates a deterministic $kind draft", ({ kind, expected }) => {
    const draft = draftOutreachFallback(fortGreeneListing, profile, kind);

    expect(draft.kind).toBe(kind);
    expect(draft.generationMode).toBe("fallback");
    expect(draft.approved).toBe(false);
    expect(draft.sentAt).toBeNull();
    expect(draft.safetyNote).toContain("never sends");
    expect(draft.body).toContain(expected);
  });

  it("uses fallback and does not call OpenAI when OPENAI_API_KEY is absent", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const draft = await draftOutreach(fortGreeneListing, profile, "first_contact");

    expect(draft.generationMode).toBe("fallback");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("generateDailyBriefing fallback", () => {
  it("summarizes best candidates, follow-ups, tours, risks, readiness gaps, and no-key behavior", async () => {
    delete process.env.OPENAI_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const brief = await generateDailyBriefing(
      [fortGreeneListing, uwsListing, crownHeightsListing, bushwickListing],
      [crownHeightsTour],
      profile,
    );

    expect(brief.generationMode).toBe("fallback");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(brief.bestCandidates.join(" ")).toContain("Garden-facing 1BR");
    expect(brief.followUps.join(" ")).toContain("Quiet prewar 1BR");
    expect(brief.upcomingTours.join(" ")).toContain("Renovated 1.5BR");
    expect(brief.deadOrRiskyListings.join(" ")).toContain("Garden-level studio");
    expect(brief.applicationReadinessGaps).toEqual([
      "Bank statements",
      "Landlord reference",
      "Guarantor documents, if needed",
    ]);
    expect(brief.recommendedNextActions.join(" ")).toContain("Clear application blocker");
  });

  it("includes an empty-tour state when no tours are scheduled", async () => {
    delete process.env.OPENAI_API_KEY;

    const brief = await generateDailyBriefing([fortGreeneListing, uwsListing], [], profile);

    expect(brief.upcomingTours).toEqual([
      "No tours scheduled. Convert one strong candidate into a tour slot.",
    ]);
  });
});
