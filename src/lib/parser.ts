import type { Confidence, ParsedListing, ParseListingInput } from "@/lib/types";

type JsonRecord = Record<string, unknown>;

const DEFAULT_REFERENCE_DATE = "2026-06-11";
const DEFAULT_OPENAI_MODEL = "gpt-5.5";

const boroughByNeighborhood: Record<string, string> = {
  astoria: "Queens",
  "bed-stuy": "Brooklyn",
  "bedford-stuyvesant": "Brooklyn",
  boerum: "Brooklyn",
  "boerum hill": "Brooklyn",
  bushwick: "Brooklyn",
  "carroll gardens": "Brooklyn",
  chelsea: "Manhattan",
  "clinton hill": "Brooklyn",
  "cobble hill": "Brooklyn",
  "crown heights": "Brooklyn",
  "ditmas park": "Brooklyn",
  "east village": "Manhattan",
  flatbush: "Brooklyn",
  "fort greene": "Brooklyn",
  greenpoint: "Brooklyn",
  harlem: "Manhattan",
  "long island city": "Queens",
  "park slope": "Brooklyn",
  "prospect heights": "Brooklyn",
  ridgewood: "Queens",
  "south slope": "Brooklyn",
  sunnyside: "Queens",
  "upper east side": "Manhattan",
  "upper west side": "Manhattan",
  "west village": "Manhattan",
  williamsburg: "Brooklyn",
};

const neighborhoodNames = Object.keys(boroughByNeighborhood).sort((left, right) => right.length - left.length);

const amenityPatterns: Array<[RegExp, string]> = [
  [/\bdishwasher\b/i, "dishwasher"],
  [/\blaundry in (?:the )?building\b/i, "laundry in building"],
  [/\bin[-\s]?unit laundry\b/i, "in-unit laundry"],
  [/\blaundry\b/i, "laundry access"],
  [/\belevator\b/i, "elevator"],
  [/\bdoorman\b/i, "doorman"],
  [/\blive[-\s]?in super\b/i, "live-in super"],
  [/\b(?:roof deck|rooftop)\b/i, "roof deck"],
  [/\bgym\b|\bfitness\b/i, "gym"],
  [/\bbike (?:room|storage)\b/i, "bike storage"],
  [/\b(?:balcony|terrace|private outdoor|shared outdoor|garden access)\b/i, "outdoor space"],
  [/\bpets? (?:allowed|ok|case by case)\b/i, "pets considered"],
  [/\bheat (?:and hot water )?included\b/i, "heat included"],
  [/\b(?:sunny|bright|south-facing|good light)\b/i, "good light"],
  [/\brenovated kitchen\b/i, "renovated kitchen"],
  [/\bpre[-\s]?war\b/i, "prewar details"],
  [/\bcentral (?:air|a\/c|ac)\b/i, "central air"],
  [/\bpackage (?:room|area)\b/i, "package room"],
  [/\bnear (?:the )?(?:subway|train|[A-Z]\/[A-Z]|\d\/\d|[A-Z] train)\b/i, "transit nearby"],
];

const monthNumbers: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const streetPattern =
  String.raw`\b\d{1,5}(?:-\d{1,5})?\s+(?:(?:North|South|East|West|N|S|E|W)\s+)?(?:[A-Z0-9][A-Za-z0-9'.-]*\s+){0,5}(?:Street|St\.?|Avenue|Ave\.?|Boulevard|Blvd\.?|Road|Rd\.?|Drive|Dr\.?|Place|Pl\.?|Court|Ct\.?|Lane|Ln\.?|Terrace|Ter\.?|Parkway|Pkwy\.?|Broadway|Bowery|Way)(?:\s*,\s*(?:Brooklyn|Manhattan|Queens|Bronx|Staten Island|New York)(?:,\s*NY)?)?`;

const openAiParserSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    listing: {
      type: "object",
      additionalProperties: false,
      properties: {
        sourceName: nullableStringSchema(),
        sourceUrl: nullableStringSchema(),
        rawText: nullableStringSchema(),
        title: { type: "string" },
        address: nullableStringSchema(),
        unit: nullableStringSchema(),
        neighborhood: nullableStringSchema(),
        borough: nullableStringSchema(),
        rentMonthly: nullableNumberSchema(),
        netEffectiveRent: nullableNumberSchema(),
        bedrooms: nullableNumberSchema(),
        bathrooms: nullableNumberSchema(),
        squareFeet: nullableNumberSchema(),
        availableDate: nullableStringSchema(),
        contactName: nullableStringSchema(),
        contactEmail: nullableStringSchema(),
        contactPhone: nullableStringSchema(),
        amenities: stringArraySchema(),
        fees: stringArraySchema(),
        redFlags: stringArraySchema(),
        openQuestions: stringArraySchema(),
        personalNotes: nullableStringSchema(),
      },
      required: [
        "sourceName",
        "sourceUrl",
        "rawText",
        "title",
        "address",
        "unit",
        "neighborhood",
        "borough",
        "rentMonthly",
        "netEffectiveRent",
        "bedrooms",
        "bathrooms",
        "squareFeet",
        "availableDate",
        "contactName",
        "contactEmail",
        "contactPhone",
        "amenities",
        "fees",
        "redFlags",
        "openQuestions",
        "personalNotes",
      ],
    },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    fees: stringArraySchema(),
    redFlags: stringArraySchema(),
    openQuestions: stringArraySchema(),
  },
  required: ["listing", "confidence", "fees", "redFlags", "openQuestions"],
} as const;

export async function parseListing(input: ParseListingInput): Promise<ParsedListing> {
  const normalizedInput = normalizeParseInput(input);

  if (process.env.OPENAI_API_KEY) {
    try {
      return await parseListingWithOpenAI(normalizedInput);
    } catch {
      return parseListingFallback(normalizedInput);
    }
  }

  return parseListingFallback(normalizedInput);
}

export function parseListingFallback(input: ParseListingInput): ParsedListing {
  const normalizedInput = normalizeParseInput(input);
  const rawText = buildRawText(normalizedInput);
  const urlContext = getUrlContext(normalizedInput.sourceUrl);
  const textForParsing = [rawText, urlContext].filter(Boolean).join("\n");
  const address = extractAddress(textForParsing);
  const unit = extractUnit(textForParsing);
  const neighborhood = extractNeighborhood(textForParsing);
  const borough = extractBorough(textForParsing, neighborhood);
  const rent = extractRent(textForParsing);
  const bedrooms = extractBedrooms(textForParsing);
  const bathrooms = extractBathrooms(textForParsing);
  const squareFeet = extractSquareFeet(textForParsing);
  const availableDate = extractAvailableDate(textForParsing, normalizedInput.referenceDate);
  const contactEmail = extractEmail(textForParsing);
  const contactPhone = extractPhone(textForParsing);
  const contactName = extractContactName(textForParsing);
  const fees = extractFees(textForParsing);
  const redFlags = extractRedFlags(textForParsing, fees, address);
  const openQuestions = extractOpenQuestions({
    address,
    availableDate,
    contactEmail,
    contactPhone,
    fees,
    neighborhood,
    rentMonthly: rent.rentMonthly,
    sourceUrl: normalizedInput.sourceUrl,
    text: rawText,
  });
  const title = extractTitle(textForParsing, {
    address,
    bedrooms,
    neighborhood,
  });
  const confidence = deriveConfidence({
    address,
    availableDate,
    bedrooms,
    contactEmail,
    contactPhone,
    neighborhood,
    openQuestions,
    redFlags,
    rentMonthly: rent.rentMonthly,
  });

  return {
    listing: {
      sourceName: deriveSourceName(normalizedInput),
      sourceUrl: normalizedInput.sourceUrl,
      rawText,
      title,
      address,
      unit,
      neighborhood,
      borough,
      rentMonthly: rent.rentMonthly,
      netEffectiveRent: rent.netEffectiveRent,
      bedrooms,
      bathrooms,
      squareFeet,
      availableDate,
      contactName,
      contactEmail,
      contactPhone,
      amenities: extractAmenities(textForParsing),
      fees,
      redFlags,
      openQuestions,
      personalNotes: normalizedInput.manualNotes,
    },
    confidence,
    fees,
    redFlags,
    openQuestions,
    parserMode: "fallback",
  };
}

