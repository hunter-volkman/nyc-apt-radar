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

export type ListingView = Listing & {
  nextAction: string;
  mainRisk: string;
  moveInFit: string;
  riskLevel: RiskLevel;
  updatedAtLabel: string;
};

export const sourceEventStatuses = ["pending", "processed", "duplicate", "failed"] as const;

export type SourceEventStatus = (typeof sourceEventStatuses)[number];

export const radarClassifications = ["hot", "watch", "needs_review", "rejected"] as const;

export type RadarClassification = (typeof radarClassifications)[number];

export type SourceEvent = {
  id: string;
  sourceName: string;
  sourceUrl: string | null;
  normalizedSourceUrl: string | null;
  normalizedFingerprint: string;
  sourceFilePath: string | null;
  rawText: string;
  status: SourceEventStatus;
  duplicateOfEventId: string | null;
  listingId: string | null;
  classification: RadarClassification | null;
  classificationBlockers: string[];
  errorMessage: string | null;
  importedAt: string;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export const watchRunTypes = ["one_shot", "watch", "manual_import"] as const;

export type WatchRunType = (typeof watchRunTypes)[number];

export const watchRunStatuses = ["running", "succeeded", "failed"] as const;

export type WatchRunStatus = (typeof watchRunStatuses)[number];

export type WatchRun = {
  id: string;
  runType: WatchRunType;
  status: WatchRunStatus;
  intervalMinutes: number;
  startedAt: string;
  finishedAt: string | null;
  eventsSeen: number;
  eventsImported: number;
  eventsProcessed: number;
  listingsCreated: number;
  duplicatesFound: number;
  notificationsCreated: number;
  errorMessage: string | null;
};

export const notificationTypes = ["hot_listing", "needs_review", "watch_failure"] as const;

export type NotificationType = (typeof notificationTypes)[number];

export const notificationChannels = ["local", "ntfy"] as const;

export type NotificationChannel = (typeof notificationChannels)[number];

export const notificationStatuses = ["recorded", "sent", "failed"] as const;

export type NotificationStatus = (typeof notificationStatuses)[number];

export type Notification = {
  id: string;
  sourceEventId: string | null;
  listingId: string | null;
  type: NotificationType;
  channel: NotificationChannel;
  status: NotificationStatus;
  title: string;
  body: string;
  dedupeKey: string;
  errorMessage: string | null;
  createdAt: string;
  recordedAt: string;
};

export type ApplicationReadinessChecklistItem = {
  id: string;
  label: string;
  requiredForMostApplications: boolean;
};

export type TourChecklistItem = {
  id: string;
  label: string;
};
