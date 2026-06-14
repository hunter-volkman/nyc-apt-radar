import { generateOutreachDraft } from "../core/outreach";
import type { PreferenceProfile } from "../core/preferences";
import { nextActionForListing } from "../core/ranking";
import { estimateCommutes } from "../core/transit";
import { runDiscoveryOnce } from "../discovery/discovery-pass";
import { listSourceEvents } from "../storage/discovery";
import { getListing, listRankedListings } from "../storage/listings";
import { listNotifications } from "../storage/notifications";
import {
  getLatestAgentRunPlan,
  getLatestAgentWorkingMemory,
  getAgentOperatorReviewContinuationForRun,
  listAgentOperatorReviews,
  listAgentRecommendations,
  recordAgentOperatorReview,
  recordAgentRecommendation,
  recordAgentRunPlan,
  recordAgentWorkingMemory,
  type AgentRecommendationEvidence,
  type AgentRecommendationEvidenceKind,
  type AgentRecommendationAction,
  type AgentRecommendationPriority,
  type AgentOperatorReviewOption,
} from "../storage/agent";
import { isListingStatus, type ListingStatus } from "../core/listings";

type StopOutcome = "success" | "blocked" | "no_signal" | "budget_exhausted";

export type AgentToolContext = {
  runId: string;
  profile: PreferenceProfile;
  allowLiveNotifications: boolean;
};

export type AgentToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

