import "../src/config/env";
import fs from "node:fs";
import { nextActionForListing } from "../src/core/ranking";
import { intakeListings, type IntakeInput } from "../src/discovery/intake";

type ParsedArgs = {
  help: boolean;
  notify: boolean;
  sourceName?: string;
  inputs: IntakeInput[];
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const stdin = readStdinIfAvailable();

  if (stdin.trim()) {
    args.inputs.push({ kind: "text", value: stdin, sourceName: args.sourceName });
  }

  if (args.help || !args.inputs.length) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const result = await intakeListings({
    inputs: args.inputs,
    notify: args.notify,
  });

  for (const warning of result.warnings) {
    console.log(`WARN ${warning}`);
  }

  if (result.errors.length) {
    console.log("");
    console.log("Errors:");
    for (const error of result.errors) {
      console.log(`- ${error}`);
    }
  }

  console.log("");
  console.log(`Intake saved ${result.listingsSaved.length} listing${result.listingsSaved.length === 1 ? "" : "s"}.`);
  console.log(`Documents: ${result.documentsSeen}; duplicates: ${result.duplicateDocuments}; URL-only: ${result.urlOnlyListings}`);

  if (args.notify) {
    console.log(`Notifications sent: ${result.notificationsSent}; failed: ${result.notificationsFailed}`);
  }

  if (!result.listingsSaved.length) {
    process.exit(result.errors.length ? 1 : 0);
  }

  console.log("");
  for (const listing of result.listingsSaved) {
    console.log(`${listing.score}/100 ${price(listing.rent)} ${listing.title}`);
    console.log(`    ${[listing.neighborhood, listing.borough, listing.status].filter(Boolean).join(" | ")}`);
    if (listing.sourceUrl) {
      console.log(`    ${listing.sourceUrl}`);
    }
    console.log(`    ${listing.scoreExplanation}`);
    console.log(`    Next: ${nextActionForListing(listing)}`);
    console.log(`    Draft: npm run listing:draft -- ${listing.id}`);
    console.log("");
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const parsed: ParsedArgs = {
    help: false,
    notify: false,
    inputs: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as string;

    if (token === "--help" || token === "-h") {
      parsed.help = true;
      continue;
    }

    if (token === "--notify") {
      parsed.notify = true;
      continue;
    }

    if (token === "--source-name") {
      parsed.sourceName = readValue(argv, index, token);
      index += 1;
      continue;
    }

    if (token === "--file" || token === "-f") {
      parsed.inputs.push({ kind: "file", value: readValue(argv, index, token), sourceName: parsed.sourceName });
      index += 1;
      continue;
    }

    if (token === "--url" || token === "-u") {
      parsed.inputs.push({ kind: "url", value: readValue(argv, index, token), sourceName: parsed.sourceName });
      index += 1;
      continue;
    }

    if (token === "--text" || token === "-t") {
      parsed.inputs.push({ kind: "text", value: readValue(argv, index, token), sourceName: parsed.sourceName });
      index += 1;
      continue;
    }

    parsed.inputs.push({ kind: "auto", value: token, sourceName: parsed.sourceName });
  }

  return parsed;
}

function readValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }

  return value;
}

function readStdinIfAvailable() {
  return process.stdin.isTTY ? "" : fs.readFileSync(0, "utf8");
}

function price(rent: number | null) {
  return rent === null ? "rent unknown" : `$${rent.toLocaleString("en-US")}`;
}

function printHelp() {
  console.log(`Usage:
  npm run intake -- https://streeteasy.com/building/...
  npm run intake -- --file listings.txt
  npm run intake -- --text "paste listing text"
  pbpaste | npm run intake

Options:
  --file, -f         Read one file. If every non-empty line is a URL, each URL is intaken separately.
  --url, -u          Intake one URL.
  --text, -t         Intake pasted listing text.
  --source-name      Override the source name.
  --notify           Send ntfy notifications for hot saved listings.

The command uses normal HTTP for URLs. If a page blocks plain access, it saves a URL-only lead rather than bypassing source controls.`);
}
