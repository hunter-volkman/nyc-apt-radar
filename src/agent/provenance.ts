import type { AgentToolResult } from "./tools";

export type AgentEvidenceLedger = {
  observedListingIds: Set<string>;
  inspectedListingIds: Set<string>;
};

export function createAgentEvidenceLedger(): AgentEvidenceLedger {
  return {
    observedListingIds: new Set(),
    inspectedListingIds: new Set(),
  };
}

export function updateAgentEvidenceLedger(
  toolName: string | null | undefined,
  result: AgentToolResult,
  ledger: AgentEvidenceLedger,
) {
  if (!toolName || !result.ok || !isRecord(result.data)) {
    return;
  }

  if (toolName === "get_radar_state") {
    addListingIds(ledger.observedListingIds, result.data.topListings);
    return;
  }

  if (toolName === "run_discovery_pass") {
    addListingIds(ledger.observedListingIds, result.data.listingsSaved);
    return;
  }

  if (toolName === "inspect_listing") {
    const listingId = listingIdFromRecord(result.data.listing);
    if (listingId) {
      ledger.observedListingIds.add(listingId);
      ledger.inspectedListingIds.add(listingId);
    }
    return;
  }

  if (toolName === "draft_outreach") {
    const listingId = stringField(result.data.listingId);
    if (listingId) {
      ledger.observedListingIds.add(listingId);
    }
    return;
  }

  if (toolName === "inspect_recent_failures") {
    addNotificationListingIds(ledger.observedListingIds, result.data.notifications);
  }
}

export function recommendationProvenanceViolation(
  args: Record<string, unknown>,
  ledger: AgentEvidenceLedger,
) {
  const listingId = stringField(args.listingId);
  if (!listingId) {
    return null;
  }

  if (!ledger.observedListingIds.has(listingId)) {
    return `Cannot record listing recommendation for ${listingId} until that listing has been observed in this run.`;
  }

  const actionType = stringField(args.actionType);
  if (requiresListingInspection(actionType) && !ledger.inspectedListingIds.has(listingId)) {
    return `${actionType} recommendations require inspect_listing for ${listingId} earlier in the same run.`;
  }

  return null;
}

export function toolProvenanceViolation(
  toolName: string,
  args: Record<string, unknown>,
  ledger: AgentEvidenceLedger,
) {
  if (toolName === "request_operator_review") {
    const listingId = stringField(args.listingId);
    if (listingId && !ledger.observedListingIds.has(listingId)) {
      return `Cannot request operator review for ${listingId} until that listing has been observed in this run.`;
    }

    return null;
  }

  if (toolName === "draft_outreach") {
    const listingId = stringField(args.listingId);
    if (!listingId || ledger.inspectedListingIds.has(listingId)) {
      return null;
    }

    return `draft_outreach requires inspect_listing for ${listingId} earlier in the same run.`;
  }

  return null;
}

function requiresListingInspection(actionType: string | null) {
  return actionType === "draft_outreach" || actionType === "status_update";
}

function addListingIds(target: Set<string>, value: unknown) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    const id = listingIdFromRecord(item);
    if (id) {
      target.add(id);
    }
  }
}

function addNotificationListingIds(target: Set<string>, value: unknown) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const listingId = stringField(item.listingId);
    if (listingId) {
      target.add(listingId);
    }
  }
}

function listingIdFromRecord(value: unknown) {
  return isRecord(value) ? stringField(value.id) : null;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
