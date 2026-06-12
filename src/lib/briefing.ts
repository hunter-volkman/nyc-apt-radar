import { scoreListing } from "@/lib/scoring";
import type {
  ApplicationReadinessItem,
  DailyBriefingResult,
  Listing,
  ListingEvaluation,
  SearchProfile,
  Tour,
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;

export type BriefingProfile = SearchProfile & {
  applicationReadiness?: ApplicationReadinessItem[];
};

type ScoredListing = {
  listing: Listing;
  evaluation: ListingEvaluation;
};

export type DailyBriefingOptions = {
  referenceNow?: Date | string;
};

const DEFAULT_OPENAI_MODEL = "gpt-5.5";

const dailyBriefingSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bestCandidates: stringArraySchema(),
    followUps: stringArraySchema(),
    upcomingTours: stringArraySchema(),
    deadOrRiskyListings: stringArraySchema(),
    applicationReadinessGaps: stringArraySchema(),
    recommendedNextActions: stringArraySchema(),
  },
  required: [
    "bestCandidates",
    "followUps",
    "upcomingTours",
    "deadOrRiskyListings",
    "applicationReadinessGaps",
    "recommendedNextActions",
  ],
} as const;

export async function generateDailyBriefing(
  listings: Listing[],
  tours: Tour[],
  profile: BriefingProfile,
  options: DailyBriefingOptions = {},
): Promise<DailyBriefingResult> {
  const fallback = generateDailyBriefingFallback(listings, tours, profile, options);

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    return await generateDailyBriefingWithOpenAI(listings, tours, profile, fallback);
  } catch {
    return fallback;
  }
}

export function generateDailyBriefingFallback(
  listings: Listing[],
  tours: Tour[],
  profile: BriefingProfile,
  options: DailyBriefingOptions = {},
): DailyBriefingResult {
  const scored = listings.map((listing) => ({
    listing,
    evaluation: scoreListing(listing, profile),
  }));
  const referenceNow = getReferenceDate(options.referenceNow);
  const generatedAt = referenceNow.toISOString();
  const referenceTime = referenceNow.getTime();
  const activeScored = scored.filter(({ listing }) => listing.status !== "dead" && listing.status !== "leased");
  const rankedCandidates = activeScored
    .sort(compareScoredListings)
    .slice(0, 3);
  const followUpListings = scored
    .filter(({ listing }) => listing.status === "contacted")
    .sort(compareScoredListings)
    .slice(0, 4);
  const listingById = new Map(listings.map((listing) => [listing.id, listing]));
  const upcomingTours = tours
    .filter((tour) => new Date(tour.startsAt).getTime() >= referenceTime)
    .map((tour) => ({ tour, listing: listingById.get(tour.listingId) }))
    .filter((bundle): bundle is { tour: Tour; listing: Listing } => Boolean(bundle.listing))
    .filter(({ listing }) => listing.status !== "dead" && listing.status !== "leased")
    .sort((left, right) => new Date(left.tour.startsAt).getTime() - new Date(right.tour.startsAt).getTime())
    .slice(0, 3);
  const riskyListings = scored
    .filter(({ listing, evaluation }) =>
      listing.status === "dead" || !evaluation.eligible || listing.redFlags.length > 0,
    )
    .sort((left, right) => {
      if (left.listing.status === "dead" && right.listing.status !== "dead") {
        return -1;
      }

      if (right.listing.status === "dead" && left.listing.status !== "dead") {
        return 1;
      }

      return left.evaluation.totalScore - right.evaluation.totalScore;
    })
    .slice(0, 4);
  const readinessGaps = getReadinessGaps(profile.applicationReadiness);

  return {
    generatedAt,
    generationMode: "fallback",
    bestCandidates: rankedCandidates.map(({ listing, evaluation }) =>
      `${listing.title}: ${evaluation.totalScore}/100, ${formatMoney(effectiveRent(listing))}, ${listing.neighborhood ?? "neighborhood unknown"}.`,
    ),
    followUps: followUpListings.length
      ? followUpListings.map(({ listing }) => `Follow up on ${listing.title}: propose two concrete tour windows.`)
      : ["No contacted listings are waiting on a follow-up."],
    upcomingTours: upcomingTours.length
      ? upcomingTours.map(({ tour, listing }) =>
        `${listing.title}: ${formatTourTime(tour.startsAt)}. Verify ${getTourFocus(listing)}.`,
      )
      : ["No tours scheduled. Convert one strong candidate into a tour slot."],
    deadOrRiskyListings: riskyListings.length
      ? riskyListings.map(({ listing, evaluation }) => `${listing.title}: ${evaluation.risks[0] ?? "risk captured"}.`)
      : ["No killed or high-risk listings need attention."],
    applicationReadinessGaps: readinessGaps.length
      ? readinessGaps
      : ["No application-readiness gaps are connected."],
    recommendedNextActions: buildRecommendedActions({
      rankedCandidates,
      followUpListings,
      upcomingTours,
      readinessGaps,
    }),
  };
}

