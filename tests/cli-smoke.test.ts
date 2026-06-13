import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cwd = process.cwd();
let testWorkspace = "";

beforeEach(() => {
  vi.resetModules();
  testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-cli-"));
  process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "radar.sqlite");
  process.env.NYC_APT_RADAR_PREFERENCES_PATH = path.join(testWorkspace, "preferences.json");
  process.env.NYC_APT_RADAR_SEARCHES_PATH = path.join(testWorkspace, "searches.json");
  writePreferences();
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NYC_APT_RADAR_DATABASE_PATH;
  delete process.env.NYC_APT_RADAR_PREFERENCES_PATH;
  delete process.env.NYC_APT_RADAR_SEARCHES_PATH;
});

describe("operator CLI smoke cases", () => {
  it("refuses to reset local data without --yes", () => {
    const databasePath = process.env.NYC_APT_RADAR_DATABASE_PATH!;
    const result = runTs(["scripts/reset.ts"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--yes");
    expect(fs.existsSync(databasePath)).toBe(false);
  });

  it("creates a SQLite backup before confirmed reset when --backup is provided", () => {
    seedListing();

    const result = runTs(["scripts/reset.ts", "--yes", "--backup"]);
    const backupLine = result.stdout.split(/\r?\n/).find((line) => line.startsWith("Backup: "));
    const backupPath = backupLine?.slice("Backup: ".length);

    expect(result.status).toBe(0);
    expect(backupPath).toBeTruthy();
    expect(fs.existsSync(backupPath ?? "")).toBe(true);
    expect(result.stdout).toContain("Reset local radar database.");

    if (process.platform !== "win32" && backupPath) {
      expect(fs.statSync(backupPath).mode & 0o777).toBe(0o600);
    }
  });

  it("prints listing IDs and ready follow-up commands in radar output", () => {
    seedListing();

    const output = runTsx(["scripts/radar-cli.ts"]);

    expect(output).toContain("ID: cli-listing");
    expect(output).toContain("npm run listing:status -- cli-listing interested");
    expect(output).toContain("npm run listing:draft -- cli-listing");
    expect(output).toContain("npm run listing:update -- cli-listing --notes");
  });

  it("updates listing coordinates from latitude and longitude flags", async () => {
    seedListing();

    const output = runTsx([
      "scripts/update-listing.ts",
      "cli-listing",
      "--latitude",
      "40.751",
      "--longitude",
      "-73.998",
    ]);

    const { getListing } = await import("../src/storage/listings.js");
    const listing = getListing("cli-listing");

    expect(output).toContain("Updated cli-listing");
    expect(listing?.latitude).toBeCloseTo(40.751);
    expect(listing?.longitude).toBeCloseTo(-73.998);
  });

  it("rejects invalid numeric update input", () => {
    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      "scripts/update-listing.ts",
      "cli-listing",
      "--rent",
      "not-a-number",
    ], {
      cwd,
      env: childEnv(),
      encoding: "utf8",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Invalid number for --rent");
  });
});

function seedListing() {
  const listingPath = path.join(testWorkspace, "listing.json");
  fs.writeFileSync(listingPath, JSON.stringify({
    listings: [{
      id: "cli-listing",
      source: "manual",
      sourceUrl: "https://streeteasy.com/building/example/4b",
      title: "CLI Chelsea Lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      borough: "Manhattan",
      rent: 3700,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.7502,
      longitude: -73.9970,
    }],
  }));

  runTsx(["scripts/intake.ts", "--file", listingPath]);
}

function writePreferences() {
  fs.writeFileSync(process.env.NYC_APT_RADAR_PREFERENCES_PATH!, JSON.stringify({
    name: "CLI profile",
    commuteTargets: [{
      label: "Bryant Park",
      address: "Bryant Park, New York, NY",
      latitude: 40.7536,
      longitude: -73.9832,
      maxMinutes: 35,
    }],
  }));
}

function runTsx(args: string[]) {
  return execFileSync(process.execPath, ["--import", "tsx", ...args], {
    cwd,
    env: childEnv(),
    encoding: "utf8",
  });
}

function runTs(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", ...args], {
    cwd,
    env: childEnv(),
    encoding: "utf8",
  });
}

function childEnv() {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    VITEST: "true",
    NYC_APT_RADAR_DATABASE_PATH: process.env.NYC_APT_RADAR_DATABASE_PATH!,
    NYC_APT_RADAR_PREFERENCES_PATH: process.env.NYC_APT_RADAR_PREFERENCES_PATH!,
    NYC_APT_RADAR_SEARCHES_PATH: process.env.NYC_APT_RADAR_SEARCHES_PATH!,
  };
  delete env.NYC_APT_RADAR_NTFY_TOPIC;
  return env;
}
