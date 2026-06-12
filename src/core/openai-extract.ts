import type { ListingDraft } from "./listings";
import { fetchWithTimeout, readPositiveIntegerEnv } from "../config/timeouts";

type ResponseOutput = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

type ListingDraftEnvelope = {
  listings: ListingDraft[];
};

export async function extractListingDraftsWithOpenAI(rawText: string): Promise<ListingDraft[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required to extract listings from unstructured source text.");
  }

  const response = await fetchWithTimeout("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-5.5",
      store: false,
      max_output_tokens: 2400,
      reasoning: { effort: "low" },
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "apartment_listing_drafts",
          strict: true,
          schema: listingDraftEnvelopeSchema,
        },
      },
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Extract apartment listing facts from the user's source text. Return one item per listing. Use null for unknown scalar fields and [] for unknown amenities. If the text contains no apartment listings, return an empty listings array. Do not browse, infer hidden facts, rank, score, recommend, or send messages.",
            },
          ],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: rawText }],
        },
      ],
    }),
  }, readPositiveIntegerEnv("NYC_APT_RADAR_OPENAI_TIMEOUT_MS", 20000));

  if (!response.ok) {
    throw new Error(`OpenAI listing extraction failed: ${response.status} ${await response.text()}`);
  }

  return parseOpenAIListingDrafts(await response.json() as ResponseOutput);
}

export function parseOpenAIListingDrafts(json: ResponseOutput): ListingDraft[] {
  const contents = json.output?.flatMap((item) => item.content ?? []) ?? [];
  const refusal = contents.find((content) => content.refusal)?.refusal;

  if (refusal) {
    throw new Error(`OpenAI refused listing extraction: ${refusal}`);
  }

  const text = contents
    .find((content) => content.type === "output_text" && content.text)
    ?.text;

  if (!text) {
    throw new Error("OpenAI response did not include structured text output.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("OpenAI structured output was not valid JSON.");
  }

  return validateListingDraftEnvelope(parsed).listings;
}

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] };
const stringFields = [
  "id",
  "source",
  "sourceUrl",
  "title",
  "address",
  "neighborhood",
  "borough",
  "availableDate",
  "description",
  "firstSeenAt",
  "lastSeenAt",
  "contactName",
  "appointmentAt",
] as const;
const numberFields = ["rent", "bedrooms", "bathrooms", "latitude", "longitude"] as const;
const petsValues = new Set(["cats_allowed", "dogs_allowed", "cats_and_dogs_allowed", "no_pets", "unknown"]);
const feeValues = new Set(["no_fee", "broker_fee", "unknown"]);
const statusValues = new Set(["new", "interested", "contacted", "scheduled", "rejected", "viewed", "applied"]);

function validateListingDraftEnvelope(value: unknown): ListingDraftEnvelope {
  if (!isRecord(value) || !Array.isArray(value.listings)) {
    throw new Error("OpenAI structured output must be an object with a listings array.");
  }

  return {
    listings: value.listings.map(validateListingDraft),
  };
}

function validateListingDraft(value: unknown): ListingDraft {
  if (!isRecord(value)) {
    throw new Error("OpenAI structured listing output must be an object.");
  }

  for (const field of stringFields) {
    assertNullableType(value, field, "string");
  }

  for (const field of numberFields) {
    assertNullableType(value, field, "number");
  }

  if (!Array.isArray(value.amenities) || value.amenities.some((item) => typeof item !== "string")) {
    throw new Error("OpenAI structured output field amenities must be an array of strings.");
  }

  assertEnum(value, "pets", petsValues);
  assertEnum(value, "feeStatus", feeValues);
  assertEnum(value, "status", statusValues);

  return value as ListingDraft;
}

function assertNullableType(value: Record<string, unknown>, field: string, typeName: "string" | "number") {
  if (!(field in value) || value[field] === null) {
    return;
  }

  if (typeof value[field] !== typeName) {
    throw new Error(`OpenAI structured output field ${field} must be ${typeName} or null.`);
  }
}

function assertEnum(value: Record<string, unknown>, field: string, allowed: Set<string>) {
  if (!(field in value) || value[field] === null) {
    return;
  }

  if (typeof value[field] !== "string" || !allowed.has(value[field])) {
    throw new Error(`OpenAI structured output field ${field} has an unsupported value.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const listingDraftSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    id: nullableString,
    source: nullableString,
    sourceUrl: nullableString,
    title: nullableString,
    address: nullableString,
    neighborhood: nullableString,
    borough: nullableString,
    rent: nullableNumber,
    bedrooms: nullableNumber,
    bathrooms: nullableNumber,
    availableDate: nullableString,
    description: nullableString,
    amenities: {
      type: "array",
      items: { type: "string" },
    },
    pets: {
      anyOf: [
        { enum: ["cats_allowed", "dogs_allowed", "cats_and_dogs_allowed", "no_pets", "unknown"] },
        { type: "null" },
      ],
    },
    feeStatus: {
      anyOf: [
        { enum: ["no_fee", "broker_fee", "unknown"] },
        { type: "null" },
      ],
    },
    latitude: nullableNumber,
    longitude: nullableNumber,
    status: {
      anyOf: [
        { enum: ["new", "interested", "contacted", "scheduled", "rejected", "viewed", "applied"] },
        { type: "null" },
      ],
    },
    firstSeenAt: nullableString,
    lastSeenAt: nullableString,
    contactName: nullableString,
    appointmentAt: nullableString,
  },
  required: [
    "id",
    "source",
    "sourceUrl",
    "title",
    "address",
    "neighborhood",
    "borough",
    "rent",
    "bedrooms",
    "bathrooms",
    "availableDate",
    "description",
    "amenities",
    "pets",
    "feeStatus",
    "latitude",
    "longitude",
    "status",
    "firstSeenAt",
    "lastSeenAt",
    "contactName",
    "appointmentAt",
  ],
};

const listingDraftEnvelopeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    listings: {
      type: "array",
      items: listingDraftSchema,
    },
  },
  required: ["listings"],
};
