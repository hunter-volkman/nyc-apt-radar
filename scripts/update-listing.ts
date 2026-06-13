import "../src/config/env";
import { isFeeStatus, isListingStatus, isPetsPolicy } from "../src/core/listings";
import { loadPreferenceProfile } from "../src/core/preferences";
import { updateListingFacts, type ListingFactUpdate } from "../src/storage/listings";

const [id, ...rest] = process.argv.slice(2);
const args = readFlags(rest);

if (args.help || !id || !Object.keys(args).length) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const update: ListingFactUpdate = {
  sourceUrl: args["source-url"],
  title: args.title,
  address: args.address,
  neighborhood: args.neighborhood,
  borough: args.borough,
  rent: numberArg(args.rent, "rent"),
  bedrooms: numberArg(args.bedrooms, "bedrooms"),
  bathrooms: numberArg(args.bathrooms, "bathrooms"),
  availableDate: args["available-date"],
  description: args.description,
  amenities: args.amenities === undefined ? undefined : listArg(args.amenities),
  latitude: numberArg(args.latitude, "latitude", { min: -90, max: 90 }),
  longitude: numberArg(args.longitude, "longitude", { min: -180, max: 180 }),
  contactName: args.contact,
  appointmentAt: args.appointment,
  notes: args.notes,
};

if (args.pets) {
  if (!isPetsPolicy(args.pets)) {
    fail(`Unsupported pets value: ${args.pets}`);
  }
  update.pets = args.pets;
}

if (args["fee-status"]) {
  if (!isFeeStatus(args["fee-status"])) {
    fail(`Unsupported fee-status value: ${args["fee-status"]}`);
  }
  update.feeStatus = args["fee-status"];
}

if (args.status) {
  if (!isListingStatus(args.status)) {
    fail(`Unsupported status value: ${args.status}`);
  }
  update.status = args.status;
}

const listing = updateListingFacts(id, update, loadPreferenceProfile());

console.log(`Updated ${listing.id}`);
console.log(`${listing.score}/100 - ${listing.status}`);
console.log(listing.scoreExplanation);

function readFlags(argv: string[]) {
  const flags: Record<string, string | undefined> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    flags[key] = next && !next.startsWith("--") ? next : "true";
    if (next && !next.startsWith("--")) {
      index += 1;
    }
  }

  return flags;
}

function numberArg(value: string | undefined, flagName: string, bounds?: { min: number; max: number }) {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.replace(/[$,]/g, "").trim();
  const parsed = Number(normalized);
  if (!normalized || !Number.isFinite(parsed)) {
    fail(`Invalid number for --${flagName}: ${value}`);
  }

  if (bounds && (parsed < bounds.min || parsed > bounds.max)) {
    fail(`Invalid number for --${flagName}: ${value}. Expected ${bounds.min} to ${bounds.max}.`);
  }

  return parsed;
}

function listArg(value: string | undefined) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function printHelp() {
  console.log(`Usage:
  npm run listing:update -- <listing-id> --pets cats_allowed --fee-status no_fee --notes "Saw it; bright and quiet."

Useful flags:
  --title
  --address
  --neighborhood
  --borough
  --rent
  --bedrooms
  --bathrooms
  --latitude
  --longitude
  --available-date YYYY-MM-DD
  --amenities "dishwasher,laundry"
  --pets cats_allowed|dogs_allowed|cats_and_dogs_allowed|no_pets|unknown
  --fee-status no_fee|broker_fee|unknown
  --status new|interested|contacted|scheduled|rejected|viewed|applied
  --appointment ISO_DATE_TIME
  --contact NAME
  --notes "free text from showing or broker follow-up"`);
}