export function agentToolDefinitions() {
  return [
    {
      type: "function",
      name: "get_radar_state",
      description: [
        "Inspect the current local NYC apartment radar state.",
        "Use this before deciding what to do next. Returns ranked listings, counts, notification state, and open agent recommendations.",
        "This is read-only and does not fetch websites or send notifications.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Maximum number of ranked listings to return.",
          },
        },
        required: ["intent", "limit"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "update_working_memory",
      description: [
        "Update the agent's explicit working memory for this run.",
        "Use this after important observations, before changing strategy, and before stopping when the current state has changed.",
        "This records focus, hypotheses, next actions, open questions, and confidence without changing listings or sending notifications.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          focus: {
            type: "string",
            description: "Current short focus of the run.",
          },
          hypotheses: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
            description: "Current evidence-backed hypotheses.",
          },
          nextActions: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
            description: "Likely next tool calls or operator actions.",
          },
          openQuestions: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
            description: "Important unknowns that still affect the run.",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence in the current plan, from 0 to 1.",
          },
        },
        required: ["intent", "focus", "hypotheses", "nextActions", "openQuestions", "confidence"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "set_episode_plan",
      description: [
        "Persist the run's typed episode plan: objective, success criteria, planned steps, stop conditions, risk checks, and confidence.",
        "Use this after the first useful observation and before recommendation writes or stopping.",
        "This is the agent's compact contract for what a successful episode means.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          objective: {
            type: "string",
            description: "The concrete episode objective in the current run context.",
          },
          successCriteria: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "Observable criteria that would make this run successful.",
          },
          plannedSteps: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 6,
            description: "Ordered, bounded tool or reasoning steps for this episode.",
          },
          stopConditions: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "Conditions under which the agent should stop.",
          },
          riskChecks: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "Safety, provenance, or product-boundary checks to keep active.",
          },
          confidence: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confidence that this plan is appropriate, from 0 to 1.",
          },
        },
        required: ["intent", "objective", "successCriteria", "plannedSteps", "stopConditions", "riskChecks", "confidence"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "run_discovery_pass",
      description: [
        "Run one configured StreetEasy public-search discovery pass using plain HTTP and existing deterministic extraction.",
        "This tool never uses browser automation, credentials, CAPTCHA bypassing, or model extraction.",
        "If notificationMode is send, only existing deterministic hot-score ntfy notifications may be sent, and only when the runtime allows live notifications.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          notificationMode: {
            type: "string",
            enum: ["send", "dry-run", "off"],
            description: "Use dry-run unless the operator explicitly allowed live notifications for this run.",
          },
        },
        required: ["intent", "notificationMode"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "inspect_listing",
      description: [
        "Inspect one local listing in detail, including deterministic score explanation, commute estimates, and next action.",
        "Use this before recommending status changes or outreach.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          listingId: {
            type: "string",
            description: "The exact local listing id.",
          },
        },
        required: ["intent", "listingId"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "draft_outreach",
      description: [
        "Generate a local editable outreach draft for one listing.",
        "This never sends a message and never contacts a broker. Use it only for listings worth human review.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          listingId: {
            type: "string",
            description: "The exact local listing id.",
          },
        },
        required: ["intent", "listingId"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "inspect_recent_failures",
      description: [
        "Inspect recent failed source events and failed notification attempts.",
        "Use this when the loop may be blocked by source access, extraction, or ntfy delivery.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Maximum number of failures to return.",
          },
        },
        required: ["intent", "limit"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "request_operator_review",
      description: [
        "Create a structured human-review handoff for the local operator.",
        "Use this when the loop reaches a decision that should pause for human judgment instead of being resolved autonomously.",
        "This records a question, options, recommended option, rationale, and structured evidence; it does not change listing status or send outreach.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          listingId: {
            type: ["string", "null"],
            description: "Listing id if the review is about one listing; null for run-level review.",
          },
          urgency: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          question: {
            type: "string",
            description: "The precise decision the operator should make.",
          },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: {
              type: "object",
              properties: {
                label: {
                  type: "string",
                  description: "Short option label.",
                },
                description: {
                  type: "string",
                  description: "What choosing this option means.",
                },
              },
              required: ["label", "description"],
              additionalProperties: false,
            },
          },
          recommendedOption: {
            type: "string",
            description: "One option label that the agent recommends, grounded in the supplied evidence.",
          },
          rationale: {
            type: "string",
            description: "Evidence-grounded explanation for why operator review is needed.",
          },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            description: "Structured evidence from tool outputs that supports the review request.",
            items: evidenceItemSchema(),
          },
          blocking: {
            type: "boolean",
            description: "True when the agent should stop until the operator decides.",
          },
        },
        required: ["intent", "listingId", "urgency", "question", "options", "recommendedOption", "rationale", "evidence", "blocking"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "record_recommendation",
      description: [
        "Record a local recommendation for the operator. This is the agent's safe write path.",
        "It may propose an inspection, draft, status update, search adjustment, operator review, or config change, but it does not change listing status and does not send outreach.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          listingId: {
            type: ["string", "null"],
            description: "Listing id if the recommendation is about one listing; null for run-level recommendations.",
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          actionType: {
            type: "string",
            enum: ["inspect_listing", "draft_outreach", "status_update", "search_adjustment", "operator_review", "config_change"],
          },
          title: {
            type: "string",
            description: "Short operator-facing recommendation title.",
          },
          rationale: {
            type: "string",
            description: "Evidence-grounded reason for the recommendation.",
          },
          evidence: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            description: "Structured evidence from tool outputs that supports the recommendation.",
            items: evidenceItemSchema(),
          },
          proposedStatus: {
            type: ["string", "null"],
            enum: ["new", "interested", "contacted", "scheduled", "rejected", "viewed", "applied", null],
            description: "Proposed listing status when actionType is status_update; otherwise null.",
          },
        },
        required: ["intent", "listingId", "priority", "actionType", "title", "rationale", "evidence", "proposedStatus"],
        additionalProperties: false,
      },
    },
    {
      type: "function",
      name: "stop_agent",
      description: [
        "Stop the autonomous loop with a structured decision against the episode plan.",
        "Use this when success criteria are satisfied, a blocker is found, no useful signal remains, or the iteration budget should be conserved.",
      ].join(" "),
      strict: true,
      parameters: {
        type: "object",
        properties: {
          intent: intentProperty(),
          outcome: {
            type: "string",
            enum: ["success", "blocked", "no_signal", "budget_exhausted"],
            description: "Why the episode is stopping.",
          },
          criteriaResults: {
            type: "array",
            minItems: 1,
            maxItems: 8,
            description: "Status of the episode plan success criteria or the closest observed stop criteria.",
            items: {
              type: "object",
              properties: {
                criterion: {
                  type: "string",
                  description: "The success criterion or stop criterion being judged.",
                },
                status: {
                  type: "string",
                  enum: ["satisfied", "partial", "unsatisfied", "not_applicable"],
                  description: "Whether this criterion was satisfied by the run evidence.",
                },
                evidence: {
                  type: "string",
                  description: "Short evidence-grounded explanation from tool outputs or guardrail feedback.",
                },
              },
              required: ["criterion", "status", "evidence"],
              additionalProperties: false,
            },
          },
          nextActions: {
            type: "array",
            items: { type: "string" },
            minItems: 1,
            maxItems: 5,
            description: "Concrete next actions for the operator or the next run.",
          },
          unresolvedQuestions: {
            type: "array",
            items: { type: "string" },
            maxItems: 5,
            description: "Important unknowns remaining at stop time.",
          },
          summary: {
            type: "string",
            description: "Concise final run summary grounded in tool results.",
          },
        },
        required: ["intent", "outcome", "criteriaResults", "nextActions", "unresolvedQuestions", "summary"],
        additionalProperties: false,
      },
    },
  ];
}