export function parseListingInput(input: unknown): ParseListingInput {
  const record = requireRecord(input);

  return normalizeParseInput({
    listingText: readString(record.listingText),
    brokerMessage: readString(record.brokerMessage),
    sourceUrl: readString(record.sourceUrl),
    manualNotes: readString(record.manualNotes),
    referenceDate: readString(record.referenceDate),
  });
}

async function parseListingWithOpenAI(input: ParseListingInput): Promise<ParsedListing> {
  const fallback = parseListingFallback(input);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PARSER_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      instructions:
        "Extract NYC rental listing facts into JSON. Do not browse, fetch, or infer facts from listing URLs beyond treating the URL as source context. Use null for unknown fields, low confidence for thin inputs, and open questions instead of fake certainty.",
      input: [
        "Listing web address context only:",
        input.sourceUrl ?? "(none)",
        "",
        "Pasted listing text:",
        input.listingText ?? "(none)",
        "",
        "Broker email or message:",
        input.brokerMessage ?? "(none)",
        "",
        "Manual notes:",
        input.manualNotes ?? "(none)",
      ].join("\n"),
      max_output_tokens: 1400,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "parsed_listing",
          strict: true,
          schema: openAiParserSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    return fallback;
  }

  const body = await response.json();
  const text = extractResponseText(body);

  if (!text) {
    return fallback;
  }

  return normalizeOpenAiParsedListing(JSON.parse(text), fallback);
}

function normalizeOpenAiParsedListing(payload: unknown, fallback: ParsedListing): ParsedListing {
  const record = requireRecord(payload);
  const listingRecord = readRecord(record.listing);
  const fees = uniqueClean(readStringArray(record.fees).concat(readStringArray(listingRecord.fees)));
  const redFlags = uniqueClean(readStringArray(record.redFlags).concat(readStringArray(listingRecord.redFlags)));
  const openQuestions = uniqueClean(
    readStringArray(record.openQuestions).concat(readStringArray(listingRecord.openQuestions)),
  );
  const normalizedFees = fees.length ? fees : fallback.fees;
  const normalizedRedFlags = redFlags.length ? redFlags : fallback.redFlags;
  const normalizedOpenQuestions = openQuestions.length ? openQuestions : fallback.openQuestions;

  return {
    listing: {
      ...fallback.listing,
      sourceName: readString(listingRecord.sourceName) ?? fallback.listing.sourceName ?? "OpenAI parser",
      sourceUrl: fallback.listing.sourceUrl,
      rawText: fallback.listing.rawText,
      title: readString(listingRecord.title) ?? fallback.listing.title,
      address: readString(listingRecord.address) ?? fallback.listing.address,
      unit: readString(listingRecord.unit) ?? fallback.listing.unit,
      neighborhood: readString(listingRecord.neighborhood) ?? fallback.listing.neighborhood,
      borough: readString(listingRecord.borough) ?? fallback.listing.borough,
      rentMonthly: readNumber(listingRecord.rentMonthly) ?? fallback.listing.rentMonthly,
      netEffectiveRent: readNumber(listingRecord.netEffectiveRent) ?? fallback.listing.netEffectiveRent,
      bedrooms: readNumber(listingRecord.bedrooms) ?? fallback.listing.bedrooms,
      bathrooms: readNumber(listingRecord.bathrooms) ?? fallback.listing.bathrooms,
      squareFeet: readNumber(listingRecord.squareFeet) ?? fallback.listing.squareFeet,
      availableDate: readString(listingRecord.availableDate) ?? fallback.listing.availableDate,
      contactName: readString(listingRecord.contactName) ?? fallback.listing.contactName,
      contactEmail: readString(listingRecord.contactEmail) ?? fallback.listing.contactEmail,
      contactPhone: readString(listingRecord.contactPhone) ?? fallback.listing.contactPhone,
      amenities: uniqueClean(readStringArray(listingRecord.amenities).concat(fallback.listing.amenities)),
      fees: normalizedFees,
      redFlags: normalizedRedFlags,
      openQuestions: normalizedOpenQuestions,
      personalNotes: readString(listingRecord.personalNotes) ?? fallback.listing.personalNotes,
    },
    confidence: readConfidence(record.confidence) ?? fallback.confidence,
    fees: normalizedFees,
    redFlags: normalizedRedFlags,
    openQuestions: normalizedOpenQuestions,
    parserMode: "openai",
  };
}

