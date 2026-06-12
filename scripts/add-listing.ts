import "../src/config/env";
import { addListing } from "../src/storage/listings";
import { isFeeStatus, isListingStatus, isPetsPolicy, type ListingDraft } from "../src/core/listings";
import { loadPreferenceProfile } from "../src/core/preferences";

const args = readFlags(process.argv.slice(2));

if (args.help || !args.title) {
  printHelp();
  process.exit(args.help ? 0 : 1);
}

const draft: ListingDraft = {
  id: args.id,
  source: args.source ?? "manual",
  sourceUrl: args["source-url"],
  title: args.title,
  address: args.address,
  neighborhood: args.neighborhood,
  borough: args.borough,
  rent: numberArg(args.rent),
  bedrooms: numberArg(args.bedrooms),
  bathrooms: numberArg(args.bathrooms),
  availableDate: args["available-date"],
  description: args.description,
  amenities: listArg(args.amenities),
  pets: args.pets && isPetsPolicy(args.pets) ? args.pets : "unknown",
  feeStatus: args["fee-status"] && isFeeStatus(args["fee-status"]) ? args["fee-status"] : "unknown",
  status: args.status && isListingStatus(args.status) ? args.status : "new",
  contactName: args.contact,
  appointmentAt: args.appointment,
};

const listing = addListing(draft, loadPreferenceProfile());

console.log(`Added ${listing.id}`);
console.log(`${listing.scoreExplanation}`);

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

function numberArg(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function listArg(value: string | undefined) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function printHelp() {
  console.log(`Usage:
  npm run listing:add -- --title "56 Ainslie Street #4G" --rent 3999 --source-url "https://..." --neighborhood Williamsburg

Useful flags:
  --address
  --borough
  --bedrooms
  --bathrooms
  --available-date YYYY-MM-DD
  --amenities "dishwasher,laundry"
  --pets cats_allowed|dogs_allowed|cats_and_dogs_allowed|no_pets|unknown
  --fee-status no_fee|broker_fee|unknown
  --status new|interested|contacted|scheduled|rejected|viewed|applied
  --appointment ISO_DATE_TIME
  --contact NAME`);
}
