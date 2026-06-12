import "../src/config/env";
import fs from "node:fs";
import { loadPreferenceProfile } from "../src/core/preferences";
import { extractListingDraftsWithOpenAI } from "../src/core/openai-extract";
import { addListing } from "../src/storage/listings";

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  const args = process.argv.slice(2);
  const save = args.includes("--save");
  const textArg = args.find((arg) => arg !== "--save");
  const rawText = textArg ? readInput(textArg) : fs.readFileSync(0, "utf8");

  if (!rawText.trim()) {
    console.log("Usage: npm run listing:extract -- \"listing text\"");
    console.log("       cat listing.txt | npm run listing:extract -- --save");
    process.exit(1);
  }

  const drafts = await extractListingDraftsWithOpenAI(rawText);

  if (!drafts.length) {
    throw new Error("OpenAI did not find an apartment listing in the provided text.");
  }

  if (save) {
    const profile = loadPreferenceProfile();
    for (const draft of drafts) {
      const listing = addListing(draft, profile);
      console.log(`Saved ${listing.id}`);
      console.log(listing.scoreExplanation);
    }
  } else {
    console.log(JSON.stringify(drafts, null, 2));
  }
}

function readInput(value: string) {
  if (fs.existsSync(value) && fs.statSync(value).isFile()) {
    return fs.readFileSync(value, "utf8");
  }

  return value;
}
