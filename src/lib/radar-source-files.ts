import fs from "node:fs";
import path from "node:path";
import {
  getSourceDirectory,
  importSourceEvent,
  type SourceEventImportResult,
} from "@/lib/radar";

export type SourceDirectoryImportResult = {
  sourceDirectory: string;
  filesSeen: number;
  eventsImported: number;
  duplicatesSkipped: number;
  results: SourceEventImportResult[];
};

export function importSourceEventsFromDirectory(directory = getSourceDirectory()): SourceDirectoryImportResult {
  fs.mkdirSync(directory, { recursive: true });

  const files = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:txt|eml)$/i.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort((left, right) => left.localeCompare(right));
  const results = files.map((filePath) => importSourceEventFromFile(filePath));
  const eventsImported = results.filter((result) => !result.wasDuplicate).length;

  return {
    sourceDirectory: directory,
    filesSeen: files.length,
    eventsImported,
    duplicatesSkipped: results.length - eventsImported,
    results,
  };
}

export function importSourceEventFromFile(filePath: string): SourceEventImportResult {
  const absolutePath = path.resolve(filePath);
  const rawText = fs.readFileSync(absolutePath, "utf8");

  return importSourceEvent({
    rawText,
    sourceFilePath: absolutePath,
  });
}
