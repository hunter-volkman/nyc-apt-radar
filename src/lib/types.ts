export const listingStatuses = [
  "new",
  "contacted",
  "tour_scheduled",
  "toured",
  "applied",
  "dead",
  "leased",
] as const;

export type ListingStatus = (typeof listingStatuses)[number];

export const statusLabels: Record<ListingStatus, string> = {
  new: "New",
  contacted: "Contacted",
  tour_scheduled: "Tour Scheduled",
  toured: "Toured",
  applied: "Applied",
  dead: "Dead",
  leased: "Leased",
};

export type Confidence = "high" | "medium" | "low";

export type SearchProfile = {
  id: string;
  name: string;
  targetMoveInDate: string | null;
  maxRentMonthly: number | null;
  budgetToleranceMonthly: number | null;
  preferredNeighborhoods: string[];
  acceptableNeighborhoods: string[];
  hardNoNeighborhoods: string[];
  commuteDestinations: Array<{
    label: string;
    address: string;
    maxMinutes: number;
  }>;
  bedroomsMin: number | null;
  bedroomsMax: number | null;
  mustHaves: string[];
  niceToHaves: string[];
  hardNos: string[];
};

export type Listing = {
  id: string;
  sourceName: string | null;
  sourceUrl: string | null;
  rawText: string | null;
  title: string;
  address: string | null;
  unit: string | null;
  neighborhood: string | null;
  borough: string | null;
  rentMonthly: number | null;
  netEffectiveRent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFeet: number | null;
  availableDate: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: ListingStatus;
  amenities: string[];
  fees: string[];
  redFlags: string[];
  openQuestions: string[];
  personalNotes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListingEvaluation = {
  id: string;
  listingId: string;
  eligible: boolean;
  totalScore: number;
  scoreBreakdown: {
    location: number;
    price: number;
    apartmentFit: number;
    moveInFit: number;
    risk: number;
    responsiveness: number;
    subjectivePull: number;
  };
  hardFilters: string[];
  summary: string;
  strengths: string[];
  risks: string[];
  openQuestions: string[];
  confidence: Confidence;
  evaluatedAt: string;
};

export type OutreachKind =
  | "first_contact"
  | "follow_up"
  | "fee_clarification"
  | "tour_request"
  | "post_tour_interest";

export type OutreachMessage = {
  id: string;
  listingId: string;
  kind: OutreachKind;
  body: string;
  approved: boolean;
  sentAt: string | null;
  createdAt: string;
};

export type TourVerdict = "unknown" | "kill" | "maybe" | "apply";

export type Tour = {
  id: string;
  listingId: string;
  startsAt: string;
  endsAt: string | null;
  notes: string | null;
  verdict: TourVerdict;
  checklist: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
};

export type DailyBrief = {
  generatedAt: string;
  bestCandidates: string[];
  followUps: string[];
  upcomingTours: string[];
  deadOrRiskyListings: string[];
  applicationReadinessGaps: string[];
  recommendedNextActions: string[];
};

export type ParserMode = "openai" | "fallback";

export type ParseListingInput = {
  listingText?: string | null;
  brokerMessage?: string | null;
  sourceUrl?: string | null;
  manualNotes?: string | null;
  referenceDate?: string | null;
};

export type ParsedListing = {
  listing: Omit<Listing, "id" | "status" | "createdAt" | "updatedAt">;
  confidence: Confidence;
  fees: string[];
  redFlags: string[];
  openQuestions: string[];
  parserMode: ParserMode;
};

export type RiskLevel = "low" | "medium" | "high";

export type DemoListing = Listing & {
  nextAction: string;
  mainRisk: string;
  moveInFit: string;
  riskLevel: RiskLevel;
  updatedAtLabel: string;
};

export type ApplicationReadinessItem = {
  id: string;
  label: string;
  ready: boolean;
  blocking: boolean;
};
