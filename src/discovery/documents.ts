export type DiscoveryDocumentType = "url";

export type DiscoveryDocument = {
  sourceId: string;
  sourceType: DiscoveryDocumentType;
  sourceName: string;
  sourceRef: string;
  rawText: string;
  discoveredAt: string;
  urlOnlyLeadUrls?: string[];
};

export type DiscoveryCollectionResult = {
  documents: DiscoveryDocument[];
  errors: DiscoveryCollectionError[];
};

export type DiscoveryCollectionError = {
  sourceId: string;
  sourceType: DiscoveryDocumentType;
  sourceRef: string;
  message: string;
  discoveredAt: string;
};

export function formatDiscoveryCollectionError(error: DiscoveryCollectionError) {
  return `${error.sourceId}: ${error.message}`;
}