async function generateDailyBriefingWithOpenAI(
  listings: Listing[],
  tours: Tour[],
  profile: BriefingProfile,
  fallback: DailyBriefingResult,
): Promise<DailyBriefingResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback;
  }

  const scoredListings = listings.map((listing) => ({
    listing,
    evaluation: scoreListing(listing, profile),
  }));

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_BRIEFING_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      instructions:
        "Create a short action-list briefing for a local-first NYC apartment hunt. Never claim to send messages, browse listings, or store documents. Keep every item brief and concrete. Return only JSON matching the schema.",
      input: JSON.stringify({
        profile: {
          name: profile.name,
          targetMoveInDate: profile.targetMoveInDate,
          maxRentMonthly: profile.maxRentMonthly,
          preferredNeighborhoods: profile.preferredNeighborhoods,
        },
        listings: scoredListings.map(({ listing, evaluation }) => ({
          id: listing.id,
          title: listing.title,
          status: listing.status,
          rentMonthly: listing.rentMonthly,
          neighborhood: listing.neighborhood,
          availableDate: listing.availableDate,
          score: evaluation.totalScore,
          eligible: evaluation.eligible,
          risks: evaluation.risks.slice(0, 3),
          openQuestions: evaluation.openQuestions.slice(0, 3),
        })),
        tours,
        applicationReadiness: profile.applicationReadiness ?? [],
        fallback,
      }),
      max_output_tokens: 1000,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "daily_briefing",
          strict: true,
          schema: dailyBriefingSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!response.ok) {
    return fallback;
  }

  const body = await response.json();
  const text = extractResponseText(body);

  if (!text) {
    return fallback;
  }

  const record = readRecord(JSON.parse(text));

  return {
    ...fallback,
    bestCandidates: withFallback(readStringArray(record.bestCandidates), fallback.bestCandidates),
    followUps: withFallback(readStringArray(record.followUps), fallback.followUps),
    upcomingTours: withFallback(readStringArray(record.upcomingTours), fallback.upcomingTours),
    deadOrRiskyListings: withFallback(readStringArray(record.deadOrRiskyListings), fallback.deadOrRiskyListings),
    applicationReadinessGaps: withFallback(
      readStringArray(record.applicationReadinessGaps),
      fallback.applicationReadinessGaps,
    ),
    recommendedNextActions: withFallback(
      readStringArray(record.recommendedNextActions).slice(0, 4),
      fallback.recommendedNextActions,
    ),
    generationMode: "openai",
  };
}

function buildRecommendedActions({
  rankedCandidates,
  followUpListings,
  upcomingTours,
  readinessGaps,
}: {
  rankedCandidates: ScoredListing[];
  followUpListings: ScoredListing[];
  upcomingTours: Array<{ tour: Tour; listing: Listing }>;
  readinessGaps: string[];
}) {
  const actions: string[] = [];
  const outreachCandidate = rankedCandidates.find(({ listing }) => listing.status === "new");
  const followUp = followUpListings[0];
  const tour = upcomingTours[0];

  if (outreachCandidate) {
    actions.push(`Draft outreach for ${outreachCandidate.listing.title} and ask the highest-risk question first.`);
  }

  if (followUp) {
    actions.push(`Follow up on ${followUp.listing.title} with two tour windows.`);
  }

  if (readinessGaps.length) {
    actions.push(`Clear application blocker: ${readinessGaps[0]}.`);
  }

  if (tour) {
    actions.push(`Tour ${tour.listing.title}; verify ${getTourFocus(tour.listing)} before getting attached.`);
  } else {
    actions.push("Get one strong candidate onto the tour calendar.");
  }

  if (!actions.length) {
    actions.push("Review the board and capture the next real listing before browsing further.");
  }

  return unique(actions).slice(0, 3);
}

function compareScoredListings(left: ScoredListing, right: ScoredListing) {
  if (left.evaluation.eligible !== right.evaluation.eligible) {
    return Number(right.evaluation.eligible) - Number(left.evaluation.eligible);
  }

  return right.evaluation.totalScore - left.evaluation.totalScore;
}

function getReadinessGaps(readiness: ApplicationReadinessItem[] | undefined) {
  if (!readiness) {
    return [];
  }

  return readiness
    .filter((item) => !item.ready)
    .sort((left, right) => Number(right.blocking) - Number(left.blocking))
    .map((item) => item.label.replace(/\s+ready\b/i, "").trim());
}

function getReferenceDate(value: Date | string | undefined) {
  const date = value instanceof Date ? value : value ? new Date(value) : new Date();

  if (Number.isFinite(date.getTime())) {
    return date;
  }

  return new Date();
}

function getTourFocus(listing: Listing) {
  return listing.openQuestions[0]?.replace(/\?+$/, "").toLowerCase()
    ?? listing.redFlags[0]?.toLowerCase()
    ?? "noise, light, water pressure, and broker answers";
}

function effectiveRent(listing: Listing) {
  return listing.netEffectiveRent ?? listing.rentMonthly;
}

function formatMoney(value: number | null) {
  if (value === null) {
    return "rent unknown";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTourTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function withFallback(values: string[], fallback: string[]) {
  return values.length ? values : fallback;
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

function readRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => (typeof item === "string" && item.trim() ? [item.trim()] : []));
}

function stringArraySchema() {
  return { type: "array", items: { type: "string" } };
}
