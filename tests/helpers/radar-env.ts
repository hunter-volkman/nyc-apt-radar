import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type RadarTestWorkspace = {
  root: string;
  databasePath: string;
  preferencesPath: string;
  searchesPath: string;
};

export type RadarEnvOverrides = Record<string, string | undefined>;

export type SearchConfigFixture = {
  id: string;
  provider: "streeteasy";
  searchUrl: string;
  sourceName?: string;
  enabled?: boolean;
  resultLimit?: number;
};

export type FetchRouteFixture = {
  url: string;
  body?: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
};

export function createRadarTestWorkspace(prefix = "nyc-apt-radar-test-"): RadarTestWorkspace {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));

  return {
    root,
    databasePath: path.join(root, "radar.sqlite"),
    preferencesPath: path.join(root, "preferences.json"),
    searchesPath: path.join(root, "searches.json"),
  };
}

export function radarTestEnv(workspace: RadarTestWorkspace, overrides: RadarEnvOverrides = {}) {
  return {
    NODE_ENV: "test",
    VITEST: "true",
    NYC_APT_RADAR_DATABASE_PATH: workspace.databasePath,
    NYC_APT_RADAR_PREFERENCES_PATH: workspace.preferencesPath,
    NYC_APT_RADAR_SEARCHES_PATH: workspace.searchesPath,
    NYC_APT_RADAR_FETCH_TIMEOUT_MS: "1000",
    ...overrides,
  };
}

export function writePreferenceConfig(workspace: RadarTestWorkspace, overrides: Record<string, unknown> = {}) {
  const config = {
    name: "Smoke test profile",
    commuteTargets: [
      {
        label: "Bryant Park",
        address: "Bryant Park, New York, NY",
        latitude: 40.7536,
        longitude: -73.9832,
        maxMinutes: 35,
      },
    ],
    ...overrides,
  };

  writeJson(workspace.preferencesPath, config);
  return workspace.preferencesPath;
}

export function writeSearchConfig(
  workspace: RadarTestWorkspace,
  searches: SearchConfigFixture[] = [defaultSearchConfig()],
) {
  writeJson(workspace.searchesPath, { searches });
  return workspace.searchesPath;
}

export function defaultSearchConfig(searchUrl = "https://streeteasy.com/for-rent/nyc"): SearchConfigFixture {
  return {
    id: "smoke-streeteasy",
    provider: "streeteasy",
    searchUrl,
    sourceName: "StreetEasy",
    resultLimit: 1,
  };
}

export function writeFetchPreload(workspace: RadarTestWorkspace, routes: FetchRouteFixture[]) {
  const preloadPath = path.join(workspace.root, "fixture-fetch.mjs");
  const serializedRoutes = JSON.stringify(routes.map((route) => [route.url, {
    body: route.body ?? "",
    status: route.status ?? 200,
    statusText: route.statusText ?? "OK",
    headers: route.headers ?? {},
  }]));

  // Subprocess mocks cross the process boundary by loading this fixture before the script runs.
  // Tests should list every expected URL here so any accidental live fetch fails deterministically.
  fs.writeFileSync(preloadPath, [
    `const routes = new Map(${serializedRoutes});`,
    "",
    "globalThis.fetch = async (input) => {",
    "  const url = String(input?.url ?? input);",
    "  const route = routes.get(url);",
    "  if (!route) {",
    "    throw new Error(`Unexpected fetch ${url}`);",
    "  }",
    "",
    "  return new Response(route.body, {",
    "    status: route.status,",
    "    statusText: route.statusText,",
    "    headers: route.headers,",
    "  });",
    "};",
    "",
  ].join("\n"));

  return preloadPath;
}

function writeJson(filePath: string, value: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