function intentProperty() {
  return {
    type: "string",
    description: "Why this specific tool call is the next useful step, grounded in the current objective, memory, or previous tool output.",
  };
}

function evidenceItemSchema() {
  return {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: [
          "listing",
          "score",
          "commute",
          "notification",
          "source_event",
          "failure",
          "working_memory",
          "operator_constraint",
          "model_observation",
        ],
        description: "Source category for this evidence item.",
      },
      ref: {
        type: "string",
        description: "Stable reference from a prior tool result, such as listing id, source URL, or memory revision.",
      },
      detail: {
        type: "string",
        description: "Short factual detail copied or summarized from the tool result.",
      },
    },
    required: ["kind", "ref", "detail"],
    additionalProperties: false,
  };
}

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown>,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  try {
    actionIntent(args);

    if (name === "get_radar_state") {
      return ok(radarState(context, integerArg(args.limit, 8)));
    }

    if (name === "update_working_memory") {
      const memory = recordAgentWorkingMemory({
        runId: context.runId,
        focus: stringArg(args.focus),
        hypotheses: stringListArg(args.hypotheses, 5),
        nextActions: stringListArg(args.nextActions, 5),
        openQuestions: stringListArg(args.openQuestions, 5),
        confidence: confidenceArg(args.confidence),
      });

      return ok({ memory });
    }

    if (name === "set_episode_plan") {
      const plan = recordAgentRunPlan({
        runId: context.runId,
        objective: stringArg(args.objective),
        successCriteria: requiredStringListArg(args.successCriteria, 5, "successCriteria"),
        plannedSteps: requiredStringListArg(args.plannedSteps, 6, "plannedSteps"),
        stopConditions: requiredStringListArg(args.stopConditions, 5, "stopConditions"),
        riskChecks: requiredStringListArg(args.riskChecks, 5, "riskChecks"),
        confidence: confidenceArg(args.confidence),
      });

      return ok({ plan });
    }

    if (name === "run_discovery_pass") {
      const requested = stringArg(args.notificationMode);
      const notificationMode = requested;
      if (notificationMode !== "send" && notificationMode !== "dry-run" && notificationMode !== "off") {
        return fail(`Unsupported notificationMode: ${requested}`);
      }

      const result = await runDiscoveryOnce({
        profile: context.profile,
        notificationMode,
      });

      return ok({
        notificationMode,
        searchesChecked: result.searchesChecked,
        documentsSeen: result.documentsSeen,
        duplicateDocuments: result.duplicateDocuments,
        listingsFound: result.listingsFound,
        listingsSaved: result.listingsSaved.map((listing) => listingSummary(listing)),
        notificationsSent: result.notificationsSent,
        notificationsSkipped: result.notificationsSkipped,
        notificationsFailed: result.notificationsFailed,
        errors: result.errors,
      });
    }

    if (name === "inspect_listing") {
      const listing = getListing(stringArg(args.listingId));
      if (!listing) {
        return fail("Listing not found.");
      }

      return ok({
        listing,
        commutes: estimateCommutes(listing, context.profile),
        nextAction: nextActionForListing(listing),
      });
    }

    if (name === "draft_outreach") {
      const listing = getListing(stringArg(args.listingId));
      if (!listing) {
        return fail("Listing not found.");
      }

      return ok({
        listingId: listing.id,
        draft: generateOutreachDraft(listing, context.profile),
        sent: false,
        boundary: "Draft only. The operator must review and send manually.",
      });
    }

    if (name === "inspect_recent_failures") {
      const limit = integerArg(args.limit, 10);
      const events = listSourceEvents(limit * 2)
        .filter((event) => event.status === "failed")
        .slice(0, limit)
        .map((event) => ({
          sourceId: event.sourceId,
          sourceType: event.sourceType,
          sourceRef: event.sourceRef,
          errorMessage: event.errorMessage,
          discoveredAt: event.discoveredAt,
        }));
      const notifications = listNotifications()
        .filter((notification) => notification.status === "failed")
        .slice(0, limit)
        .map((notification) => ({
          listingId: notification.listingId,
          title: notification.title,
          errorMessage: notification.errorMessage,
          createdAt: notification.createdAt,
        }));

      return ok({ sourceEvents: events, notifications });
    }

    if (name === "request_operator_review") {
      const review = recordOperatorReviewTool(args, context);
      return ok({ review });
    }

    if (name === "record_recommendation") {
      const recommendation = recordRecommendationTool(args, context);
      return ok({ recommendation });
    }

    if (name === "stop_agent") {
      const decision = stopDecisionArg(args);
      return ok({
        stopped: true,
        ...decision,
      });
    }

    return fail(`Unknown tool: ${name}`);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

function radarState(context: AgentToolContext, limit: number) {
  const listings = listRankedListings(context.profile);
  const sourceEvents = listSourceEvents(50);
  const notifications = listNotifications();
  const recommendations = listAgentRecommendations(10);
  const operatorReviews = listAgentOperatorReviews(10);
  const workingMemory = getLatestAgentWorkingMemory(context.runId);
  const episodePlan = getLatestAgentRunPlan(context.runId);
  const activeContinuation = getAgentOperatorReviewContinuationForRun(context.runId);

  return {
    profile: {
      name: context.profile.name,
      hotScore: context.profile.hotScore,
      commuteTargets: context.profile.commuteTargets.map((target) => ({
        label: target.label,
        maxMinutes: target.maxMinutes,
      })),
    },
    episodePlan,
    workingMemory,
    counts: {
      listings: listings.length,
      listingsByStatus: countBy(listings.map((listing) => listing.status)),
      sourceEventsByStatus: countBy(sourceEvents.map((event) => event.status)),
      notificationsByStatus: countBy(notifications.map((notification) => notification.status)),
      operatorReviewsByStatus: countBy(operatorReviews.map((review) => review.status)),
      openRecommendations: recommendations.filter((recommendation) => recommendation.status === "open").length,
      openOperatorReviews: operatorReviews.filter((review) => review.status === "open").length,
    },
    activeContinuation: activeContinuation ? operatorReviewSummary(activeContinuation) : null,
    topListings: listings.slice(0, limit).map((listing) => ({
      ...listingSummary(listing),
      nextAction: nextActionForListing(listing),
    })),
    openRecommendations: recommendations
      .filter((recommendation) => recommendation.status === "open")
      .map((recommendation) => ({
        id: recommendation.id,
        listingId: recommendation.listingId,
        priority: recommendation.priority,
        actionType: recommendation.actionType,
        title: recommendation.title,
        rationale: recommendation.rationale,
        evidence: recommendation.evidence,
        proposedStatus: recommendation.proposedStatus,
      })),
    recentOperatorReviews: operatorReviews.map((review) => operatorReviewSummary(review)),
    openOperatorReviews: operatorReviews
      .filter((review) => review.status === "open")
      .map((review) => operatorReviewSummary(review)),
  };
}

function recordOperatorReviewTool(args: Record<string, unknown>, context: AgentToolContext) {
  const listingId = nullableStringArg(args.listingId);
  const urgency = enumArg(args.urgency, ["low", "medium", "high", "urgent"] as const);
  const options = operatorReviewOptionsArg(args.options, 5);
  const recommendedOption = compactText(stringArg(args.recommendedOption));
  const suppliedEvidence = evidenceListArg(args.evidence, 6);

  if (!options.some((option) => option.label === recommendedOption)) {
    throw new Error("recommendedOption must match one option label.");
  }

  const listing = listingId ? getListing(listingId) : null;
  if (listingId && !listing) {
    throw new Error(`Cannot request review for unknown listing: ${listingId}`);
  }

  if (listingId && !suppliedEvidence.some((item) => item.ref.includes(listingId))) {
    throw new Error(`Listing review evidence must reference listingId: ${listingId}`);
  }

  const evidence = groundedRecommendationEvidence({
    listing,
    suppliedEvidence,
  });

  return recordAgentOperatorReview({
    runId: context.runId,
    listingId,
    urgency: urgency as AgentRecommendationPriority,
    question: compactText(stringArg(args.question)),
    options,
    recommendedOption,
    rationale: compactText(stringArg(args.rationale)),
    evidence,
    blocking: booleanArg(args.blocking, "blocking"),
  });
}

function recordRecommendationTool(args: Record<string, unknown>, context: AgentToolContext) {
  const listingId = nullableStringArg(args.listingId);
  const priority = enumArg(args.priority, ["low", "medium", "high", "urgent"] as const);
  const actionType = enumArg(args.actionType, [
    "inspect_listing",
    "draft_outreach",
    "status_update",
    "search_adjustment",
    "operator_review",
    "config_change",
  ] as const);
  const proposedStatus = nullableStringArg(args.proposedStatus);
  const suppliedEvidence = evidenceListArg(args.evidence, 6);

  const listing = listingId ? getListing(listingId) : null;
  if (listingId && !listing) {
    throw new Error(`Cannot recommend against unknown listing: ${listingId}`);
  }

  if (requiresListing(actionType) && !listingId) {
    throw new Error(`${actionType} recommendations require a listingId.`);
  }

  if (proposedStatus !== null && !isListingStatus(proposedStatus)) {
    throw new Error(`Unsupported proposedStatus: ${proposedStatus}`);
  }

  if (actionType === "status_update" && proposedStatus === null) {
    throw new Error("status_update recommendations require proposedStatus.");
  }

  if (actionType !== "status_update" && proposedStatus !== null) {
    throw new Error("proposedStatus must be null unless actionType is status_update.");
  }

  if (listingId && !suppliedEvidence.some((item) => item.ref.includes(listingId))) {
    throw new Error(`Listing recommendation evidence must reference listingId: ${listingId}`);
  }

  const evidence = groundedRecommendationEvidence({
    listing,
    suppliedEvidence,
  });

  return recordAgentRecommendation({
    runId: context.runId,
    listingId,
    priority: priority as AgentRecommendationPriority,
    actionType: actionType as AgentRecommendationAction,
    title: stringArg(args.title),
    rationale: stringArg(args.rationale),
    evidence,
    proposedStatus: proposedStatus as ListingStatus | null,
  });
}

function requiresListing(actionType: string) {
  return actionType === "inspect_listing" || actionType === "draft_outreach" || actionType === "status_update";
}

function groundedRecommendationEvidence(input: {
  listing: ReturnType<typeof getListing>;
  suppliedEvidence: AgentRecommendationEvidence[];
}) {
  const evidence: AgentRecommendationEvidence[] = [];

  if (input.listing) {
    evidence.push({
      kind: "listing",
      ref: input.listing.id,
      detail: compactText(`${input.listing.title}; status ${input.listing.status}; rent ${input.listing.rent ?? "unknown"}; score ${input.listing.score}/100.`),
    });
    evidence.push({
      kind: "score",
      ref: input.listing.id,
      detail: compactText(input.listing.scoreExplanation),
    });

    if (input.listing.sourceUrl) {
      evidence.push({
        kind: "source_event",
        ref: input.listing.sourceUrl,
        detail: compactText(`Listing source: ${input.listing.source}.`),
      });
    }
  }

  for (const item of input.suppliedEvidence) {
    if (!evidence.some((existing) => existing.kind === item.kind && existing.ref === item.ref && existing.detail === item.detail)) {
      evidence.push(item);
    }
  }

  return evidence.slice(0, 10);
}

function listingSummary(listing: {
  id: string;
  title: string;
  score: number;
  status: string;
  rent: number | null;
  neighborhood: string | null;
  source: string;
  sourceUrl: string | null;
  scoreExplanation: string;
}) {
  return {
    id: listing.id,
    title: listing.title,
    score: listing.score,
    status: listing.status,
    rent: listing.rent,
    neighborhood: listing.neighborhood,
    source: listing.source,
    sourceUrl: listing.sourceUrl,
    scoreExplanation: listing.scoreExplanation,
  };
}

function operatorReviewSummary(review: {
  id: string;
  listingId: string | null;
  urgency: string;
  question: string;
  options: AgentOperatorReviewOption[];
  recommendedOption: string;
  rationale: string;
  evidence: AgentRecommendationEvidence[];
  blocking: boolean;
  selectedOption: string | null;
  operatorNote: string | null;
  resolvedAt: string | null;
  resumeRunId: string | null;
  resumeClaimedAt: string | null;
  status: string;
}) {
  return {
    id: review.id,
    listingId: review.listingId,
    urgency: review.urgency,
    question: review.question,
    options: review.options,
    recommendedOption: review.recommendedOption,
    rationale: review.rationale,
    evidence: review.evidence,
    blocking: review.blocking,
    selectedOption: review.selectedOption,
    operatorNote: review.operatorNote,
    resolvedAt: review.resolvedAt,
    resumeRunId: review.resumeRunId,
    resumeClaimedAt: review.resumeClaimedAt,
    status: review.status,
  };
}

function ok(data: unknown): AgentToolResult {
  return { ok: true, data };
}

function fail(error: string): AgentToolResult {
  return { ok: false, error };
}

function stringArg(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Expected non-empty string argument.");
  }

  return value.trim();
}

