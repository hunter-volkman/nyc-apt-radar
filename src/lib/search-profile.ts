import type { SearchProfile } from "@/lib/types";

export const searchProfile: SearchProfile = {
  id: "household-nyc-2026",
  name: "Household NYC June search",
  targetMoveInDate: "2026-06-24",
  maxRentMonthly: 3800,
  budgetToleranceMonthly: 150,
  preferredNeighborhoods: ["Fort Greene", "Clinton Hill", "Park Slope", "Prospect Heights"],
  acceptableNeighborhoods: ["Upper West Side", "Astoria", "Crown Heights", "South Slope"],
  hardNoNeighborhoods: ["Far Rockaway", "East New York", "Brownsville"],
  commuteDestinations: [
    {
      label: "Midtown office",
      address: "Bryant Park, New York, NY",
      maxMinutes: 38,
    },
    {
      label: "Downtown meetings",
      address: "Union Square, New York, NY",
      maxMinutes: 32,
    },
  ],
  bedroomsMin: 1,
  bedroomsMax: 2,
  mustHaves: ["real bedroom", "laundry access", "solid light", "reasonable commute"],
  niceToHaves: ["dishwasher", "outdoor space", "prewar details", "bike storage"],
  hardNos: ["basement apartment", "broker pressure tactics", "unresolved tenant-paid fee"],
};
