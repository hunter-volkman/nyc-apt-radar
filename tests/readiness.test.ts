import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let testWorkspace = "";

beforeEach(() => {
  vi.resetModules();
  testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-readiness-"));
  process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "radar.sqlite");
  process.env.NYC_APT_RADAR_PREFERENCES_PATH = path.join(testWorkspace, "preferences.json");
  process.env.NYC_APT_RADAR_SEARCHES_PATH = path.join(testWorkspace, "searches.json");
  process.env.NYC_APT_RADAR_NTFY_TOPIC = "doctor-topic";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.NYC_APT_RADAR_DATABASE_PATH;
  delete process.env.NYC_APT_RADAR_PREFERENCES_PATH;
  delete process.env.NYC_APT_RADAR_SEARCHES_PATH;
  delete process.env.NYC_APT_RADAR_NTFY_TOPIC;
  delete process.env.NYC_APT_RADAR_NTFY_BASE_URL;
});

describe("operator readiness", () => {
  it("fails when the preferences file is missing even though profile loading can default", async () => {
    fs.writeFileSync(process.env.NYC_APT_RADAR_SEARCHES_PATH!, JSON.stringify({
      searches: [{
        id: "doctor-streeteasy",
        provider: "streeteasy",
        searchUrl: "https://streeteasy.com/for-rent/nyc",
        sourceName: "StreetEasy",
      }],
    }));

    const [{ getRadarReadiness }, { defaultPreferenceProfile, loadPreferenceProfile }] = await Promise.all([
      import("../src/diagnostics/readiness.js"),
      import("../src/core/preferences.js"),
    ]);

    expect(loadPreferenceProfile(process.env.NYC_APT_RADAR_PREFERENCES_PATH!).name).toBe(defaultPreferenceProfile.name);

    const report = getRadarReadiness();
    const preferenceCheck = report.checks.find((check) => check.name === "preferences");

    expect(report.ready).toBe(false);
    expect(preferenceCheck?.status).toBe("fail");
    expect(preferenceCheck?.detail).toContain("preferences.json");
  });

  it("enforces Node.js 20 or newer", async () => {
    const { nodeReadiness } = await import("../src/diagnostics/readiness.js");

    expect(nodeReadiness("18.19.0").status).toBe("fail");
    expect(nodeReadiness("18.19.0").detail).toContain("Node.js 20 or newer");
    expect(nodeReadiness("20.0.0").status).toBe("ok");
  });

  it("fails readiness for invalid ntfy delivery config", async () => {
    fs.writeFileSync(process.env.NYC_APT_RADAR_PREFERENCES_PATH!, JSON.stringify({
      name: "Readiness profile",
      commuteTargets: [{
        label: "Bryant Park",
        address: "Bryant Park, New York, NY",
        latitude: 40.7536,
        longitude: -73.9832,
        maxMinutes: 35,
      }],
    }));
    fs.writeFileSync(process.env.NYC_APT_RADAR_SEARCHES_PATH!, JSON.stringify({
      searches: [{
        id: "doctor-streeteasy",
        provider: "streeteasy",
        searchUrl: "https://streeteasy.com/for-rent/nyc",
        sourceName: "StreetEasy",
      }],
    }));
    process.env.NYC_APT_RADAR_NTFY_BASE_URL = "http://ntfy.test";

    const { getRadarReadiness } = await import("../src/diagnostics/readiness.js");
    const report = getRadarReadiness();
    const ntfyCheck = report.checks.find((check) => check.name === "ntfy");

    expect(report.ready).toBe(false);
    expect(ntfyCheck?.status).toBe("fail");
    expect(ntfyCheck?.detail).toContain("HTTPS");
  });
});
