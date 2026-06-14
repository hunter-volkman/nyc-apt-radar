import type { AgentGuardrailDecision } from "../storage/agent";
import {
  recommendationProvenanceViolation,
  toolProvenanceViolation,
  type AgentEvidenceLedger,
} from "./provenance";
import type { AgentToolResult } from "./tools";

const allowedToolNames = new Set([
  "get_radar_state",
  "update_working_memory",
  "set_episode_plan",
  "run_discovery_pass",
  "inspect_listing",
  "draft_outreach",
  "inspect_recent_failures",
  "request_operator_review",
  "record_recommendation",
  "stop_agent",
]);

export function evaluateToolCallPolicy(
  toolName: string,
  args: Record<string, unknown>,
  context: {
    allowLiveNotifications: boolean;
    evidenceLedger: AgentEvidenceLedger;
    needsMemoryBeforeOperatorWrite: boolean;
  },
) {
  if (!allowedToolNames.has(toolName)) {
    return {
      decision: "blocked" as const,
      reason: `Tool is not in the allowed tool surface: ${toolName || "unknown"}.`,
      effectiveArgs: args,
    };
  }

  if (toolName === "run_discovery_pass") {
    const requested = typeof args.notificationMode === "string" ? args.notificationMode : null;

    if (requested !== "send" && requested !== "dry-run" && requested !== "off") {
      return {
        decision: "blocked" as const,
        reason: "run_discovery_pass requires notificationMode to be send, dry-run, or off.",
        effectiveArgs: args,
      };
    }

    if (requested === "send" && !context.allowLiveNotifications) {
      return {
        decision: "rewritten" as const,
        reason: "Live ntfy delivery is disabled for this run; discovery may run only in dry-run mode.",
        effectiveArgs: {
          ...args,
          notificationMode: "dry-run",
        },
      };
    }
  }

  const toolViolation = toolProvenanceViolation(toolName, args, context.evidenceLedger);
  if (toolViolation) {
    return {
      decision: "blocked" as const,
      reason: toolViolation,
      effectiveArgs: args,
    };
  }

  if (context.needsMemoryBeforeOperatorWrite && isOperatorFacingWrite(toolName)) {
    return {
      decision: "blocked" as const,
      reason: "Update working memory after the latest observation before recording recommendations or operator-review requests.",
      effectiveArgs: args,
    };
  }

  if (toolName === "record_recommendation") {
    const recommendationViolation = recommendationProvenanceViolation(args, context.evidenceLedger);
    if (recommendationViolation) {
      return {
        decision: "blocked" as const,
        reason: recommendationViolation,
        effectiveArgs: args,
      };
    }
  }

  return {
    decision: "allowed" as const,
    reason: "Tool call is within the configured runtime policy.",
    effectiveArgs: args,
  };
}

function isOperatorFacingWrite(toolName: string) {
  return toolName === "record_recommendation" || toolName === "request_operator_review";
}

export function batchedToolCallPolicy(args: Record<string, unknown>) {
  return {
    decision: "blocked" as const,
    reason: "Only one tool action may execute per model turn; wait for the previous tool result before choosing the next action.",
    effectiveArgs: args,
  };
}

export function guardrailBlockedResult(policy: { reason: string; effectiveArgs: Record<string, unknown> }): AgentToolResult {
  return {
    ok: false,
    error: `Guardrail blocked tool call: ${policy.reason}`,
    data: {
      guardrail: {
        decision: "blocked",
        reason: policy.reason,
        effectiveArgs: policy.effectiveArgs,
      },
    },
  };
}

export function withGuardrailFeedback(
  result: AgentToolResult,
  policy: {
    decision: AgentGuardrailDecision;
    reason: string;
    effectiveArgs: Record<string, unknown>;
  },
): AgentToolResult {
  if (policy.decision === "allowed") {
    return result;
  }

  const existingData = isRecord(result.data) ? result.data : {};
  return {
    ...result,
    data: {
      ...existingData,
      guardrail: {
        decision: policy.decision,
        reason: policy.reason,
        effectiveArgs: policy.effectiveArgs,
      },
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
