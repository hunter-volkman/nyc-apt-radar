import fs from "node:fs";
import path from "node:path";

export type PreferenceProfile = {
  name: string;
  budget: {
    targetRent: number;
    maxRent: number;
    stretchRent: number;
  };
  neighborhoods: {
    preferred: string[];
    acceptable: string[];
    avoid: string[];
  };
  commuteTargets: Array<{
    label: string;
    address: string;
    latitude: number;
    longitude: number;
    maxMinutes: number;
  }>;
  bedroomPreference: {
    min: number;
    max: number;
  };
  bathroomPreference: {
    min: number;
  };
  petRequirements: {
    cats: boolean;
    dogs: boolean;
  };
  feePreference: "no_fee" | "flexible";
  dealbreakers: string[];
  niceToHaves: string[];
  targetMoveIn: string | null;
  hotScore: number;
};

const defaultPreferencesPath = "data/preferences.json";

export const defaultPreferenceProfile: PreferenceProfile = {
  name: "Default NYC apartment search",
  budget: {
    targetRent: 3800,
    maxRent: 4000,
    stretchRent: 4100,
  },
  neighborhoods: {
    preferred: ["Williamsburg", "Chelsea", "Fort Greene", "Clinton Hill", "Prospect Heights", "Park Slope"],
    acceptable: ["Astoria", "Crown Heights", "Upper West Side", "South Slope"],
    avoid: ["Far Rockaway", "East New York", "Brownsville"],
  },
  commuteTargets: [
    {
      label: "Bryant Park",
      address: "Bryant Park, New York, NY",
      latitude: 40.7536,
      longitude: -73.9832,
      maxMinutes: 35,
    },
    {
      label: "Union Square",
      address: "Union Square, New York, NY",
      latitude: 40.7359,
      longitude: -73.9911,
      maxMinutes: 35,
    },
  ],
  bedroomPreference: {
    min: 1,
    max: 2,
  },
  bathroomPreference: {
    min: 1,
  },
  petRequirements: {
    cats: true,
    dogs: false,
  },
  feePreference: "no_fee",
  dealbreakers: [
    "basement apartment",
    "no cats",
    "cash before showing",
    "wire deposit",
    "sight unseen",
    "rent above stretch budget",
  ],
  niceToHaves: ["dishwasher", "laundry", "elevator", "natural light", "outdoor space", "near subway"],
  targetMoveIn: "2026-07-01",
  hotScore: 78,
};

type PreferenceProfileInput = Partial<{
  name: string;
  budget: Partial<PreferenceProfile["budget"]>;
  neighborhoods: Partial<PreferenceProfile["neighborhoods"]>;
  commuteTargets: PreferenceProfile["commuteTargets"];
  bedroomPreference: Partial<PreferenceProfile["bedroomPreference"]>;
  bathroomPreference: Partial<PreferenceProfile["bathroomPreference"]>;
  petRequirements: Partial<PreferenceProfile["petRequirements"]>;
  feePreference: PreferenceProfile["feePreference"];
  dealbreakers: string[];
  niceToHaves: string[];
  targetMoveIn: string | null;
  hotScore: number;
}>;

export function getPreferencesPath() {
  return process.env.NYC_APT_RADAR_PREFERENCES_PATH ?? defaultPreferencesPath;
}

export function hasPreferenceConfigFile(configPath = getPreferencesPath()) {
  return fs.existsSync(resolvePath(configPath));
}

export function loadPreferenceProfile(configPath = getPreferencesPath()) {
  const resolvedPath = resolvePath(configPath);

  if (!fs.existsSync(resolvedPath)) {
    return defaultPreferenceProfile;
  }

  const parsed = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as unknown;
  return mergePreferenceProfile(defaultPreferenceProfile, validatePreferenceProfileInput(parsed, resolvedPath));
}

