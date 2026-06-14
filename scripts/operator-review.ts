import "../src/config/env";
import {
  answerAgentOperatorReview,
  dismissAgentOperatorReview,
  getAgentOperatorReview,
  listAgentOperatorReviews,
} from "../src/storage/agent";

main();

function main() {
  const args = process.argv.slice(2);

  if (!args.length || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(args.length ? 0 : 1);
  }

  const id = flagValue(args, "--id") ?? firstPositional(args);
  const answer = flagValue(args, "--answer");
  const note = flagValue(args, "--note");
  const dismiss = args.includes("--dismiss");

  if (!id) {
    console.error("Missing operator review id.");
    printUsage();
    process.exit(1);
  }

  if (Boolean(answer) === dismiss) {
    console.error("Provide exactly one of --answer or --dismiss.");
    printReview(id);
    process.exit(1);
  }

  try {
    const review = answer
      ? answerAgentOperatorReview({ id, selectedOption: answer, note })
      : dismissAgentOperatorReview({ id, note });

    if (!review) {
      console.error(`Operator review not found: ${id}`);
      process.exit(1);
    }

    console.log(`${review.status === "answered" ? "Answered" : "Dismissed"} operator review: ${review.id}`);
    console.log(`Question: ${review.question}`);
    if (review.selectedOption) {
      console.log(`Selected option: ${review.selectedOption}`);
    }
    if (review.operatorNote) {
      console.log(`Note: ${review.operatorNote}`);
    }
    if (review.blocking) {
      console.log("Next: npm run agent:dry-run (resumes this review)");
    } else {
      console.log("Next: npm run agent:dry-run");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    printReview(id);
    process.exit(1);
  }
}

function printReview(id: string) {
  const review = getAgentOperatorReview(id);
  if (!review) {
    const open = listAgentOperatorReviews(10).filter((item) => item.status === "open");
    if (open.length) {
      console.error("");
      console.error("Open operator reviews:");
      for (const item of open) {
        console.error(`- ${item.id}: ${item.question}`);
      }
    }
    return;
  }

  console.error("");
  console.error(`${review.urgency.toUpperCase()} ${review.status}: ${review.question}`);
  for (const option of review.options) {
    console.error(`- ${option.label}: ${option.description}`);
  }
}

function printUsage() {
  console.log("Usage:");
  console.log("  npm run agent:review -- --id <review-id> --answer \"<option label>\" [--note \"...\"]");
  console.log("  npm run agent:review -- --id <review-id> --dismiss [--note \"...\"]");
}

function flagValue(args: string[], flag: string) {
  const index = args.indexOf(flag);
  if (index < 0) {
    return null;
  }

  const value = args[index + 1];
  return value && !value.startsWith("--") ? value : null;
}

function firstPositional(args: string[]) {
  return args.find((arg, index) => {
    if (arg.startsWith("--")) {
      return false;
    }

    const previous = args[index - 1];
    return previous !== "--id" && previous !== "--answer" && previous !== "--note";
  }) ?? null;
}
