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

export function loadPreferenceProfile(configPath = process.env.NYC_APT_RADAR_PREFERENCES_PATH ?? "data/preferences.json") {
  const resolvedPath = path.isAbsolute(configPath) ? configPath : path.join(process.cwd(), configPath);

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

  const input = value as PreferenceProfileInput;
  if (input.commuteTargets) {
    for (const target of input.commuteTargets) {
      if (
        !target
        || typeof target.label !== "string"
        || typeof target.address !== "string"
        || typeof target.latitude !== "number"
        || typeof target.longitude !== "number"
        || typeof target.maxMinutes !== "number"
      ) {
        throw new Error("Each commute target must include label, address, latitude, longitude, and maxMinutes.");
      }
    }
  }

  if (input.feePreference && input.feePreference !== "no_fee" && input.feePreference !== "flexible") {
    throw new Error("feePreference must be no_fee or flexible.");
  }

  return input;
}

function defined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