export function mergePreferenceProfile(base: PreferenceProfile, input: PreferenceProfileInput): PreferenceProfile {
  return {
    ...base,
    ...defined({
      name: input.name,
      commuteTargets: input.commuteTargets,
      feePreference: input.feePreference,
      dealbreakers: input.dealbreakers,
      niceToHaves: input.niceToHaves,
      targetMoveIn: input.targetMoveIn,
      hotScore: input.hotScore,
    }),
    budget: {
      ...base.budget,
      ...defined(input.budget ?? {}),
    },
    neighborhoods: {
      preferred: input.neighborhoods?.preferred ?? base.neighborhoods.preferred,
      acceptable: input.neighborhoods?.acceptable ?? base.neighborhoods.acceptable,
      avoid: input.neighborhoods?.avoid ?? base.neighborhoods.avoid,
    },
    bedroomPreference: {
      ...base.bedroomPreference,
      ...defined(input.bedroomPreference ?? {}),
    },
    bathroomPreference: {
      ...base.bathroomPreference,
      ...defined(input.bathroomPreference ?? {}),
    },
    petRequirements: {
      ...base.petRequirements,
      ...defined(input.petRequirements ?? {}),
    },
  };
}

function validatePreferenceProfileInput(value: unknown, source: string): PreferenceProfileInput {
  if (!isRecord(value)) {
    throw new Error(`Preference config must be a JSON object: ${source}`);
  }

  assertKnownKeys(value, [
    "name",
    "budget",
    "neighborhoods",
    "commuteTargets",
    "bedroomPreference",
    "bathroomPreference",
    "petRequirements",
    "feePreference",
    "dealbreakers",
    "niceToHaves",
    "targetMoveIn",
    "hotScore",
  ], "Preference config");

  const input: PreferenceProfileInput = {};

  if (value.name !== undefined) {
    input.name = stringValue(value.name, "name");
  }

  if (value.budget !== undefined) {
    input.budget = validateBudget(value.budget);
  }

  if (value.neighborhoods !== undefined) {
    input.neighborhoods = validateNeighborhoods(value.neighborhoods);
  }

  if (value.commuteTargets !== undefined) {
    input.commuteTargets = validateCommuteTargets(value.commuteTargets);
  }

  if (value.bedroomPreference !== undefined) {
    input.bedroomPreference = validateBedroomPreference(value.bedroomPreference);
  }

  if (value.bathroomPreference !== undefined) {
    input.bathroomPreference = validateBathroomPreference(value.bathroomPreference);
  }

  if (value.petRequirements !== undefined) {
    input.petRequirements = validatePetRequirements(value.petRequirements);
  }

  if (value.feePreference !== undefined) {
    if (value.feePreference !== "no_fee" && value.feePreference !== "flexible") {
      throw new Error("feePreference must be no_fee or flexible.");
    }
    input.feePreference = value.feePreference;
  }

  if (value.dealbreakers !== undefined) {
    input.dealbreakers = stringArray(value.dealbreakers, "dealbreakers");
  }

  if (value.niceToHaves !== undefined) {
    input.niceToHaves = stringArray(value.niceToHaves, "niceToHaves");
  }

  if (value.targetMoveIn !== undefined) {
    input.targetMoveIn = targetMoveInValue(value.targetMoveIn);
  }

  if (value.hotScore !== undefined) {
    input.hotScore = integerInRange(value.hotScore, "hotScore", 0, 100);
  }

  validatePreferenceProfileBounds(mergePreferenceProfile(defaultPreferenceProfile, input));

  return input;
}

function validateBudget(value: unknown): PreferenceProfileInput["budget"] {
  const record = recordValue(value, "budget");
  assertKnownKeys(record, ["targetRent", "maxRent", "stretchRent"], "budget");

  return defined({
    targetRent: optionalPositiveInteger(record.targetRent, "budget.targetRent"),
    maxRent: optionalPositiveInteger(record.maxRent, "budget.maxRent"),
    stretchRent: optionalPositiveInteger(record.stretchRent, "budget.stretchRent"),
  });
}

function validateNeighborhoods(value: unknown): PreferenceProfileInput["neighborhoods"] {
  const record = recordValue(value, "neighborhoods");
  assertKnownKeys(record, ["preferred", "acceptable", "avoid"], "neighborhoods");

  return defined({
    preferred: record.preferred === undefined ? undefined : stringArray(record.preferred, "neighborhoods.preferred"),
    acceptable: record.acceptable === undefined ? undefined : stringArray(record.acceptable, "neighborhoods.acceptable"),
    avoid: record.avoid === undefined ? undefined : stringArray(record.avoid, "neighborhoods.avoid"),
  });
}

