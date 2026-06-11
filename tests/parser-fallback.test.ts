import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseListing, parseListingFallback } from "../src/lib/parser";

const fixtureDir = path.join(__dirname, "fixtures", "listings");

function readFixture(name: string) {
  return readFileSync(path.join(fixtureDir, name), "utf8");
}

describe("parseListingFallback", () => {
  it("parses a broker email into reviewable listing fields", () => {
    const parsed = parseListingFallback({
      brokerMessage: readFixture("broker-email.txt"),
      referenceDate: "2026-06-11",
    });

    expect(parsed.parserMode).toBe("fallback");
    expect(parsed.listing.title).toContain("Fort Greene");
    expect(parsed.listing.address).toBe("238 Adelphi Street");
    expect(parsed.listing.unit).toBe("2R");
    expect(parsed.listing.neighborhood).toBe("Fort Greene");
    expect(parsed.listing.borough).toBe("Brooklyn");
    expect(parsed.listing.rentMonthly).toBe(3650);
    expect(parsed.listing.bedrooms).toBe(1);
    expect(parsed.listing.bathrooms).toBe(1);
    expect(parsed.listing.squareFeet).toBe(690);
    expect(parsed.listing.availableDate).toBe("2026-06-20");
    expect(parsed.listing.contactEmail).toBe("maya@northline.example");
    expect(parsed.listing.contactPhone).toBe("(917) 555-0194");
    expect(parsed.fees).toContain("owner-paid fee claimed; needs written confirmation");
    expect(parsed.redFlags).toContain("fee language not explicit");
    expect(parsed.openQuestions).toContain("Can the broker fee and total move-in cash be confirmed in writing?");
  });

  it("parses listing-style pasted text into structured fields", () => {
    const parsed = parseListingFallback({
      listingText: readFixture("listing-paste.txt"),
      referenceDate: "2026-06-11",
    });

    expect(parsed.parserMode).toBe("fallback");
    expect(parsed.listing.title).toBe("Sunny railroad 1BR near Broadway N/W");
    expect(parsed.listing.address).toBe("31-18 34th Avenue, Queens, NY");
    expect(parsed.listing.unit).toBe("4L");
    expect(parsed.listing.neighborhood).toBe("Astoria");
    expect(parsed.listing.borough).toBe("Queens");
    expect(parsed.listing.rentMonthly).toBe(2950);
    expect(parsed.listing.availableDate).toBe("2026-07-05");
    expect(parsed.listing.amenities).toEqual(
      expect.arrayContaining(["heat included", "good light", "laundry access"]),
    );
    expect(parsed.fees).toContain("one-month broker fee");
  });

  it("extracts fee language that should be resolved before outreach", () => {
    const parsed = parseListingFallback({
      listingText:
        "Crown Heights 1BR, $3,200. Tenant-paid broker fee unclear. Total move-in cash TBD. Application fee $20.",
      referenceDate: "2026-06-11",
    });

    expect(parsed.fees).toEqual(
      expect.arrayContaining(["tenant-paid broker fee unclear", "total move-in cash TBD", "application fee"]),
    );
    expect(parsed.redFlags).toContain("fee language not explicit");
    expect(parsed.openQuestions).toContain("Can the broker fee and total move-in cash be confirmed in writing?");
  });

  it("extracts red flags from broker-pressure language", () => {
    const parsed = parseListingFallback({
      brokerMessage:
        "Bushwick studio, $2,700. Address withheld until showing. Cash deposit preferred. Photos available later. Sight unseen is OK.",
      referenceDate: "2026-06-11",
    });

    expect(parsed.redFlags).toEqual(
      expect.arrayContaining([
        "address withheld",
        "cash or wire payment pressure",
        "photos unavailable",
        "sight-unseen or no-showing language",
      ]),
    );
    expect(parsed.openQuestions).toContain("What is the exact address?");
  });

  it("keeps missing-address parses honest with an open question and low confidence", () => {
    const parsed = parseListingFallback({
      listingText: readFixture("missing-address.txt"),
      referenceDate: "2026-06-11",
    });

    expect(parsed.listing.address).toBeNull();
    expect(parsed.confidence).toBe("low");
    expect(parsed.openQuestions).toContain("What is the exact address?");
  });

  it("uses the supplied referenceDate for available-now listings", () => {
    const parsed = parseListingFallback({
      listingText: "Prospect Heights 1BR, $3,300. Available now. No fee.",
      referenceDate: "2026-07-04",
    });

    expect(parsed.listing.availableDate).toBe("2026-07-04");
  });
});

describe("parseListing", () => {
  it("uses fallback mode when OPENAI_API_KEY is absent", async () => {
    const originalApiKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    try {
      const parsed = await parseListing({
        listingText: readFixture("listing-paste.txt"),
        referenceDate: "2026-06-11",
      });

      expect(parsed.parserMode).toBe("fallback");
      expect(parsed.listing.rentMonthly).toBe(2950);
    } finally {
      if (originalApiKey === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = originalApiKey;
      }
    }
  });
});
