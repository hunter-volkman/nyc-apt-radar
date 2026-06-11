import type {
  Listing,
  OutreachDraft,
  OutreachKind,
  SearchProfile,
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;

const DEFAULT_OPENAI_MODEL = "gpt-5.5";

export const outreachKinds = [
  "first_contact",
  "follow_up",
  "fee_clarification",
  "tour_request",
  "post_tour_interest",
] as const satisfies readonly OutreachKind[];

export const outreachKindLabels: Record<OutreachKind, string> = {
  first_contact: "First contact",
  follow_up: "Follow-up",
  fee_clarification: "Fee clarification",
  tour_request: "Tour request",
  post_tour_interest: "Post-tour interest",
};

const outreachDraftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string" },
    body: { type: "string" },
  },
  required: ["subject", "body"],
} as const;

export async function draftOutreach(
  listing: Listing,
  profile: SearchProfile,
  kind: OutreachKind,
): Promise<OutreachDraft> {
  const fallback = draftOutreachFallback(listing, profile, kind);

  if (!process.env.OPENAI_API_KEY) {
    return fallback;
  }

  try {
    return await draftOutreachWithOpenAI(listing, profile, kind, fallback);
  } catch {
    return fallback;
  }
}

export function draftOutreachFallback(
  listing: Listing,
  profile: SearchProfile,
  kind: OutreachKind,
): OutreachDraft {
  const greeting = `Hi ${listing.contactName ?? "there"}`;
  const listingLabel = describeListing(listing);
  const addressClause = listing.address ? ` at ${listing.address}` : "";
  const feeQuestion = getFeeQuestion(listing);
  const openQuestion = listing.openQuestions[0];
  const tourWindows = getTourWindowText(profile);
  const readinessLine = getReadinessLine(listing, profile);
  const subject = getFallbackSubject(listing, kind);
  const bodyByKind: Record<OutreachKind, string> = {
    first_contact: [
      `${greeting}, I am interested in ${listingLabel}${addressClause}.`,
      feeQuestion,
      `Could you also let me know the earliest available tour time${tourWindows ? ` ${tourWindows}` : ""}?`,
      readinessLine,
    ].join(" "),
    follow_up: [
      `${greeting}, following up on ${listingLabel}${addressClause}.`,
      `I am still interested and can move quickly if it is available.`,
      openQuestion ? `Could you confirm: ${trimQuestion(openQuestion)}` : null,
      tourWindows ? `I can tour ${tourWindows}.` : "Could you share the next available tour windows?",
    ]
      .filter(Boolean)
      .join(" "),
    fee_clarification: [
      `${greeting}, before I decide on next steps for ${listingLabel}, could you confirm the total move-in cash in writing?`,
      feeQuestion,
      `Please include application fees, security deposit, broker fee responsibility, and any move-in or amenity fees.`,
    ].join(" "),
    tour_request: [
      `${greeting}, I would like to tour ${listingLabel}${addressClause}.`,
      tourWindows ? `I can make ${tourWindows}.` : "Could you send the next available showing times?",
      openQuestion ? `One thing I want to verify during the tour: ${trimQuestion(openQuestion)}` : null,
      feeQuestion,
    ]
      .filter(Boolean)
      .join(" "),
    post_tour_interest: [
      `${greeting}, thank you for showing me ${listingLabel}.`,
      `I am interested in moving forward if the remaining details check out.`,
      feeQuestion,
      openQuestion ? `Could you also confirm: ${trimQuestion(openQuestion)}` : null,
      `Please let me know the application timeline and what you need from me next.`,
    ]
      .filter(Boolean)
      .join(" "),
  };

  return {
    id: `draft-${listing.id}-${kind}`,
    listingId: listing.id,
    kind,
    subject,
    body: bodyByKind[kind],
    approved: false,
    sentAt: null,
    createdAt: listing.updatedAt,
    generationMode: "fallback",
    safetyNote: "Draft only. Stoop never sends messages automatically.",
  };
}

export function getRecommendedOutreachKind(listing: Listing): OutreachKind {
  if (listing.status === "contacted" || listing.status === "applied") {
    return "follow_up";
  }

  if (listing.status === "tour_scheduled" && hasFeeUncertainty(listing)) {
    return "fee_clarification";
  }

  if (listing.status === "tour_scheduled") {
    return "tour_request";
  }

  if (listing.status === "toured") {
    return "post_tour_interest";
  }

  if (hasFeeUncertainty(listing)) {
    return "fee_clarification";
  }

  return "first_contact";
}

