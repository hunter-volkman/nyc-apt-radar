import fs from "node:fs";
import path from "node:path";
import { fetchWithTimeout, readPositiveIntegerEnv } from "../config/timeouts";
import type { DiscoveryCollectionError, DiscoveryCollectionResult, DiscoveryDocument } from "./documents";

export type SearchProvider = "streeteasy";

export type SearchConfig = {
  id: string;
  provider: SearchProvider;
  searchUrl: string;
  sourceName?: string;
  enabled?: boolean;
  resultLimit?: number;
};

type SearchConfigFile = {
  searches?: SearchConfig[];
};

const defaultSearchesPath = "data/searches.json";
const defaultUserAgent = "nyc-apt-radar/0.1 apartment discovery agent";

export function getSearchesPath() {
  return process.env.NYC_APT_RADAR_SEARCHES_PATH ?? defaultSearchesPath;
}

export function hasSearchConfigFile(configPath = getSearchesPath()) {
  return fs.existsSync(resolvePath(configPath));
}

export function loadSearchConfigs(configPath = getSearchesPath()) {
  const resolvedPath = resolvePath(configPath);
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as SearchConfigFile;
  const searches = parsed.searches ?? [];
  for (const search of searches) {
    validateSearchConfig(search, resolvedPath);
  }

  return searches;
}

export function activeSearchConfigs(searches = loadSearchConfigs()) {
  return searches.filter((search) => search.enabled !== false);
}

export async function collectSearchDocumentsWithErrors(
  searches = activeSearchConfigs(),
): Promise<DiscoveryCollectionResult> {
  const concurrency = Math.min(readPositiveIntegerEnv("NYC_APT_RADAR_SOURCE_CONCURRENCY", 4), Math.max(1, searches.length));
  const results = await mapWithConcurrency(searches, concurrency, collectSearchWithErrors);

  return {
    documents: results.flatMap((result) => result.documents),
    errors: results.flatMap((result) => result.errors),
  };
}

export function searchSourceName(search: SearchConfig) {
  return search.sourceName ?? "StreetEasy";
}

export function safeSearchUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}${url.search ? "?..." : ""}`;
  } catch {
    return value;
  }
}

async function collectSearchWithErrors(search: SearchConfig): Promise<DiscoveryCollectionResult> {
  const documents: DiscoveryDocument[] = [];
  const errors: DiscoveryCollectionError[] = [];
  const discoveredAt = new Date().toISOString();

  try {
    const searchHtml = await fetchText(search.searchUrl);
    const listingUrls = extractListingUrls(search.provider, search.searchUrl, searchHtml)
      .slice(0, search.resultLimit ?? readPositiveIntegerEnv("NYC_APT_RADAR_SEARCH_RESULT_LIMIT", 12));

    if (!listingUrls.length) {
      return {
        documents,
        errors: [{
          sourceId: search.id,
          sourceType: "url",
          sourceRef: search.searchUrl,
          message: `No ${search.provider} listing links found in the public search results.`,
          discoveredAt,
        }],
      };
    }

    documents.push(searchPageDocument(search, searchHtml, listingUrls, discoveredAt));
  } catch (error) {
    errors.push({
      sourceId: search.id,
      sourceType: "url",
      sourceRef: search.searchUrl,
      message: errorMessage(error),
      discoveredAt,
    });
  }

  return { documents, errors };
}

function validateSearchConfig(search: SearchConfig, sourcePath: string) {
  if (!search || typeof search !== "object") {
    throw new Error(`Search config entries must be objects: ${sourcePath}`);
  }

  if (search.resultLimit !== undefined && (!Number.isInteger(search.resultLimit) || search.resultLimit <= 0)) {
    throw new Error(`Search ${search.id ?? "(unknown)"} resultLimit must be a positive integer.`);
  }

  if (search.enabled === false) {
    return;
  }

  if (!search.id || typeof search.id !== "string") {
    throw new Error(`Each active search needs a string id: ${sourcePath}`);
  }

  if (search.provider !== "streeteasy") {
    throw new Error(`Search ${search.id} provider must be streeteasy.`);
  }

  if (!isHttpsUrl(search.searchUrl)) {
    throw new Error(`Search ${search.id} needs an https searchUrl.`);
  }

  assertProviderUrl(search.provider, search.searchUrl, `Search ${search.id}`);
}

async function fetchText(url: string) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "User-Agent": defaultUserAgent,
      Accept: "text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.8",
    },
  }, readPositiveIntegerEnv("NYC_APT_RADAR_FETCH_TIMEOUT_MS", 15000));

  if (!response.ok) {
    throw new Error(`Fetch failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

