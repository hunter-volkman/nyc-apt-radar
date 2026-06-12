import fs from "node:fs";
import path from "node:path";
import "../src/config/env";

const lineCount = readLineCount();
const logDirectory = path.join(process.cwd(), "data", "logs");
const logs = [
  { label: "watch.log", path: path.join(logDirectory, "watch.log") },
  { label: "watch.err.log", path: path.join(logDirectory, "watch.err.log") },
];

for (const log of logs) {
  console.log(`== ${log.label} ==`);

  if (!fs.existsSync(log.path)) {
    console.log("No log file yet.");
    console.log("");
    continue;
  }

  const lines = fs.readFileSync(log.path, "utf8").trimEnd().split("\n").filter(Boolean);
  const tail = lines.slice(-lineCount);

  if (!tail.length) {
    console.log("Log file is empty.");
  } else {
    console.log(tail.join("\n"));
  }

  console.log("");
}

function readLineCount() {
  const raw = process.argv.find((argument) => argument.startsWith("--lines="));
  const value = Number(raw?.slice("--lines=".length) ?? "80");
  return Number.isFinite(value) && value > 0 ? Math.round(value) : 80;
}