function normalizeParseInput(input: ParseListingInput): Required<ParseListingInput> {
  return {
    listingText: cleanString(input.listingText),
    brokerMessage: cleanString(input.brokerMessage),
    sourceUrl: cleanString(input.sourceUrl),
    manualNotes: cleanString(input.manualNotes),
    referenceDate: cleanString(input.referenceDate) ?? DEFAULT_REFERENCE_DATE,
  };
}

function buildRawText(input: Required<ParseListingInput>) {
  const sections = [
    input.listingText,
    input.brokerMessage ? `Broker message:\n${input.brokerMessage}` : null,
    input.manualNotes ? `Manual notes:\n${input.manualNotes}` : null,
  ].filter(Boolean);

  return sections.join("\n\n") || null;
}

function getUrlContext(sourceUrl: string | null) {
  if (!sourceUrl) {
    return null;
  }

  try {
    const url = new URL(sourceUrl);
    return `${url.hostname} ${url.pathname.replace(/[-_/]+/g, " ")}`;
  } catch {
    return sourceUrl.replace(/[-_/]+/g, " ");
  }
}

function deriveSourceName(input: Required<ParseListingInput>) {
  if (input.sourceUrl) {
    try {
      const host = new URL(input.sourceUrl).hostname.replace(/^www\./, "");
      return `${host} context`;
    } catch {
      return "Web address context";
    }
  }

  if (input.brokerMessage) {
    return "Broker message";
  }

  if (input.listingText) {
    return "Pasted listing";
  }

  return "Inbox parser";
}

function extractTitle(text: string, facts: { address: string | null; bedrooms: number | null; neighborhood: string | null }) {
  const subject = text.match(/^\s*subject\s*:\s*(.+)$/im)?.[1];
  const subjectTitle = cleanTitle(subject);

  if (subjectTitle) {
    return subjectTitle;
  }

  const candidate = splitLines(text)
    .map(cleanTitle)
    .find((line) => {
      if (!line || line.length < 8 || line.length > 96) {
        return false;
      }

      if (/^(hi|hello|hey|from|to|sent|available|contact|call|text|broker message|manual notes)\b/i.test(line)) {
        return false;
      }

      return /\$|(?:\d+(?:\.\d+)?\s*(?:br|bed|bedroom))|studio|apartment|apt|near|off|listing/i.test(line);
    });

  if (candidate) {
    return candidate;
  }

  const bedroomLabel =
    facts.bedrooms === 0
      ? "studio"
      : facts.bedrooms !== null
        ? `${formatNumber(facts.bedrooms)}BR`
        : "apartment";
  const locationLabel = facts.neighborhood ?? facts.address ?? "NYC";

  return `${locationLabel} ${bedroomLabel}`;
}