function searchPageDocument(search: SearchConfig, rawText: string, listingUrls: string[], discoveredAt: string): DiscoveryDocument {
  return {
    sourceId: `${search.id}:search`,
    sourceType: "url",
    sourceName: searchSourceName(search),
    sourceRef: search.searchUrl,
    rawText: [
      `SOURCE: ${searchSourceName(search)}`,
      `SEARCH_URL: ${search.searchUrl}`,
      "EXTRACTOR_VERSION: structured-jsonld-v1",
      "DISCOVERED_URLS:",
      ...listingUrls.map((listingUrl) => `- ${listingUrl}`),
      "",
      rawText,
    ].join("\n"),
    urlOnlyLeadUrls: listingUrls,
    discoveredAt,
  };
}

export function extractListingUrls(provider: SearchProvider, searchUrl: string, rawText: string) {
  const urls = [
    ...extractHrefUrls(rawText, searchUrl),
    ...extractLiteralUrls(rawText),
  ];

  const seen = new Set<string>();
  return urls
    .map(normalizeUrl)
    .filter((url): url is string => Boolean(url))
    .filter((url) => isProviderListingUrl(provider, url))
    .filter((url) => {
      const key = canonicalUrl(url);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
}

function extractHrefUrls(rawText: string, baseUrl: string) {
  return Array.from(rawText.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi))
    .map((match) => decodeHtml(match[1] ?? ""))
    .map((href) => absoluteUrl(href, baseUrl))
    .filter((url): url is string => Boolean(url));
}

function extractLiteralUrls(rawText: string) {
  const normalized = decodeHtml(rawText)
    .replaceAll("\\u002F", "/")
    .replaceAll("\\/", "/");

  return Array.from(normalized.matchAll(/https?:\/\/(?:www\.)?streeteasy\.com\/[^\s"'<>\\]+/gi))
    .map((match) => match[0]);
}

function isProviderListingUrl(_provider: SearchProvider, rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");
    const pathname = url.pathname.toLowerCase();

    return host === "streeteasy.com"
      && pathname.includes("/building/")
      && !pathname.startsWith("/nyc/api")
      && !pathname.startsWith("/api")
      && !pathname.startsWith("/rental/")
      && !pathname.startsWith("/hdp/");
  } catch {
    return false;
  }
}

function assertProviderUrl(provider: SearchProvider, rawUrl: string, label: string) {
  const url = new URL(rawUrl);
  const host = url.hostname.replace(/^www\./, "");

  if (provider === "streeteasy" && host !== "streeteasy.com") {
    throw new Error(`${label} must use a streeteasy.com URL.`);
  }
}

function normalizeUrl(rawUrl: string | null) {
  if (!rawUrl) {
    return null;
  }

  try {
    const url = new URL(rawUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function canonicalUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.search = "";
  url.hash = "";
  return url.toString();
}

function absoluteUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function decodeHtml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function isHttpsUrl(value: string | undefined) {
  try {
    return new URL(value ?? "").protocol === "https:";
  } catch {
    return false;
  }
}

function resolvePath(value: string) {
  return path.isAbsolute(value) ? value : path.join(process.cwd(), value);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index] as T);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