export function parseOutreachKind(value: unknown): OutreachKind | null {
  return typeof value === "string" && outreachKinds.includes(value as OutreachKind)
    ? (value as OutreachKind)
    : null;
}

async function draftOutreachWithOpenAI(
  listing: Listing,
  profile: SearchProfile,
  kind: OutreachKind,
  fallback: OutreachDraft,
): Promise<OutreachDraft> {
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
      model: process.env.OPENAI_OUTREACH_MODEL ?? process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
      instructions:
        "Draft concise NYC apartment broker outreach. Never claim that a message has been sent. Do not browse, automate sending, invent facts, or request sensitive documents. Return only JSON matching the schema.",
      input: JSON.stringify({
        kind,
        profile: {
          name: profile.name,
          targetMoveInDate: profile.targetMoveInDate,
          maxRentMonthly: profile.maxRentMonthly,
          preferredNeighborhoods: profile.preferredNeighborhoods,
          mustHaves: profile.mustHaves,
        },
        listing: {
          title: listing.title,
          address: listing.address,
          unit: listing.unit,
          neighborhood: listing.neighborhood,
          borough: listing.borough,
          rentMonthly: listing.rentMonthly,
          availableDate: listing.availableDate,
          contactName: listing.contactName,
          amenities: listing.amenities,
          fees: listing.fees,
          redFlags: listing.redFlags,
          openQuestions: listing.openQuestions,
          status: listing.status,
        },
        fallbackDraft: {
          subject: fallback.subject,
          body: fallback.body,
        },
      }),
      max_output_tokens: 700,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "outreach_draft",
          strict: true,
          schema: outreachDraftSchema,
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
  const openAiBody = readString(record.body);

  if (!openAiBody) {
    return fallback;
  }

  return {
    ...fallback,
    subject: readString(record.subject) ?? fallback.subject,
    body: openAiBody,
    generationMode: "openai",
  };
}

function getFallbackSubject(listing: Listing, kind: OutreachKind) {
  const place = listing.address ?? listing.title;
  const subjectByKind: Record<OutreachKind, string> = {
    first_contact: `Question about ${place}`,
    follow_up: `Following up on ${place}`,
    fee_clarification: `Fee confirmation for ${place}`,
    tour_request: `Tour request for ${place}`,
    post_tour_interest: `Next steps for ${place}`,
  };

  return subjectByKind[kind];
}

function describeListing(listing: Listing) {
  const bedLabel = listing.bedrooms === 0
    ? "the studio"
    : listing.bedrooms !== null
      ? `the ${formatNumber(listing.bedrooms)}BR`
      : "the apartment";
  const neighborhood = listing.neighborhood ? ` in ${listing.neighborhood}` : "";

  return `${bedLabel}${neighborhood}`;
}

function getFeeQuestion(listing: Listing) {
  if (!listing.fees.length) {
    return "Could you confirm all fees due before lease signing?";
  }

  if (hasFeeUncertainty(listing)) {
    return "Could you confirm whether any broker fee is tenant-paid and what the total move-in cash would be?";
  }

  return `I saw ${listing.fees.slice(0, 2).join(" and ")}; could you confirm that in writing?`;
}

function getTourWindowText(profile: SearchProfile) {
  if (profile.targetMoveInDate) {
    return "today after work or tomorrow morning";
  }

  return "today or tomorrow";
}

function getReadinessLine(listing: Listing, profile: SearchProfile) {
  const rent = listing.netEffectiveRent ?? listing.rentMonthly;

  if (rent !== null && profile.maxRentMonthly !== null && rent <= profile.maxRentMonthly) {
    return "I have application materials ready if the fit is right.";
  }

  return "I can move quickly once the rent and fees are clear.";
}

function hasFeeUncertainty(listing: Listing) {
  return listing.fees.concat(listing.redFlags, listing.openQuestions).some((item) =>
    /\b(?:fee|broker|move-in cash|move in cash|unclear|unknown|unresolved|tbd|confirm)\b/i.test(item),
  );
}

function trimQuestion(value: string) {
  return value.replace(/\?+$/, "").trim() + "?";
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0$/, "");
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