function cleanTitle(value: string | null | undefined) {
  const cleaned = value
    ?.replace(/\s+/g, " ")
    .replace(/\s+[-|]\s+\$?[0-9,]+.*$/i, "")
    .replace(/\s*\(?available.*$/i, "")
    .trim()
    .replace(/[.]+$/, "");

  return cleaned || null;
}

function extractAddress(text: string) {
  if (/\baddress withheld\b/i.test(text)) {
    return "Address withheld until showing";
  }

  const labeled = text.match(/^\s*(?:address|addr)\s*:\s*(.+)$/im)?.[1];
  const labeledMatch = labeled?.match(new RegExp(streetPattern, "i"))?.[0];
  const directMatch = text.match(new RegExp(streetPattern, "i"))?.[0];

  return cleanString(labeledMatch ?? directMatch);
}

function extractUnit(text: string) {
  return cleanString(
    text.match(/\b(?:apt|apartment|unit|#)\s*([A-Za-z0-9-]+)\b/i)?.[1] ??
      text.match(/\bunit\s+([A-Za-z0-9-]+)\b/i)?.[1],
  );
}

function extractNeighborhood(text: string) {
  const labeled = text.match(/^\s*neighborhood\s*:\s*(.+)$/im)?.[1];
  const labeledNeighborhood = labeled
    ? neighborhoodNames.find((name) => normalizeText(labeled).includes(name))
    : undefined;

  if (labeledNeighborhood) {
    return titleCaseNeighborhood(labeledNeighborhood);
  }

  const normalized = normalizeText(text);
  const match = neighborhoodNames.find((name) => normalized.includes(name));
  return match ? titleCaseNeighborhood(match) : null;
}

function extractBorough(text: string, neighborhood: string | null) {
  const direct = text.match(/\b(Brooklyn|Manhattan|Queens|Bronx|Staten Island)\b/i)?.[1];

  if (direct) {
    return titleCaseNeighborhood(direct.toLowerCase());
  }

  if (neighborhood) {
    return boroughByNeighborhood[normalizeText(neighborhood)] ?? null;
  }

  return null;
}

function extractRent(text: string) {
  const moneyMatches = Array.from(text.matchAll(/\$\s*([1-9][0-9,]*(?:\.\d{2})?)/g));
  let rentMonthly: number | null = null;
  let netEffectiveRent: number | null = null;

  for (const match of moneyMatches) {
    const amount = parseMoney(match[1]);
    const context = getContext(text, match.index ?? 0, 40);

    if (amount === null || amount < 1000 || amount > 20000) {
      continue;
    }

    if (/\b(application|app|deposit|security|move-in|amenity)\b/i.test(context)) {
      continue;
    }

    if (/\bnet effective\b/i.test(context)) {
      netEffectiveRent ??= amount;
    } else {
      rentMonthly ??= amount;
    }
  }

  const labeledRent = text.match(/\b(?:rent|monthly rent)\s*[:\-]?\s*([1-9][0-9,]{3,})\b/i)?.[1];
  rentMonthly ??= parseMoney(labeledRent);

  return { rentMonthly, netEffectiveRent };
}

function extractBedrooms(text: string) {
  if (/\bstudio\b/i.test(text)) {
    return 0;
  }

  return readNumber(text.match(/\b(\d+(?:\.\d+)?)\s*(?:br|bed|beds|bedroom|bedrooms|bd)\b/i)?.[1]);
}

function extractBathrooms(text: string) {
  return readNumber(text.match(/\b(\d+(?:\.\d+)?)\s*(?:ba|bath|baths|bathroom|bathrooms)\b/i)?.[1]);
}

function extractSquareFeet(text: string) {
  return readNumber(text.match(/\b(\d{3,4})\s*(?:sq\.?\s*ft|square feet|sf)\b/i)?.[1]);
}

function extractAvailableDate(text: string, referenceDate: string | null | undefined) {
  if (/\b(?:available\s+)?(?:now|immediate|asap)\b/i.test(text)) {
    return normalizeDate(referenceDate);
  }

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)?.slice(1, 4);

  if (iso) {
    return formatDate(Number(iso[0]), Number(iso[1]), Number(iso[2]));
  }

  const slash = text.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}|\d{2}))?\b/);

  if (slash) {
    return formatDate(resolveYear(slash[3], referenceDate), Number(slash[1]), Number(slash[2]));
  }

  const month = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+(\d{1,2})(?:,\s*(20\d{2}))?\b/i,
  );

  if (month) {
    return formatDate(resolveYear(month[3], referenceDate), monthNumbers[month[1].toLowerCase()], Number(month[2]));
  }

  return null;
}

function extractEmail(text: string) {
  return cleanString(text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]);
}