function actionIntent(args: Record<string, unknown>) {
  const intent = stringArg(args.intent);
  if (intent.length < 8) {
    throw new Error("Expected a more specific tool intent.");
  }

  return intent;
}

function nullableStringArg(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return stringArg(value);
}

function evidenceListArg(value: unknown, maxItems: number): AgentRecommendationEvidence[] {
  if (!Array.isArray(value) || !value.length) {
    throw new Error("Expected non-empty evidence array argument.");
  }

  return value.map((item) => evidenceArg(item)).slice(0, maxItems);
}

function evidenceArg(value: unknown): AgentRecommendationEvidence {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected evidence object.");
  }

  const record = value as Record<string, unknown>;
  const kind = enumArg(record.kind, [
    "listing",
    "score",
    "commute",
    "notification",
    "source_event",
    "failure",
    "working_memory",
    "operator_constraint",
    "model_observation",
  ] as const) as AgentRecommendationEvidenceKind;

  return {
    kind,
    ref: compactText(stringArg(record.ref)),
    detail: compactText(stringArg(record.detail)),
  };
}

function operatorReviewOptionsArg(value: unknown, maxItems: number): AgentOperatorReviewOption[] {
  if (!Array.isArray(value) || value.length < 2) {
    throw new Error("Expected at least two operator review options.");
  }

  if (value.length > maxItems) {
    throw new Error(`Expected no more than ${maxItems} operator review options.`);
  }

  const options = value.map((item) => operatorReviewOptionArg(item));
  const labels = new Set(options.map((option) => option.label));
  if (labels.size !== options.length) {
    throw new Error("Operator review option labels must be unique.");
  }

  return options;
}