function validateCommuteTargets(value: unknown): PreferenceProfile["commuteTargets"] {
  if (!Array.isArray(value)) {
    throw new Error("commuteTargets must be an array.");
  }

  return value.map((target, index) => {
    const label = `commuteTargets[${index}]`;
    const record = recordValue(target, label);
    assertKnownKeys(record, ["label", "address", "latitude", "longitude", "maxMinutes"], label);

    return {
      label: stringValue(record.label, `${label}.label`),
      address: stringValue(record.address, `${label}.address`),
      latitude: numberInRange(record.latitude, `${label}.latitude`, -90, 90),
      longitude: numberInRange(record.longitude, `${label}.longitude`, -180, 180),
      maxMinutes: integerInRange(record.maxMinutes, `${label}.maxMinutes`, 1, Number.MAX_SAFE_INTEGER),
    };
  });
}

function validateBedroomPreference(value: unknown): PreferenceProfileInput["bedroomPreference"] {
  const record = recordValue(value, "bedroomPreference");
  assertKnownKeys(record, ["min", "max"], "bedroomPreference");

  return defined({
    min: optionalIntegerInRange(record.min, "bedroomPreference.min", 0, 20),
    max: optionalIntegerInRange(record.max, "bedroomPreference.max", 0, 20),
  });
}

function validateBathroomPreference(value: unknown): PreferenceProfileInput["bathroomPreference"] {
  const record = recordValue(value, "bathroomPreference");
  assertKnownKeys(record, ["min"], "bathroomPreference");

  return defined({
    min: optionalNumberInRange(record.min, "bathroomPreference.min", 0, 20),
  });
}

function validatePetRequirements(value: unknown): PreferenceProfileInput["petRequirements"] {
  const record = recordValue(value, "petRequirements");
  assertKnownKeys(record, ["cats", "dogs"], "petRequirements");

  return defined({
    cats: optionalBoolean(record.cats, "petRequirements.cats"),
    dogs: optionalBoolean(record.dogs, "petRequirements.dogs"),
  });
}

function validatePreferenceProfileBounds(profile: PreferenceProfile) {
  if (profile.budget.targetRent > profile.budget.maxRent || profile.budget.maxRent > profile.budget.stretchRent) {
    throw new Error("budget must satisfy targetRent <= maxRent <= stretchRent.");
  }

  if (profile.bedroomPreference.min > profile.bedroomPreference.max) {
    throw new Error("bedroomPreference must satisfy min <= max.");
  }
}

function recordValue(value: unknown, label: string) {
  if (!isRecord(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }

  return value;
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} must be a non-empty string.`);
  }

  return value;
}

function targetMoveInValue(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new Error("targetMoveIn must be null or a YYYY-MM-DD date.");
  }

  return value;
}

function stringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${label} must be an array of non-empty strings.`);
  }

  return value;
}

function optionalBoolean(value: unknown, label: string) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean.`);
  }

  return value;
}

function optionalPositiveInteger(value: unknown, label: string) {
  return value === undefined ? undefined : integerInRange(value, label, 1, Number.MAX_SAFE_INTEGER);
}

function optionalIntegerInRange(value: unknown, label: string, min: number, max: number) {
  return value === undefined ? undefined : integerInRange(value, label, min, max);
}

function optionalNumberInRange(value: unknown, label: string, min: number, max: number) {
  return value === undefined ? undefined : numberInRange(value, label, min, max);
}

function integerInRange(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}.`);
  }

  return value;
}

function numberInRange(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${label} must be a number from ${min} to ${max}.`);
  }

  return value;
}

function assertKnownKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const allowedKeys = new Set(allowed);
  const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));

  if (unknown.length) {
    throw new Error(`${label} has unsupported field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
  }
}

function resolvePath(configPath: string) {
  return path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);
}

function defined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