function extractPhone(text: string) {
  return cleanString(text.match(/(?:\+1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/)?.[0]);
}

function extractContactName(text: string) {
  return cleanString(
    text.match(/^\s*from\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/im)?.[1] ??
      text.match(/\bthis is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/)?.[1] ??
      text.match(/\b(?:contact|broker|agent)\s*:\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b/i)?.[1],
  );
}

function extractAmenities(text: string) {
  return uniqueClean(amenityPatterns.flatMap(([pattern, label]) => (pattern.test(text) ? [label] : [])));
}

function extractFees(text: string) {
  const fees: string[] = [];

  if (/\bno\s+(?:broker\s+)?fee\b/i.test(text)) {
    fees.push("no broker fee stated");
  }

  if (/\b(?:owner|landlord)\s+(?:may\s+)?(?:pay|pays|cover|covers|covering).{0,35}(?:broker\s+)?fee\b/i.test(text)) {
    fees.push(/\bmay\b/i.test(text) ? "owner-paid fee claimed; needs written confirmation" : "owner-paid broker fee stated");
  }

  if (/\b(?:tenant[-\s]?paid|tenant pays).{0,35}(?:broker\s+)?fee.{0,35}\b(?:unclear|unknown|unresolved|tbd)\b/i.test(text)) {
    fees.push("tenant-paid broker fee unclear");
  } else if (/\b(?:tenant[-\s]?paid|tenant pays).{0,35}(?:broker\s+)?fee\b/i.test(text)) {
    fees.push("tenant-paid broker fee stated");
  }

  if (/\bone[-\s]?month(?:'s)?\s+broker fee\b/i.test(text)) {
    fees.push("one-month broker fee");
  }

  const percentFee = text.match(/\b(\d{1,2})\s*%\s+(?:broker\s+)?fee\b/i)?.[1];
  if (percentFee) {
    fees.push(`${percentFee}% broker fee`);
  }

  if (/\bapplication fee\b/i.test(text)) {
    fees.push("application fee");
  }

  if (/\bsecurity deposit\b/i.test(text)) {
    fees.push("security deposit");
  }

  if (/\b(?:move-in|move in) fee\b/i.test(text)) {
    fees.push("move-in fee");
  }

  if (/\bamenity fee\b/i.test(text)) {
    fees.push("amenity fee");
  }

  if (/\btotal move[-\s]?in cash\b.{0,35}\b(?:tbd|unclear|unknown)\b/i.test(text)) {
    fees.push("total move-in cash TBD");
  }

  if (/\b(?:fee|broker fee)\b.{0,35}\b(?:unclear|unknown|unresolved|tbd)\b/i.test(text)) {
    fees.push("fee language unclear");
  }

  return uniqueClean(fees);
}

function extractRedFlags(text: string, fees: string[], address: string | null) {
  const redFlags: string[] = [];

  if (!hasUsableAddress(address) && /\baddress withheld\b/i.test(text)) {
    redFlags.push("address withheld");
  }

  if (/\b(?:cash|wire|crypto|zelle)\b.{0,40}\b(?:deposit|fee|payment|move[-\s]?in)\b/i.test(text)) {
    redFlags.push("cash or wire payment pressure");
  }

  if (/\bpay\b.{0,40}\bbefore\b.{0,25}\b(?:showing|tour|viewing)\b/i.test(text)) {
    redFlags.push("payment requested before showing");
  }

  if (/\b(?:sight unseen|no showing|no tour|no viewing)\b/i.test(text)) {
    redFlags.push("sight-unseen or no-showing language");
  }

  if (/\b(?:photos? available later|no photos?)\b/i.test(text)) {
    redFlags.push("photos unavailable");
  }

  if (/\bguaranteed approval\b/i.test(text)) {
    redFlags.push("guaranteed approval language");
  }

  if (/\b(?:basement|garden level)\b/i.test(text)) {
    redFlags.push("basement or garden-level risk");
  }

  if (/\brailroad\b/i.test(text)) {
    redFlags.push("railroad layout");
  }

  if (/\b(?:rented|unavailable|off market|application accepted|lease signed)\b/i.test(text)) {
    redFlags.push("listing may be unavailable");
  }

  if (fees.some((fee) => /\b(?:unclear|unknown|unresolved|tbd|needs written confirmation)\b/i.test(fee))) {
    redFlags.push("fee language not explicit");
  }

  return uniqueClean(redFlags);
}

function extractOpenQuestions({
  address,
  availableDate,
  contactEmail,
  contactPhone,
  fees,
  neighborhood,
  rentMonthly,
  sourceUrl,
  text,
}: {
  address: string | null;
  availableDate: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  fees: string[];
  neighborhood: string | null;
  rentMonthly: number | null;
  sourceUrl: string | null;
  text: string | null;
}) {
  const questions: string[] = [];

  if (!hasUsableAddress(address)) {
    questions.push("What is the exact address?");
  }

  if (rentMonthly === null) {
    questions.push("What is the monthly rent?");
  }

  if (!neighborhood) {
    questions.push("Which neighborhood is this in?");
  }

  if (!availableDate) {
    questions.push("When is the apartment available?");
  }

  if (!contactEmail && !contactPhone) {
    questions.push("Who is the direct contact?");
  }

  if (!fees.length) {
    questions.push("What fees are due before lease signing?");
  } else if (fees.some((fee) => /\b(?:unclear|unknown|unresolved|tbd|needs written confirmation)\b/i.test(fee))) {
    questions.push("Can the broker fee and total move-in cash be confirmed in writing?");
  }

  if (sourceUrl && !text) {
    questions.push("Paste listing text or a broker message; the web address was saved as context only.");
  }

  return uniqueClean(questions);
}

function deriveConfidence({
  address,
  availableDate,
  bedrooms,
  contactEmail,
  contactPhone,
  neighborhood,
  openQuestions,
  redFlags,
  rentMonthly,
}: {
  address: string | null;
  availableDate: string | null;
  bedrooms: number | null;
  contactEmail: string | null;
  contactPhone: string | null;
  neighborhood: string | null;
  openQuestions: string[];
  redFlags: string[];
  rentMonthly: number | null;
}) {
  const completeFields = [
    hasUsableAddress(address),
    rentMonthly !== null,
    Boolean(neighborhood),
    Boolean(availableDate),
    bedrooms !== null,
    Boolean(contactEmail || contactPhone),
  ].filter(Boolean).length;

  let confidence: Confidence = "low";

  if (completeFields >= 5 && openQuestions.length <= 2) {
    confidence = "high";
  } else if (completeFields >= 3) {
    confidence = "medium";
  }

  if (!hasUsableAddress(address)) {
    confidence = downgradeConfidence(confidence);
  }

  if (redFlags.length >= 2) {
    confidence = downgradeConfidence(confidence);
  }

  return confidence;
}

function extractResponseText(body: unknown) {
  const record = readRecord(body);
  const outputText = readString(record.output_text);

  if (outputText) {
    return outputText;
  }

  const output = Array.isArray(record.output) ? record.output : [];

  for (const item of output) {
    const itemRecord = readRecord(item);
    const content = Array.isArray(itemRecord.content) ? itemRecord.content : [];

    for (const part of content) {
      const text = readString(readRecord(part).text);

      if (text) {
        return text;
      }
    }
  }

  return null;
}

function hasUsableAddress(address: string | null) {
  const normalized = normalizeText(address);

  return Boolean(
    normalized &&
      ![
        "address withheld",
        "withheld until",
        "provided at showing",
        "available later",
        "upon request",
        "not disclosed",
        "tbd",
        "unknown",
      ].some((marker) => normalized.includes(marker)),
  );
}

function splitLines(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return value;
}

function resolveYear(value: string | undefined, referenceDate: string | null | undefined) {
  if (value?.length === 4) {
    return Number(value);
  }

  if (value?.length === 2) {
    return 2000 + Number(value);
  }

  return Number(referenceDate?.slice(0, 4)) || Number(DEFAULT_REFERENCE_DATE.slice(0, 4));
}

function formatDate(year: number, month: number, day: number) {
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
}

function formatMoneyNumber(value: number) {
  return Math.round(value);
}

function parseMoney(value: string | null | undefined) {
  const parsed = readNumber(value?.replace(/[$,]/g, ""));
  return parsed === null ? null : formatMoneyNumber(parsed);
}

function getContext(text: string, index: number, radius: number) {
  return text.slice(Math.max(0, index - radius), index + radius);
}

function titleCaseNeighborhood(value: string) {
  return value
    .split(/\s+/)
    .map((word) =>
      word
        .split("-")
        .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1)}` : part))
        .join("-"),
    )
    .join(" ");
}

function downgradeConfidence(confidence: Confidence): Confidence {
  if (confidence === "high") {
    return "medium";
  }

  if (confidence === "medium") {
    return "low";
  }

  return "low";
}

function readConfidence(value: unknown): Confidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function requireRecord(input: unknown): JsonRecord {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Request body must be a JSON object.");
  }

  return input as JsonRecord;
}

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().replace(/\s+\n/g, "\n") : null;
}

function readNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []));
}

function uniqueClean(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function normalizeText(value: string | null | undefined) {
  return value?.toLowerCase().replace(/\s+/g, " ").trim() ?? "";
}

function nullableStringSchema() {
  return { type: ["string", "null"] };
}

function nullableNumberSchema() {
  return { type: ["number", "null"] };
}

function stringArraySchema() {
  return { type: "array", items: { type: "string" } };
}