function operatorReviewOptionArg(value: unknown): AgentOperatorReviewOption {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected operator review option object.");
  }

  const record = value as Record<string, unknown>;
  return {
    label: compactText(stringArg(record.label)),
    description: compactText(stringArg(record.description)),
  };
}

function stopDecisionArg(args: Record<string, unknown>) {
  return {
    outcome: enumArg(args.outcome, ["success", "blocked", "no_signal", "budget_exhausted"] as const) as StopOutcome,
    criteriaResults: criteriaResultListArg(args.criteriaResults, 8),
    nextActions: requiredStringListArg(args.nextActions, 5, "nextActions"),
    unresolvedQuestions: stringListArg(args.unresolvedQuestions, 5),
    summary: stringArg(args.summary),
  };
}

function criteriaResultListArg(value: unknown, maxItems: number) {
  if (!Array.isArray(value) || !value.length) {
    throw new Error("Expected non-empty criteriaResults array argument.");
  }

  return value.map((item) => criteriaResultArg(item)).slice(0, maxItems);
}

function criteriaResultArg(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected criteria result object.");
  }

  const record = value as Record<string, unknown>;
  return {
    criterion: compactText(stringArg(record.criterion)),
    status: enumArg(record.status, ["satisfied", "partial", "unsatisfied", "not_applicable"] as const),
    evidence: compactText(stringArg(record.evidence)),
  };
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 500);
}

function integerArg(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function confidenceArg(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Expected numeric confidence argument.");
  }

  return Math.max(0, Math.min(1, parsed));
}

function booleanArg(value: unknown, name: string) {
  if (typeof value !== "boolean") {
    throw new Error(`Expected boolean ${name} argument.`);
  }

  return value;
}

function stringListArg(value: unknown, maxItems: number) {
  if (!Array.isArray(value)) {
    throw new Error("Expected string array argument.");
  }

  return value
    .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    .map((item) => item.trim())
    .slice(0, maxItems);
}

function requiredStringListArg(value: unknown, maxItems: number, name: string) {
  const items = stringListArg(value, maxItems);
  if (!items.length) {
    throw new Error(`Expected non-empty ${name} array argument.`);
  }

  return items;
}

function enumArg<const T extends readonly string[]>(value: unknown, allowed: T): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`Expected one of: ${allowed.join(", ")}`);
  }

  return value;
}

function countBy(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
