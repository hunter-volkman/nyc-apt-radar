import "../src/config/env";
import { sendNtfyMessage } from "../src/notifications/ntfy";

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

async function main() {
  await sendNtfyMessage({
    title: "NYC Apt Radar test",
    body: "NYC Apt Radar test notification. If you see this, ntfy is configured.",
    priority: "default",
    tags: "house",
  });

  console.log("Sent ntfy test notification.");
}
