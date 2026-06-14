import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenAIResponseRequest, OpenAIResponsesClient, OpenAIResponsesConfig } from "../src/agent/openai";
import { defaultPreferenceProfile } from "../src/core/preferences";

let testWorkspace = "";

beforeEach(() => {
  vi.resetModules();
  testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "nyc-apt-radar-agent-"));
  process.env.NYC_APT_RADAR_DATABASE_PATH = path.join(testWorkspace, "radar.sqlite");
  process.env.NYC_APT_RADAR_PREFERENCES_PATH = path.join(testWorkspace, "preferences.json");
  process.env.NYC_APT_RADAR_SEARCHES_PATH = path.join(testWorkspace, "searches.json");
  process.env.NYC_APT_RADAR_FETCH_TIMEOUT_MS = "1000";
  writePreferences();
});

afterEach(async () => {
  const [
    { clearSourceEvents },
    { clearListings },
    { clearNotifications },
    { clearAgentState },
  ] = await Promise.all([
    import("../src/storage/discovery.js"),
    import("../src/storage/listings.js"),
    import("../src/storage/notifications.js"),
    import("../src/storage/agent.js"),
  ]);
  clearListings();
  clearSourceEvents();
  clearNotifications();
  clearAgentState();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_BASE_URL;
  delete process.env.NYC_APT_RADAR_DATABASE_PATH;
  delete process.env.NYC_APT_RADAR_PREFERENCES_PATH;
  delete process.env.NYC_APT_RADAR_SEARCHES_PATH;
  delete process.env.NYC_APT_RADAR_FETCH_TIMEOUT_MS;
});

describe("OpenAI-backed apartment agent loop", () => {
  it("lets the model direct tool use, records a trace, and stores safe recommendations", async () => {
    const { addListing } = await import("../src/storage/listings.js");
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const {
      getAgentContractAuditForRun,
      listAgentEvaluations,
      listAgentGuardrailEvents,
      listAgentPlaybookEntries,
      listAgentRecommendations,
      listAgentReflections,
      getAgentRunContext,
      listAgentSteps,
      listAgentWorkingMemory,
    } = await import("../src/storage/agent.js");

    addListing({
      id: "agent-hot-listing",
      source: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/agent-hot/4b",
      title: "Agent Hot Chelsea Lead",
      address: "345 W 30th St #4B",
      neighborhood: "Chelsea",
      borough: "Manhattan",
      rent: 3700,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.7502,
      longitude: -73.997,
    }, defaultPreferenceProfile);

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        const callNumber = requests.length;

        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe current ranked listings before choosing a listing-specific action.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-inspect", "inspect_listing", {
            intent: "Inspect the top hot listing before recommending outreach.",
            listingId: "agent-hot-listing",
          });
        }

        if (callNumber === 3) {
          return functionCallResponse("call-plan", "set_episode_plan", {
            intent: "Set explicit success criteria before recording operator-facing action.",
            objective: "Validate the top Chelsea listing and record the safest next operator action.",
            successCriteria: [
              "Top listing evidence has been inspected.",
              "Recommendation cites the listing and score evidence.",
            ],
            plannedSteps: [
              "Inspect the top hot listing.",
              "Persist working memory about the current judgment.",
              "Record one evidence-backed outreach recommendation.",
            ],
            stopConditions: [
              "Recommendation is recorded for the operator.",
              "Required evidence is unavailable or blocked.",
            ],
            riskChecks: [
              "Do not send outreach automatically.",
              "Do not invent missing broker contact details.",
            ],
            confidence: 0.84,
          });
        }

        if (callNumber === 4) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Externalize the evidence and next action before writing a recommendation.",
            focus: "Validate the hot Chelsea lead before recommending outreach.",
            hypotheses: ["The top listing is worth human follow-up."],
            nextActions: ["Record a draft outreach recommendation."],
            openQuestions: ["Confirm broker contact details outside the autonomous loop."],
            confidence: 0.86,
          });
        }

        if (callNumber === 5) {
          return functionCallResponse("call-rec", "record_recommendation", {
            intent: "Record the operator-facing next action now that listing evidence is inspected.",
            listingId: "agent-hot-listing",
            priority: "high",
            actionType: "draft_outreach",
            title: "Draft outreach for the Chelsea lead",
            rationale: "The listing is hot, unrejected, within budget, and has a strong commute.",
            evidence: [{
              kind: "listing",
              ref: "agent-hot-listing",
              detail: "Inspected listing scored as a hot Chelsea lead.",
            }],
            proposedStatus: null,
          });
        }

        if (callNumber === 6) {
          return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
            intent: "Stop because the high-signal recommendation is recorded.",
            summary: "Recorded one high-priority outreach recommendation for the hot Chelsea lead.",
            criteriaResults: [
              {
                criterion: "Top listing evidence has been inspected.",
                status: "satisfied",
                evidence: "inspect_listing returned details for agent-hot-listing.",
              },
              {
                criterion: "Recommendation cites the listing and score evidence.",
                status: "satisfied",
                evidence: "record_recommendation saved listing and score evidence.",
              },
            ],
            nextActions: ["Review the saved outreach recommendation."],
          }));
        }

        return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
          verdict: "strong",
          objectiveAlignment: 90,
          evidenceGrounding: 90,
          toolDiscipline: 90,
          safetyDiscipline: 90,
          operatorValue: 90,
          learningQuality: 90,
          findings: ["The run inspected the hot listing before recommending outreach."],
          nextExperiment: "Compare outreach recommendations against notification decisions.",
          reflection: {
            score: 91,
            outcome: "useful",
            summary: "The run inspected the hot listing before recommending outreach.",
            lessons: ["Inspect the top scored listing before recording outreach recommendations."],
            nextRunGuidance: "Start from radar state, then inspect any new hot listing before drafting outreach.",
          },
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 6,
    });
    const recommendations = listAgentRecommendations();
    const evaluations = listAgentEvaluations();
    const playbookEntries = listAgentPlaybookEntries();
    const reflections = listAgentReflections();
    const guardrails = listAgentGuardrailEvents(result.run.id);
    const memory = listAgentWorkingMemory(result.run.id);
    const steps = listAgentSteps(result.run.id);
    const runContext = getAgentRunContext(result.run.id);

    expect(result.mode).toBe("openai");
    expect(result.run.status).toBe("completed");
    expect(result.recommendationsRecorded).toBe(1);
    expect(result.playbookEntriesRecorded).toBe(1);
    expect(result.guardrailEvents).toHaveLength(6);
    expect(result.guardrailEvents.every((event) => event.decision === "allowed")).toBe(true);
    expect(result.episodePlan?.objective).toContain("Validate the top Chelsea listing");
    expect(result.episodePlan?.successCriteria).toHaveLength(2);
    expect(result.workingMemory?.focus).toContain("Validate the hot Chelsea lead");
    expect(result.workingMemory?.confidence).toBe(0.86);
    expect(result.contractAudit?.status).toBe("pass");
    expect(result.contractAudit?.score).toBe(100);
    expect(result.contractAudit?.checks.every((check) => check.status === "pass")).toBe(true);
    expect(result.contractAudit?.checks.find((check) => check.id === "episode_plan")?.status).toBe("pass");
    expect(result.contractAudit?.checks.find((check) => check.id === "run_context")?.status).toBe("pass");
    expect(result.contractAudit?.checks.find((check) => check.id === "recommendation_provenance")?.status).toBe("pass");
    expect(result.contractAudit?.checks.find((check) => check.id === "playbook_learning")?.status).toBe("pass");
    expect(result.evaluation?.overallScore).toBe(90);
    expect(result.evaluation?.verdict).toBe("strong");
    expect(result.evaluation?.nextExperiment).toContain("Compare outreach");
    expect(result.reflection?.score).toBe(91);
    expect(result.reflection?.nextRunGuidance).toContain("inspect any new hot listing");
    expect(result.toolCalls.map((call) => call.name)).toEqual([
      "get_radar_state",
      "inspect_listing",
      "set_episode_plan",
      "update_working_memory",
      "record_recommendation",
      "stop_agent",
    ]);
    expect(result.runContext?.id).toBe(runContext?.id);
    expect(runContext?.notificationMode).toBe("off");
    expect(runContext?.maxIterations).toBe(6);
    expect(recommendations[0]?.listingId).toBe("agent-hot-listing");
    expect(recommendations[0]?.actionType).toBe("draft_outreach");
    expect(recommendations[0]?.evidence.length).toBeGreaterThanOrEqual(3);
    expect(recommendations[0]?.evidence.some((item) => item.kind === "score" && item.ref === "agent-hot-listing")).toBe(true);
    expect(evaluations[0]?.runId).toBe(result.run.id);
    expect(evaluations[0]?.overallScore).toBe(90);
    expect(evaluations[0]?.findings[0]).toContain("inspected the hot listing");
    expect(playbookEntries[0]?.sourceRunId).toBe(result.run.id);
    expect(playbookEntries[0]?.instruction).toContain("Start by observing radar state");
    expect(getAgentContractAuditForRun(result.run.id)?.status).toBe("pass");
    expect(reflections[0]?.runId).toBe(result.run.id);
    expect(reflections[0]?.lessons[0]).toContain("Inspect the top scored listing");
    expect(guardrails).toHaveLength(6);
    expect(guardrails[0]?.decision).toBe("allowed");
    expect(memory[0]?.focus).toContain("Validate the hot Chelsea lead");
    expect(memory[0]?.revision).toBe(1);
    expect(steps.some((step) => step.kind === "model_response")).toBe(true);
    expect(steps.some((step) => step.kind === "tool_call" && step.toolName === "set_episode_plan")).toBe(true);
    expect(steps.some((step) => step.kind === "tool_call" && step.toolName === "inspect_listing")).toBe(true);
    expect(steps.some((step) => step.kind === "model_response" && step.inputJson.includes("episode_evaluation"))).toBe(true);
    expect(requests[0]?.tool_choice).toBe("required");
    expect(requests[0]?.store).toBe(false);
    expect(requests[0]?.tools).toHaveLength(10);
    expect(requests[6]?.tools).toHaveLength(1);
    expect(requests[6]?.tool_choice).toBe("required");
    expect(requests[6]?.metadata?.phase).toBe("episode_evaluation");
  });

  it("does not replay non-persisted reasoning items in stateless Responses calls", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        const callNumber = requests.length;

        if (callNumber === 1) {
          return reasoningFunctionCallResponse("call-state", "get_radar_state", {
            intent: "Observe current local radar state before choosing the next action.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
            intent: "Stop after verifying stateless replay omits reasoning items.",
            summary: "Reasoning item replay was omitted.",
            criteriaResults: [{
              criterion: "Stateless replay remains valid.",
              status: "satisfied",
              evidence: "The next request did not include the non-persisted reasoning item.",
            }],
            nextActions: ["Keep replay limited to function-call continuity items."],
          }));
        }

        return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
          verdict: "useful",
          objectiveAlignment: 80,
          evidenceGrounding: 80,
          toolDiscipline: 80,
          safetyDiscipline: 100,
          operatorValue: 60,
          learningQuality: 80,
          findings: ["The run avoided replaying non-persisted reasoning items."],
          nextExperiment: "Keep stateless replay limited to necessary tool-call state.",
          reflection: {
            score: 80,
            outcome: "useful",
            summary: "The run avoided replaying non-persisted reasoning items.",
            lessons: ["Do not replay reasoning items when Responses API store is false."],
            nextRunGuidance: "Replay only function-call continuity items in stateless runs.",
          },
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 2,
    });
    const replayInput = JSON.stringify(requests[1]?.input);

    expect(result.run.status).toBe("completed");
    expect(replayInput).toContain("function_call");
    expect(replayInput).toContain("function_call_output");
    expect(replayInput).not.toContain("rs-non-persisted-reasoning");
    expect(requests.every((request) => request.store === false)).toBe(true);
  });

  it("passes the contract when it deliberately avoids duplicating an open recommendation", async () => {
    const { addListing } = await import("../src/storage/listings.js");
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const {
      finishAgentRun,
      getAgentContractAuditForRun,
      listAgentRecommendations,
      recordAgentRecommendation,
      startAgentRun,
    } = await import("../src/storage/agent.js");

    addListing({
      id: "covered-listing",
      source: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/covered/5b",
      title: "Covered Nolita Lead",
      address: "294 Broome St #5B",
      neighborhood: "Nolita",
      borough: "Manhattan",
      rent: 3600,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.7205,
      longitude: -73.994,
    }, defaultPreferenceProfile);

    const priorRun = startAgentRun({
      objective: "Record a prior covered recommendation.",
      mode: "openai",
      model: "gpt-5.5",
    });
    recordAgentRecommendation({
      runId: priorRun.id,
      listingId: "covered-listing",
      priority: "high",
      actionType: "draft_outreach",
      title: "Draft outreach for covered listing",
      rationale: "The listing already has an open, evidence-backed next action.",
      evidence: [{
        kind: "listing",
        ref: "covered-listing",
        detail: "Prior run identified the listing as worth outreach.",
      }],
      proposedStatus: null,
    });
    finishAgentRun(priorRun.id, {
      status: "completed",
      iterations: 1,
      summary: "Prior run recorded an open recommendation for the covered listing.",
    });

    let callNumber = 0;
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "strong",
            objectiveAlignment: 92,
            evidenceGrounding: 90,
            toolDiscipline: 92,
            safetyDiscipline: 100,
            operatorValue: 88,
            learningQuality: 86,
            findings: ["The run conserved operator attention by avoiding a duplicate recommendation."],
            nextExperiment: "Prefer no-op stops when open recommendations already cover the current decision set.",
            reflection: {
              score: 90,
              outcome: "useful",
              summary: "The run avoided duplicating an existing open recommendation.",
              lessons: ["Do not create a fresh recommendation when current open recommendations already cover the next action."],
              nextRunGuidance: "Use radar state to check open recommendations before writing another operator artifact.",
            },
          }));
        }

        callNumber += 1;
        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe current ranked listings and open recommendations before choosing whether to write.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-plan", "set_episode_plan", {
            intent: "Plan a no-duplicate decision against current open recommendations.",
            objective: "Decide whether the current top listing needs a new operator artifact.",
            successCriteria: [
              "Current radar state and open recommendations are accounted for.",
              "Available freshness evidence is cited before deciding whether discovery is needed.",
              "No duplicate recommendation is created if the existing open recommendation already covers the top listing.",
            ],
            plannedSteps: [
              "Observe radar state and open recommendations.",
              "Update working memory with the duplicate-risk decision.",
              "Stop without writing if current recommendations already cover the decision.",
            ],
            stopConditions: [
              "Existing open recommendation already covers the top listing.",
              "A genuinely new uncovered action is found.",
            ],
            riskChecks: [
              "Do not create duplicate operator-facing recommendations.",
              "Do not invent listing facts beyond local radar state.",
            ],
            confidence: 0.87,
          });
        }

        if (callNumber === 3) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Persist that the current state is already covered before stopping without a write.",
            focus: "Existing open recommendation already covers covered-listing; avoid a duplicate write.",
            hypotheses: ["The top listing needs operator follow-up, but that action is already represented by an open recommendation."],
            nextActions: ["Stop without recording another recommendation."],
            openQuestions: ["Whether the operator has acted on the existing recommendation yet."],
            confidence: 0.86,
          });
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop because a duplicate recommendation would not add operator value.",
          summary: "Existing open recommendation already covers the current top listing, so no new recommendation was recorded.",
            criteriaResults: [
              {
                criterion: "Current radar state and open recommendations are accounted for.",
                status: "satisfied",
                evidence: "get_radar_state returned the current top listing and its open recommendation.",
              },
              {
                criterion: "Available freshness evidence is cited before deciding whether discovery is needed.",
                status: "partial",
                evidence: "get_radar_state did not expose exact last-seen fields, so the limitation is recorded instead of inventing freshness.",
              },
              {
                criterion: "No duplicate recommendation is created if the existing open recommendation already covers the top listing.",
                status: "satisfied",
                evidence: "Working memory states that the existing open recommendation already covers covered-listing.",
              },
            ],
          nextActions: [
            "Review or resolve the existing open recommendation instead of creating another one.",
            "Next run: inspect whether richer exact freshness data is available before deciding discovery is required.",
          ],
          unresolvedQuestions: ["Exact last-seen timestamps are not exposed by the current radar state."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 4,
    });
    const audit = getAgentContractAuditForRun(result.run.id);
    const recommendations = listAgentRecommendations(10).filter((recommendation) => recommendation.listingId === "covered-listing");

    expect(result.run.status).toBe("completed");
    expect(result.recommendationsRecorded).toBe(0);
    expect(recommendations).toHaveLength(1);
    expect(audit?.status).toBe("pass");
    expect(audit?.score).toBe(100);
    expect(audit?.checks.find((check) => check.id === "operator_value")?.status).toBe("pass");
    expect(audit?.checks.find((check) => check.id === "recommendation_grounding")?.status).toBe("pass");
  });

  it("records structured blocking operator reviews when human judgment is the next safe step", async () => {
    const { addListing } = await import("../src/storage/listings.js");
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const {
      getAgentContractAuditForRun,
      listAgentOperatorReviews,
    } = await import("../src/storage/agent.js");

    addListing({
      id: "review-needed-listing",
      source: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/review-needed/7d",
      title: "Review Needed West Village Lead",
      address: "75 Bank St #7D",
      neighborhood: "West Village",
      borough: "Manhattan",
      rent: 4050,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "unknown",
      latitude: 40.737,
      longitude: -74.004,
    }, defaultPreferenceProfile);

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        const callNumber = requests.length;

        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe ranked listings before deciding whether a human decision is needed.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-inspect", "inspect_listing", {
            intent: "Inspect the promising listing before asking the operator to decide.",
            listingId: "review-needed-listing",
          });
        }

        if (callNumber === 3) {
          return functionCallResponse("call-plan", "set_episode_plan", {
            intent: "Set explicit success criteria for a human-review handoff.",
            objective: "Decide whether the West Village listing should pause for operator review.",
            successCriteria: [
              "Listing evidence has been inspected.",
              "A structured operator review request is recorded.",
            ],
            plannedSteps: [
              "Inspect the listing evidence.",
              "Record working memory about the decision boundary.",
              "Request operator review with bounded options.",
            ],
            stopConditions: [
              "Blocking operator review is recorded.",
              "Required evidence is unavailable.",
            ],
            riskChecks: [
              "Do not change listing status automatically.",
              "Do not send outreach automatically.",
            ],
            confidence: 0.78,
          });
        }

        if (callNumber === 4) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Externalize why this listing is at the human-decision boundary.",
            focus: "Ask the operator whether a fee-unknown but strong listing is worth attention.",
            hypotheses: ["The listing is promising, but fee uncertainty affects whether it is worth outreach."],
            nextActions: ["Create a blocking operator review request."],
            openQuestions: ["Can the operator tolerate unknown fee status for this listing?"],
            confidence: 0.74,
          });
        }

        if (callNumber === 5) {
          return functionCallResponse("call-review", "request_operator_review", {
            intent: "Pause for human judgment instead of deciding fee tolerance autonomously.",
            listingId: "review-needed-listing",
            urgency: "high",
            question: "Should this fee-unknown West Village listing stay in the active follow-up set?",
            options: [
              {
                label: "Keep active",
                description: "Treat the listing as worth manual fee verification and possible outreach.",
              },
              {
                label: "Reject for now",
                description: "Do not spend operator attention until fee status is clearer.",
              },
            ],
            recommendedOption: "Keep active",
            rationale: "The listing has strong location and score signal, but fee status is unknown and needs operator judgment.",
            evidence: [{
              kind: "listing",
              ref: "review-needed-listing",
              detail: "Inspected listing is a West Village lead with unknown fee status.",
            }],
            blocking: true,
          });
        }

        if (callNumber === 6) {
          return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
            intent: "Stop because a blocking operator review request now carries the next decision.",
            summary: "Recorded a blocking operator review request for the West Village listing.",
            outcome: "blocked",
            criteriaResults: [
              {
                criterion: "Listing evidence has been inspected.",
                status: "satisfied",
                evidence: "inspect_listing returned details for review-needed-listing.",
              },
              {
                criterion: "A structured operator review request is recorded.",
                status: "satisfied",
                evidence: "request_operator_review saved a blocking request with two options.",
              },
            ],
            nextActions: ["Answer the saved operator review request."],
            unresolvedQuestions: ["Whether unknown fee status is acceptable for this listing."],
          }));
        }

        return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
          verdict: "strong",
          objectiveAlignment: 90,
          evidenceGrounding: 88,
          toolDiscipline: 88,
          safetyDiscipline: 95,
          operatorValue: 92,
          learningQuality: 85,
          findings: ["The run paused at the right human-decision boundary with structured evidence."],
          nextExperiment: "Use operator review when fee uncertainty blocks an otherwise strong listing decision.",
          reflection: {
            score: 90,
            outcome: "blocked",
            summary: "The run recorded a blocking human-review request with bounded options.",
            lessons: ["Use operator review for subjective preference thresholds that should not be automated."],
            nextRunGuidance: "When uncertainty is subjective rather than factual, request operator review instead of writing a recommendation.",
          },
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 6,
    });
    const reviews = listAgentOperatorReviews();
    const audit = getAgentContractAuditForRun(result.run.id);

    expect(result.run.status).toBe("completed");
    expect(result.operatorReviewsRecorded).toBe(1);
    expect(result.recommendationsRecorded).toBe(0);
    expect(result.toolCalls.map((call) => call.name)).toEqual([
      "get_radar_state",
      "inspect_listing",
      "set_episode_plan",
      "update_working_memory",
      "request_operator_review",
      "stop_agent",
    ]);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.listingId).toBe("review-needed-listing");
    expect(reviews[0]?.blocking).toBe(true);
    expect(reviews[0]?.recommendedOption).toBe("Keep active");
    expect(reviews[0]?.options.map((option) => option.label)).toEqual(["Keep active", "Reject for now"]);
    expect(reviews[0]?.evidence.some((item) => item.kind === "score" && item.ref === "review-needed-listing")).toBe(true);
    expect(audit?.status).toBe("pass");
    expect(audit?.checks.find((check) => check.id === "operator_value")?.status).toBe("pass");
    expect(audit?.checks.find((check) => check.id === "recommendation_grounding")?.detail).toContain("review request");
    expect(audit?.checks.find((check) => check.id === "recommendation_provenance")?.status).toBe("pass");
  });

  it("surfaces answered operator reviews as model-observable radar state", async () => {
    const { executeAgentTool } = await import("../src/agent/tools.js");
    const {
      answerAgentOperatorReview,
      recordAgentOperatorReview,
      startAgentRun,
    } = await import("../src/storage/agent.js");

    const priorRun = startAgentRun({
      objective: "Ask for operator preference feedback.",
      mode: "openai",
      model: "gpt-5.5",
    });
    const review = recordAgentOperatorReview({
      runId: priorRun.id,
      listingId: null,
      urgency: "medium",
      question: "Should fee-unknown listings remain eligible for follow-up?",
      options: [
        {
          label: "Keep active",
          description: "Keep strong listings active while verifying fee status.",
        },
        {
          label: "Reject fee-unknown",
          description: "Reject listings until no-fee status is explicit.",
        },
      ],
      recommendedOption: "Keep active",
      rationale: "The model should not infer fee tolerance without operator feedback.",
      evidence: [{
        kind: "operator_constraint",
        ref: "fee-policy",
        detail: "Fee tolerance is a subjective operator preference.",
      }],
      blocking: true,
    });
    answerAgentOperatorReview({
      id: review.id,
      selectedOption: "Keep active",
      note: "Keep strong matches active while fee status is verified.",
    });

    const currentRun = startAgentRun({
      objective: "Observe prior operator feedback before choosing next action.",
      mode: "openai",
      model: "gpt-5.5",
    });
    const result = await executeAgentTool("get_radar_state", {
      intent: "Observe answered operator review feedback before selecting the next tool.",
      limit: 5,
    }, {
      runId: currentRun.id,
      profile: defaultPreferenceProfile,
      allowLiveNotifications: false,
    });
    const data = result.data as {
      counts: { operatorReviewsByStatus: Record<string, number> };
      recentOperatorReviews: Array<{
        id: string;
        status: string;
        selectedOption: string | null;
        operatorNote: string | null;
      }>;
    };

    expect(result.ok).toBe(true);
    expect(data.counts.operatorReviewsByStatus.answered).toBe(1);
    expect(data.recentOperatorReviews[0]).toMatchObject({
      id: review.id,
      status: "answered",
      selectedOption: "Keep active",
      operatorNote: "Keep strong matches active while fee status is verified.",
    });
  });

  it("rewrites disallowed live notification requests and feeds the guardrail result back to the model", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { getAgentContractAuditForRun, listAgentGuardrailEvents, listAgentSteps } = await import("../src/storage/agent.js");

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        const callNumber = requests.length;

        if (callNumber === 1) {
          return functionCallResponse("call-discovery", "run_discovery_pass", {
            intent: "Refresh configured StreetEasy supply before deciding whether there is new signal.",
            notificationMode: "send",
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
            intent: "Stop after the runtime rewrote live notification delivery for this dry run.",
            summary: "Discovery ran without live notification delivery.",
            outcome: "blocked",
            criteriaResults: [{
              criterion: "Respect dry-run notification policy.",
              status: "satisfied",
              evidence: "Guardrail rewrote notificationMode from send to dry-run.",
            }],
            nextActions: ["Run live only when notification delivery is explicitly allowed."],
          }));
        }

        return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
          verdict: "useful",
          objectiveAlignment: 80,
          evidenceGrounding: 80,
          toolDiscipline: 80,
          safetyDiscipline: 80,
          operatorValue: 80,
          learningQuality: 80,
          findings: ["The runtime rewrote the notification mode and the agent stopped cleanly."],
          nextExperiment: "Check whether the model asks for send mode again during dry runs.",
          reflection: {
            score: 84,
            outcome: "useful",
            summary: "The runtime rewrote the notification mode and the agent stopped cleanly.",
            lessons: ["Treat rewritten notificationMode as environment feedback."],
            nextRunGuidance: "Respect dry-run notification policy unless live delivery is explicitly allowed.",
          },
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "dry-run",
      maxIterations: 3,
    });
    const guardrails = listAgentGuardrailEvents(result.run.id);
    const toolResult = listAgentSteps(result.run.id).find((step) => step.kind === "tool_result" && step.toolName === "run_discovery_pass");

    expect(result.guardrailEvents[0]).toMatchObject({
      toolName: "run_discovery_pass",
      decision: "rewritten",
    });
    expect(guardrails[0]?.decision).toBe("rewritten");
    expect(guardrails[0]?.effectiveInputJson).toContain("\"notificationMode\":\"dry-run\"");
    expect(toolResult?.outputJson).toContain("\"guardrail\"");
    expect(toolResult?.outputJson).toContain("\"rewritten\"");
    expect(result.discoveryResult?.notificationsSkipped).toBe(0);
    expect(getAgentContractAuditForRun(result.run.id)?.status).toBe("fail");
    expect(getAgentContractAuditForRun(result.run.id)?.checks.some((check) => check.id === "working_memory" && check.status === "fail")).toBe(true);
  });

  it("blocks operator-facing writes until working memory reflects the latest observation", async () => {
    const { addListing } = await import("../src/storage/listings.js");
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { listAgentGuardrailEvents, listAgentRecommendations } = await import("../src/storage/agent.js");

    addListing({
      id: "memory-gated-listing",
      source: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/memory-gated/3a",
      title: "Memory Gated LES Lead",
      address: "10 Stanton St #3A",
      neighborhood: "Lower East Side",
      borough: "Manhattan",
      rent: 3300,
      bedrooms: 1,
      bathrooms: 1,
      pets: "unknown",
      feeStatus: "unknown",
      latitude: 40.721,
      longitude: -73.989,
    }, defaultPreferenceProfile);

    let callNumber = 0;
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "useful",
            objectiveAlignment: 82,
            evidenceGrounding: 84,
            toolDiscipline: 78,
            safetyDiscipline: 100,
            operatorValue: 80,
            learningQuality: 80,
            findings: ["The guardrail forced memory before the recommendation write."],
            nextExperiment: "Keep memory-before-write as a runtime invariant.",
            reflection: {
              score: 82,
              outcome: "useful",
              summary: "The guardrail forced memory before the recommendation write.",
              lessons: ["When blocked for missing memory, update working memory before retrying the write."],
              nextRunGuidance: "Update memory after inspection before recommendation writes.",
            },
          }));
        }

        callNumber += 1;
        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe radar state before choosing a listing.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-plan", "set_episode_plan", {
            intent: "Plan a memory-gated recommendation test.",
            objective: "Recommend the memory-gated listing only after inspection and memory.",
            successCriteria: ["Listing is inspected.", "Working memory is updated before recommendation."],
            plannedSteps: ["Observe radar.", "Update memory.", "Inspect listing.", "Record recommendation."],
            stopConditions: ["Recommendation is recorded."],
            riskChecks: ["Do not write recommendations before memory captures inspection evidence."],
            confidence: 0.8,
          });
        }

        if (callNumber === 3) {
          return functionCallResponse("call-memory-before-inspect", "update_working_memory", {
            intent: "Clear the post-radar observation memory requirement before inspecting.",
            focus: "Prepare to inspect the memory-gated listing.",
            hypotheses: ["The listing may deserve follow-up."],
            nextActions: ["Inspect the listing."],
            openQuestions: ["Whether inspection evidence supports a recommendation."],
            confidence: 0.75,
          });
        }

        if (callNumber === 4) {
          return functionCallResponse("call-inspect", "inspect_listing", {
            intent: "Inspect the listing before recommending it.",
            listingId: "memory-gated-listing",
          });
        }

        if (callNumber === 5) {
          return functionCallResponse("call-rec-blocked", "record_recommendation", {
            intent: "Try to record a recommendation before updating memory, which should be blocked.",
            listingId: "memory-gated-listing",
            priority: "high",
            actionType: "draft_outreach",
            title: "Draft outreach for memory-gated listing",
            rationale: "The listing was inspected and appears promising.",
            evidence: [{
              kind: "listing",
              ref: "memory-gated-listing",
              detail: "Inspected listing appears promising.",
            }],
            proposedStatus: null,
          });
        }

        if (callNumber === 6) {
          return functionCallResponse("call-memory-after-inspect", "update_working_memory", {
            intent: "React to the guardrail and capture inspection evidence before retrying the write.",
            focus: "Inspected memory-gated listing and ready to recommend.",
            hypotheses: ["The listing merits a draft outreach recommendation."],
            nextActions: ["Retry the evidence-backed recommendation."],
            openQuestions: ["Fee and pet policy are still unknown."],
            confidence: 0.8,
          });
        }

        if (callNumber === 7) {
          return functionCallResponse("call-rec", "record_recommendation", {
            intent: "Record the recommendation after working memory reflects inspection evidence.",
            listingId: "memory-gated-listing",
            priority: "high",
            actionType: "draft_outreach",
            title: "Draft outreach for memory-gated listing",
            rationale: "The listing was inspected, memory was updated, and the evidence supports operator review.",
            evidence: [{
              kind: "listing",
              ref: "memory-gated-listing",
              detail: "Inspected listing appears promising.",
            }],
            proposedStatus: null,
          });
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after the memory-gated recommendation was recorded.",
          summary: "Recommendation was recorded only after memory reflected inspection evidence.",
          criteriaResults: [
            {
              criterion: "Listing is inspected.",
              status: "satisfied",
              evidence: "inspect_listing returned the memory-gated listing.",
            },
            {
              criterion: "Working memory is updated before recommendation.",
              status: "satisfied",
              evidence: "The first recommendation attempt was blocked and the retry occurred after update_working_memory.",
            },
          ],
          nextActions: ["Review the saved recommendation."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 8,
    });
    const guardrails = listAgentGuardrailEvents(result.run.id);

    expect(guardrails.some((event) => event.toolName === "record_recommendation" && event.decision === "blocked" && event.reason.includes("Update working memory"))).toBe(true);
    expect(listAgentRecommendations().filter((recommendation) => recommendation.listingId === "memory-gated-listing")).toHaveLength(1);
  });

  it("feeds prior contract audits, reflection lessons, and episode evaluations into the next run context", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { finishAgentRun, getAgentRunContext, recordAgentContractAudit, recordAgentEvaluation, recordAgentPlaybookEntry, recordAgentReflection, startAgentRun } = await import("../src/storage/agent.js");

    const priorRun = startAgentRun({
      objective: "Previous run",
      mode: "openai",
      model: "gpt-5.5",
    });
    finishAgentRun(priorRun.id, {
      status: "completed",
      iterations: 1,
      summary: "Previous run found no useful listings.",
    });
    const reflection = recordAgentReflection({
      runId: priorRun.id,
      score: 72,
      outcome: "blocked",
      summary: "Search returned source failures.",
      lessons: ["Inspect recent failures before rerunning discovery when source errors dominate."],
      nextRunGuidance: "Prioritize inspecting failures first.",
    });
    const evaluation = recordAgentEvaluation({
      runId: priorRun.id,
      verdict: "weak",
      objectiveAlignment: 70,
      evidenceGrounding: 65,
      toolDiscipline: 45,
      safetyDiscipline: 100,
      operatorValue: 50,
      learningQuality: 75,
      findings: ["The run spent too little time inspecting failure evidence before stopping."],
      nextExperiment: "Inspect recent failures before deciding whether discovery is worth another pass.",
    });
    const audit = recordAgentContractAudit({
      runId: priorRun.id,
      status: "fail",
      score: 70,
      checks: [{
        id: "working_memory",
        label: "Working memory",
        status: "fail",
        detail: "Completed run did not externalize focus, hypotheses, next actions, or confidence.",
      }],
    });
    const playbook = recordAgentPlaybookEntry({
      sourceRunId: priorRun.id,
      kind: "anti_pattern",
      instruction: "Inspect recent failures before rerunning discovery when source errors dominate.",
      rationale: "Prior contract audit showed weak tool discipline after source failures.",
    });

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "useful",
            objectiveAlignment: 80,
            evidenceGrounding: 80,
            toolDiscipline: 80,
            safetyDiscipline: 80,
            operatorValue: 80,
            learningQuality: 80,
            findings: ["The run respected prior memory."],
            nextExperiment: "Keep prior evaluations short and actionable.",
            reflection: {
              score: 80,
              outcome: "useful",
              summary: "The run respected prior memory.",
              lessons: ["Continue feeding compact lessons into each run."],
              nextRunGuidance: "Keep prior lessons short and actionable.",
            },
          }));
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after checking that prior memory is present in the next prompt.",
          summary: "Recorded one high-priority outreach recommendation for the hot Chelsea lead.",
          criteriaResults: [{
            criterion: "Prior memory appears in prompt.",
            status: "satisfied",
            evidence: "The request input included prior reflection, audit, and evaluation context.",
          }],
          nextActions: ["Use prior lessons to choose the next run focus."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 1,
    });

    expect(JSON.stringify(requests[0]?.input)).toContain("Prioritize inspecting failures first.");
    expect(JSON.stringify(requests[0]?.input)).toContain("Inspect recent failures before rerunning discovery");
    expect(JSON.stringify(requests[0]?.input)).toContain("Recent contract audits");
    expect(JSON.stringify(requests[0]?.input)).toContain("Completed run did not externalize focus");
    expect(JSON.stringify(requests[0]?.input)).toContain("Recent episode evaluations");
    expect(JSON.stringify(requests[0]?.input)).toContain("Inspect recent failures before deciding whether discovery is worth another pass.");
    expect(JSON.stringify(requests[0]?.input)).toContain("Active playbook directives");
    expect(JSON.stringify(requests[0]?.input)).toContain("Prior contract audit showed weak tool discipline");
    expect(getAgentRunContext(result.run.id)).toMatchObject({
      activePlaybookEntryIds: [playbook.id],
      recentReflectionIds: [reflection.id],
      recentEvaluationIds: [evaluation.id],
      recentContractAuditIds: [audit.id],
    });
  });

  it("turns episode next experiments into active experiments for the next run", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { listAgentExperiments } = await import("../src/storage/agent.js");

    let callNumber = 0;
    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        callNumber += 1;

        if (request.metadata?.phase === "episode_evaluation" && callNumber === 2) {
          return functionCallResponse("call-evaluation-first", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "useful",
            objectiveAlignment: 80,
            evidenceGrounding: 75,
            toolDiscipline: 80,
            safetyDiscipline: 100,
            operatorValue: 65,
            learningQuality: 90,
            findings: ["The first run produced a concrete next experiment."],
            nextExperiment: "Start the next run by inspecting failure evidence before discovery.",
            experimentResult: {
              status: "not_applicable",
              summary: "There was no active experiment on the first run.",
            },
            reflection: {
              score: 80,
              outcome: "useful",
              summary: "The first run queued an improvement experiment.",
              lessons: ["Carry the next experiment into the following run."],
              nextRunGuidance: "Use the queued experiment as the next run's focus.",
            },
          }));
        }

        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation-second", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "strong",
            objectiveAlignment: 90,
            evidenceGrounding: 85,
            toolDiscipline: 88,
            safetyDiscipline: 100,
            operatorValue: 80,
            learningQuality: 95,
            findings: ["The second run received and evaluated the active experiment."],
            nextExperiment: "Compare experiment outcomes against contract audit scores.",
            experimentResult: {
              status: "succeeded",
              summary: "The active experiment was visible in the prompt and shaped the run focus.",
            },
            reflection: {
              score: 90,
              outcome: "useful",
              summary: "The second run closed the active experiment and queued a follow-up.",
              lessons: ["Treat active experiments as episode-level success criteria."],
              nextRunGuidance: "Check experiment outcome before selecting the next tool.",
            },
          }));
        }

        return functionCallResponse(`call-stop-${callNumber}`, "stop_agent", stopAgentArgs({
          intent: "Stop after exercising the experiment lifecycle in this controlled test.",
          summary: "Experiment lifecycle test run stopped.",
          criteriaResults: [{
            criterion: "Exercise experiment lifecycle.",
            status: "satisfied",
            evidence: "The controlled test reaches evaluation where experiments are queued and completed.",
          }],
          nextActions: ["Inspect persisted experiment records."],
        }));
      },
    };

    const first = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 1,
    });
    const afterFirst = listAgentExperiments();

    expect(first.activeExperiment).toBeNull();
    expect(first.queuedExperiment?.description).toContain("inspecting failure evidence");
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0]?.status).toBe("pending");

    const second = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 1,
    });
    const experiments = listAgentExperiments();
    const completed = experiments.find((experiment) => experiment.id === first.queuedExperiment?.id);
    const queued = experiments.find((experiment) => experiment.sourceRunId === second.run.id);

    expect(second.activeExperiment?.id).toBe(first.queuedExperiment?.id);
    expect(JSON.stringify(requests[2]?.input)).toContain("Active improvement experiment");
    expect(JSON.stringify(requests[2]?.input)).toContain("inspecting failure evidence");
    expect(completed?.status).toBe("succeeded");
    expect(completed?.startedRunId).toBe(second.run.id);
    expect(completed?.completedRunId).toBe(second.run.id);
    expect(completed?.resultSummary).toContain("visible in the prompt");
    expect(queued?.status).toBe("pending");
    expect(queued?.description).toContain("contract audit scores");
  });

  it("requires active experiments to shape the plan or working memory", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const {
      getAgentContractAuditForRun,
      listAgentExperiments,
      recordAgentExperiment,
      startAgentRun,
    } = await import("../src/storage/agent.js");

    const sourceRun = startAgentRun({
      objective: "Create a controlled improvement experiment.",
      mode: "openai",
      model: "gpt-5.5",
    });
    const experiment = recordAgentExperiment({
      sourceRunId: sourceRun.id,
      description: "Inspect failure evidence before discovery.",
    });

    let loopCallNumber = 0;
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "useful",
            objectiveAlignment: 82,
            evidenceGrounding: 80,
            toolDiscipline: 84,
            safetyDiscipline: 100,
            operatorValue: 60,
            learningQuality: 88,
            findings: ["The run operationalized the active failure-evidence experiment."],
            nextExperiment: "Compare active experiment attention against contract audit scores.",
            experimentResult: {
              status: "succeeded",
              summary: "The plan and working memory explicitly used failure evidence before discovery.",
            },
            reflection: {
              score: 84,
              outcome: "useful",
              summary: "The run translated the active experiment into plan and memory state.",
              lessons: ["Active experiments should become episode-level planning constraints."],
              nextRunGuidance: "When an active experiment is assigned, name it in the plan or working memory.",
            },
          }));
        }

        loopCallNumber += 1;
        if (loopCallNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe current radar state before applying the active experiment.",
            limit: 5,
          });
        }

        if (loopCallNumber === 2) {
          return functionCallResponse("call-plan", "set_episode_plan", {
            intent: "Operationalize the active failure-evidence experiment before discovery.",
            objective: "Inspect failure evidence before deciding whether discovery is useful.",
            successCriteria: [
              "Failure evidence has been inspected or explicitly ruled out before discovery.",
              "Discovery happens only if the failure evidence does not explain the current no-signal state.",
            ],
            plannedSteps: [
              "Review radar state for current supply.",
              "Use failure evidence to decide whether another discovery pass is worth running.",
            ],
            stopConditions: [
              "Failure evidence explains the current state.",
              "The next discovery or review action is clear.",
            ],
            riskChecks: [
              "Do not run discovery reflexively before checking failure evidence.",
              "Do not treat missing source data as listing rejection evidence.",
            ],
            confidence: 0.78,
          });
        }

        if (loopCallNumber === 3) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Persist how the active experiment changes the next decision.",
            focus: "Use failure evidence before discovery.",
            hypotheses: ["Recent failures may explain why discovery has low signal."],
            nextActions: ["Inspect recent failures before any discovery pass."],
            openQuestions: ["Whether source failures or empty supply explain the current state."],
            confidence: 0.76,
          });
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after proving the active experiment shaped the episode state.",
          summary: "The active experiment was reflected in plan and working memory.",
          outcome: "no_signal",
          criteriaResults: [
            {
              criterion: "Failure evidence has been inspected or explicitly ruled out before discovery.",
              status: "partial",
              evidence: "The controlled run recorded the failure-evidence plan and memory without running discovery.",
            },
            {
              criterion: "Discovery happens only if the failure evidence does not explain the current no-signal state.",
              status: "not_applicable",
              evidence: "The run stopped after recording the experiment attention invariant.",
            },
          ],
          nextActions: ["Run inspect_recent_failures before the next discovery pass."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 4,
    });
    const activeExperimentAttention = getAgentContractAuditForRun(result.run.id)?.checks.find((check) => check.id === "active_experiment_attention");
    const completedExperiment = listAgentExperiments().find((item) => item.id === experiment.id);

    expect(result.activeExperiment?.id).toBe(experiment.id);
    expect(activeExperimentAttention?.status).toBe("pass");
    expect(activeExperimentAttention?.detail).toContain("failure");
    expect(completedExperiment?.status).toBe("succeeded");
    expect(completedExperiment?.completedRunId).toBe(result.run.id);
  });

  it("fails the contract when an active experiment is ignored", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const {
      getAgentContractAuditForRun,
      recordAgentExperiment,
      startAgentRun,
    } = await import("../src/storage/agent.js");

    const sourceRun = startAgentRun({
      objective: "Create a controlled ignored experiment.",
      mode: "openai",
      model: "gpt-5.5",
    });
    const experiment = recordAgentExperiment({
      sourceRunId: sourceRun.id,
      description: "Inspect source failures before discovery.",
    });

    let loopCallNumber = 0;
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "weak",
            objectiveAlignment: 60,
            evidenceGrounding: 55,
            toolDiscipline: 62,
            safetyDiscipline: 100,
            operatorValue: 30,
            learningQuality: 72,
            findings: ["The run did not operationalize the active experiment."],
            nextExperiment: "Force active experiments into the episode plan or working memory.",
            experimentResult: {
              status: "skipped",
              summary: "The active experiment was ignored by the plan and working memory.",
            },
            reflection: {
              score: 58,
              outcome: "no_signal",
              summary: "The run ignored the active experiment while otherwise recording loop state.",
              lessons: ["Do not treat active experiments as passive prompt context."],
              nextRunGuidance: "Name the active experiment in planning or memory before stopping.",
            },
          }));
        }

        loopCallNumber += 1;
        if (loopCallNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe current radar state before choosing a generic follow-up.",
            limit: 5,
          });
        }

        if (loopCallNumber === 2) {
          return functionCallResponse("call-plan", "set_episode_plan", {
            intent: "Record a generic listing review plan.",
            objective: "Review current ranked listings.",
            successCriteria: ["Current ranked listings are reviewed."],
            plannedSteps: ["Observe radar state.", "Update memory.", "Stop."],
            stopConditions: ["No useful listing action is available."],
            riskChecks: ["Do not invent listing facts."],
            confidence: 0.64,
          });
        }

        if (loopCallNumber === 3) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Persist generic listing-review memory.",
            focus: "Review top listings.",
            hypotheses: ["There may be no current high-signal listings."],
            nextActions: ["Stop if no listing action is available."],
            openQuestions: [],
            confidence: 0.61,
          });
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after recording the generic plan and memory.",
          summary: "The run ignored the active source-failure experiment.",
          outcome: "no_signal",
          criteriaResults: [{
            criterion: "Current ranked listings are reviewed.",
            status: "satisfied",
            evidence: "Radar state was observed.",
          }],
          nextActions: ["Run another focused pass."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 4,
    });
    const activeExperimentAttention = getAgentContractAuditForRun(result.run.id)?.checks.find((check) => check.id === "active_experiment_attention");

    expect(result.activeExperiment?.id).toBe(experiment.id);
    expect(activeExperimentAttention?.status).toBe("fail");
    expect(activeExperimentAttention?.detail).toContain("not reflected");
  });

  it("rejects recommendation writes that do not carry structured evidence", async () => {
    const { addListing } = await import("../src/storage/listings.js");
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { getAgentContractAuditForRun, listAgentRecommendations, listAgentSteps } = await import("../src/storage/agent.js");

    addListing({
      id: "ungrounded-listing",
      source: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/ungrounded/2a",
      title: "Ungrounded Williamsburg Lead",
      address: "123 N 7th St #2A",
      neighborhood: "Williamsburg",
      borough: "Brooklyn",
      rent: 3800,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "unknown",
      latitude: 40.718,
      longitude: -73.958,
    }, defaultPreferenceProfile);

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        const callNumber = requests.length;

        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe ranked listings before attempting a recommendation.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Record current focus before attempting the intentionally ungrounded recommendation.",
            focus: "Testing evidence validation on recommendation writes.",
            hypotheses: ["The listing appears in radar state but the write lacks evidence."],
            nextActions: ["Attempt the invalid recommendation to verify validation."],
            openQuestions: ["Which evidence should be supplied?"],
            confidence: 0.6,
          });
        }

        if (callNumber === 3) {
          return functionCallResponse("call-rec", "record_recommendation", {
            intent: "Attempt to record the next operator action for the promising listing.",
            listingId: "ungrounded-listing",
            priority: "high",
            actionType: "inspect_listing",
            title: "Inspect listing without evidence",
            rationale: "Looks promising.",
            proposedStatus: null,
          });
        }

        if (callNumber === 4) {
          return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
            intent: "Stop after the ungrounded recommendation write was rejected.",
            summary: "Stopped after an ungrounded recommendation was rejected.",
            outcome: "blocked",
            criteriaResults: [{
              criterion: "Recommendation write carries evidence.",
              status: "unsatisfied",
              evidence: "record_recommendation rejected the write because evidence was missing.",
            }],
            nextActions: ["Inspect the listing and cite evidence before recording recommendations."],
            unresolvedQuestions: ["Which listing evidence should be cited?"],
          }));
        }

        return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
          verdict: "weak",
          objectiveAlignment: 60,
          evidenceGrounding: 20,
          toolDiscipline: 60,
          safetyDiscipline: 90,
          operatorValue: 20,
          learningQuality: 70,
          findings: ["The recommendation write was rejected because it lacked structured evidence."],
          nextExperiment: "Inspect the listing and cite evidence before recording recommendations.",
          reflection: {
            score: 45,
            outcome: "no_signal",
            summary: "The run tried to record an ungrounded recommendation.",
            lessons: ["Recommendation writes need structured evidence."],
            nextRunGuidance: "Inspect evidence before recording recommendations.",
          },
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 5,
    });
    const recommendationStep = listAgentSteps(result.run.id).find((step) => step.kind === "tool_result" && step.toolName === "record_recommendation");

    expect(result.toolCalls.find((call) => call.name === "record_recommendation")?.ok).toBe(false);
    expect(recommendationStep?.outputJson).toContain("Expected non-empty evidence array");
    expect(listAgentRecommendations()).toHaveLength(0);
    expect(getAgentContractAuditForRun(result.run.id)?.status).toBe("fail");
  });

  it("blocks listing recommendations that skip required in-run inspection", async () => {
    const { addListing } = await import("../src/storage/listings.js");
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { listAgentGuardrailEvents, listAgentRecommendations, listAgentSteps } = await import("../src/storage/agent.js");

    addListing({
      id: "uninspected-listing",
      source: "StreetEasy",
      sourceUrl: "https://streeteasy.com/building/uninspected/5c",
      title: "Uninspected Prospect Heights Lead",
      address: "25 Underhill Ave #5C",
      neighborhood: "Prospect Heights",
      borough: "Brooklyn",
      rent: 3600,
      bedrooms: 1,
      bathrooms: 1,
      pets: "cats_allowed",
      feeStatus: "no_fee",
      latitude: 40.678,
      longitude: -73.965,
    }, defaultPreferenceProfile);

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        const callNumber = requests.length;

        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe ranked listings before choosing whether any need outreach.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Record current radar focus before testing inspection provenance.",
            focus: "Testing inspection provenance for outreach recommendations.",
            hypotheses: ["The listing appeared in radar state but has not been inspected."],
            nextActions: ["Attempt the unsupported outreach recommendation."],
            openQuestions: ["Whether inspection would support outreach."],
            confidence: 0.6,
          });
        }

        if (callNumber === 3) {
          return functionCallResponse("call-rec", "record_recommendation", {
            intent: "Try to recommend outreach for the observed listing without inspecting detail.",
            listingId: "uninspected-listing",
            priority: "high",
            actionType: "draft_outreach",
            title: "Draft outreach for the uninspected lead",
            rationale: "The listing appears promising from the ranked view.",
            evidence: [{
              kind: "listing",
              ref: "uninspected-listing",
              detail: "The listing appeared in the ranked radar state.",
            }],
            proposedStatus: null,
          });
        }

        if (callNumber === 4) {
          return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
            intent: "Stop after the runtime blocked the unsupported outreach recommendation.",
            summary: "Stopped after outreach recommendation was blocked pending inspection.",
            outcome: "blocked",
            criteriaResults: [{
              criterion: "Outreach recommendation is backed by listing inspection.",
              status: "unsatisfied",
              evidence: "Guardrail blocked draft_outreach recommendation because inspect_listing had not run.",
            }],
            nextActions: ["Inspect the listing before recommending outreach."],
            unresolvedQuestions: ["Whether the listing still deserves outreach after inspection."],
          }));
        }

        return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
          verdict: "weak",
          objectiveAlignment: 65,
          evidenceGrounding: 35,
          toolDiscipline: 55,
          safetyDiscipline: 95,
          operatorValue: 25,
          learningQuality: 70,
          findings: ["The runtime blocked an outreach recommendation before listing detail inspection."],
          nextExperiment: "Inspect the listing before recommending outreach.",
          reflection: {
            score: 48,
            outcome: "no_signal",
            summary: "The run skipped listing detail inspection before recommending outreach.",
            lessons: ["Outreach recommendations require in-run inspect_listing evidence."],
            nextRunGuidance: "After radar state, inspect a promising listing before recommending outreach.",
          },
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 4,
    });
    const guardrails = listAgentGuardrailEvents(result.run.id);
    const recommendationStep = listAgentSteps(result.run.id).find((step) => step.kind === "tool_result" && step.toolName === "record_recommendation");

    expect(result.toolCalls.find((call) => call.name === "record_recommendation")?.ok).toBe(false);
    expect(guardrails.find((event) => event.toolName === "record_recommendation")?.decision).toBe("blocked");
    expect(guardrails.find((event) => event.toolName === "record_recommendation")?.reason).toContain("require inspect_listing");
    expect(recommendationStep?.outputJson).toContain("require inspect_listing");
    expect(listAgentRecommendations()).toHaveLength(0);
  });

  it("rejects tool calls that do not declare action intent", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { getAgentContractAuditForRun, listAgentSteps } = await import("../src/storage/agent.js");

    let callNumber = 0;
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        callNumber += 1;
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "weak",
            objectiveAlignment: 50,
            evidenceGrounding: 20,
            toolDiscipline: 20,
            safetyDiscipline: 90,
            operatorValue: 10,
            learningQuality: 70,
            findings: ["The first tool call omitted action intent and was rejected."],
            nextExperiment: "Always include specific intent on tool calls.",
            reflection: {
              score: 35,
              outcome: "failed",
              summary: "The run did not provide intent for its first action.",
              lessons: ["Tool calls must declare intent."],
              nextRunGuidance: "Declare why each tool call is the next useful step.",
            },
          }));
        }

        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", { limit: 5 });
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after the missing-intent tool call was rejected.",
          summary: "Stopped after missing action intent.",
          outcome: "blocked",
          criteriaResults: [{
            criterion: "Every tool call declares intent.",
            status: "unsatisfied",
            evidence: "The first get_radar_state call omitted intent and failed validation.",
          }],
          nextActions: ["Retry with specific tool intent."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 2,
    });
    const toolResult = listAgentSteps(result.run.id).find((step) => step.kind === "tool_result" && step.toolName === "get_radar_state");

    expect(result.toolCalls.find((call) => call.name === "get_radar_state")?.ok).toBe(false);
    expect(toolResult?.outputJson).toContain("Expected non-empty string argument");
    expect(getAgentContractAuditForRun(result.run.id)?.checks.some((check) => check.id === "action_intent" && check.status === "fail")).toBe(true);
  });

  it("blocks batched tool actions before side effects and fails the contract", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { getAgentContractAuditForRun, getLatestAgentRunPlan, listAgentGuardrailEvents } = await import("../src/storage/agent.js");

    let callNumber = 0;
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        callNumber += 1;
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "weak",
            objectiveAlignment: 55,
            evidenceGrounding: 50,
            toolDiscipline: 20,
            safetyDiscipline: 90,
            operatorValue: 20,
            learningQuality: 70,
            findings: ["The model batched observation and planning before receiving tool feedback."],
            nextExperiment: "Take exactly one tool action per model turn.",
            reflection: {
              score: 42,
              outcome: "failed",
              summary: "The run did not preserve observe-decide-act causality.",
              lessons: ["Wait for tool feedback before selecting the next action."],
              nextRunGuidance: "Call one tool, observe its result, then choose the next tool.",
            },
          }));
        }

        if (callNumber === 1) {
          return multiFunctionCallResponse([
            ["call-state", "get_radar_state", {
              intent: "Observe radar state before choosing the episode plan.",
              limit: 5,
            }],
            ["call-plan", "set_episode_plan", {
              intent: "Prematurely set a plan before seeing the radar-state output.",
              objective: "Exercise contract causality.",
              successCriteria: ["Causality check should fail."],
              plannedSteps: ["Batch state and plan in one model turn."],
              stopConditions: ["Stop after causality is tested."],
              riskChecks: ["Do not batch actions before feedback."],
              confidence: 0.5,
            }],
          ]);
        }

        if (callNumber === 2) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Record memory after the batched first turn so only causality fails.",
            focus: "Causality regression test.",
            hypotheses: ["The first model response batched two actions."],
            nextActions: ["Stop with a failed contract check."],
            openQuestions: [],
            confidence: 0.4,
          });
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after recording the batched-action trace.",
          summary: "The run intentionally batched actions before feedback.",
          outcome: "blocked",
          criteriaResults: [{
            criterion: "One action per model turn.",
            status: "unsatisfied",
            evidence: "The first model response emitted get_radar_state and set_episode_plan together.",
          }],
          nextActions: ["Retry with one tool call per model response."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 3,
    });
    const causality = getAgentContractAuditForRun(result.run.id)?.checks.find((check) => check.id === "loop_causality");
    const guardrails = listAgentGuardrailEvents(result.run.id);

    expect(result.toolCalls).toContainEqual({ name: "set_episode_plan", ok: false });
    expect(guardrails.find((event) => event.toolName === "set_episode_plan")?.decision).toBe("blocked");
    expect(guardrails.find((event) => event.toolName === "set_episode_plan")?.reason).toContain("Only one tool action");
    expect(getLatestAgentRunPlan(result.run.id)).toBeNull();
    expect(causality?.status).toBe("fail");
    expect(causality?.detail).toContain("multiple tools before receiving tool feedback");
  });

  it("fails evaluation instead of fabricating critic learning fields", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const { getAgentContractAuditForRun, listAgentSteps } = await import("../src/storage/agent.js");

    let callNumber = 0;
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", {
            verdict: "useful",
            objectiveAlignment: 80,
            evidenceGrounding: 80,
            toolDiscipline: 80,
            safetyDiscipline: 100,
            operatorValue: 60,
            learningQuality: 70,
            findings: ["The critic omitted durable playbook updates."],
            nextExperiment: "Keep critic parsing strict.",
            experimentResult: {
              status: "not_applicable",
              summary: "No active experiment was present.",
            },
            reflection: {
              score: 75,
              outcome: "useful",
              summary: "This malformed evaluation is missing playbook updates.",
              lessons: ["Do not synthesize missing critic fields."],
              nextRunGuidance: "Require the critic to provide durable learning explicitly.",
            },
          });
        }

        callNumber += 1;
        if (callNumber === 1) {
          return functionCallResponse("call-state", "get_radar_state", {
            intent: "Observe radar state before making an episode plan.",
            limit: 5,
          });
        }

        if (callNumber === 2) {
          return functionCallResponse("call-plan", "set_episode_plan", {
            intent: "Set a minimal plan after observing state.",
            objective: "Exercise strict critic parsing.",
            successCriteria: ["The run reaches episode evaluation."],
            plannedSteps: ["Observe state.", "Update memory.", "Stop."],
            stopConditions: ["Evaluation parser behavior can be inspected."],
            riskChecks: ["Do not fabricate learning artifacts."],
            confidence: 0.7,
          });
        }

        if (callNumber === 3) {
          return functionCallResponse("call-memory", "update_working_memory", {
            intent: "Record post-observation memory before stopping.",
            focus: "Strict critic parser regression.",
            hypotheses: ["The evaluator must provide playbookUpdates itself."],
            nextActions: ["Stop and let the critic run."],
            openQuestions: [],
            confidence: 0.7,
          });
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after recording enough trace for critic parsing.",
          summary: "Stopped to exercise strict critic parsing.",
          criteriaResults: [{
            criterion: "The run reaches episode evaluation.",
            status: "satisfied",
            evidence: "State, plan, memory, and stop tool calls completed.",
          }],
          nextActions: ["Inspect evaluation parser outcome."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 4,
    });
    const audit = getAgentContractAuditForRun(result.run.id);
    const evaluationErrorStep = listAgentSteps(result.run.id).find((step) => step.kind === "model_response" && step.outputJson.includes("playbookUpdates"));

    expect(result.evaluation).toBeNull();
    expect(result.reflection).toBeNull();
    expect(result.playbookEntriesRecorded).toBe(0);
    expect(evaluationErrorStep?.outputJson).toContain("playbookUpdates");
    expect(audit?.checks.find((check) => check.id === "episode_evaluation")?.status).toBe("fail");
    expect(audit?.checks.find((check) => check.id === "playbook_learning")?.status).toBe("fail");
  });

  it("resumes from answered blocking operator reviews as first-class run context", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    const {
      answerAgentOperatorReview,
      getAgentOperatorReview,
      recordAgentOperatorReview,
      startAgentRun,
    } = await import("../src/storage/agent.js");

    const priorRun = startAgentRun({
      objective: "Pause at a human fee-tolerance decision.",
      mode: "openai",
      model: "gpt-5.5",
    });
    const review = recordAgentOperatorReview({
      runId: priorRun.id,
      listingId: null,
      urgency: "high",
      question: "Should fee-unknown but otherwise strong listings stay active?",
      options: [
        {
          label: "Keep active",
          description: "Keep strong matches active while fee status is verified.",
        },
        {
          label: "Reject fee-unknown",
          description: "Reject unless no-fee status is explicit.",
        },
      ],
      recommendedOption: "Keep active",
      rationale: "Fee tolerance is subjective and should be supplied by the operator.",
      evidence: [{
        kind: "operator_constraint",
        ref: "fee-tolerance",
        detail: "The operator must decide how to handle unknown fee status.",
      }],
      blocking: true,
    });
    answerAgentOperatorReview({
      id: review.id,
      selectedOption: "Keep active",
      note: "Keep good listings active while verifying fee status.",
    });

    const requests: OpenAIResponseRequest[] = [];
    const client: OpenAIResponsesClient = {
      async createResponse(request) {
        requests.push(request);
        if (request.metadata?.phase === "episode_evaluation") {
          return functionCallResponse("call-evaluation", "record_episode_evaluation", episodeEvaluationArgs({
            verdict: "useful",
            objectiveAlignment: 82,
            evidenceGrounding: 84,
            toolDiscipline: 78,
            safetyDiscipline: 100,
            operatorValue: 85,
            learningQuality: 88,
            findings: ["The run resumed from answered operator review context."],
            nextExperiment: "Use answered operator reviews as explicit next-run state.",
            reflection: {
              score: 84,
              outcome: "useful",
              summary: "The run received the answered operator review as continuation context.",
              lessons: ["Treat answered blocking reviews as active continuation state."],
              nextRunGuidance: "When resuming a review, apply the operator answer before choosing new discovery.",
            },
          }));
        }

        return functionCallResponse("call-stop", "stop_agent", stopAgentArgs({
          intent: "Stop after verifying the answered operator review is present as continuation context.",
          summary: "Continuation context was provided to the model.",
          criteriaResults: [{
            criterion: "Answered review is visible to the supervisor.",
            status: "satisfied",
            evidence: "The first prompt included the selected fee-tolerance option.",
          }],
          nextActions: ["Use the operator answer in the next apartment triage decision."],
        }));
      },
    };

    const result = await runApartmentRadarAgentOnce({
      client,
      openAIConfig: fakeOpenAIConfig(),
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      maxIterations: 1,
    });
    const resumed = getAgentOperatorReview(review.id);
    const firstPrompt = JSON.stringify(requests[0]?.input);
    const evaluationPrompt = JSON.stringify(requests[1]?.input);

    expect(result.resumedOperatorReview?.id).toBe(review.id);
    expect(result.runContext?.resumedOperatorReviewId).toBe(review.id);
    expect(resumed?.resumeRunId).toBe(result.run.id);
    expect(resumed?.resumeClaimedAt).toBeTruthy();
    expect(firstPrompt).toContain("Resuming after operator review");
    expect(firstPrompt).toContain(review.id);
    expect(firstPrompt).toContain("Keep active");
    expect(firstPrompt).toContain("Keep good listings active");
    expect(evaluationPrompt).toContain("resumedOperatorReview");
    expect(evaluationPrompt).toContain(review.id);
  });

  it("refuses the main agent loop when OpenAI is required but not configured", async () => {
    const { runApartmentRadarAgentOnce } = await import("../src/agent/runner.js");
    await expect(runApartmentRadarAgentOnce({
      profile: defaultPreferenceProfile,
      notificationMode: "off",
      openAIConfig: null,
    })).rejects.toThrow("OPENAI_API_KEY");
  });
});

function functionCallResponse(callId: string, name: string, args: Record<string, unknown>) {
  return {
    id: `resp-${callId}`,
    status: "completed",
    output: [{
      type: "function_call",
      call_id: callId,
      name,
      arguments: JSON.stringify(args),
      status: "completed",
    }],
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
    },
  };
}

function reasoningFunctionCallResponse(callId: string, name: string, args: Record<string, unknown>) {
  const response = functionCallResponse(callId, name, args);
  return {
    ...response,
    output: [
      {
        id: "rs-non-persisted-reasoning",
        type: "reasoning",
        summary: [],
      },
      ...response.output,
    ],
  };
}

function multiFunctionCallResponse(calls: Array<[string, string, Record<string, unknown>]>) {
  return {
    id: `resp-${calls.map(([callId]) => callId).join("-")}`,
    status: "completed",
    output: calls.map(([callId, name, args]) => ({
      type: "function_call",
      call_id: callId,
      name,
      arguments: JSON.stringify(args),
      status: "completed",
    })),
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
    },
  };
}

function stopAgentArgs(input: {
  intent: string;
  summary: string;
  outcome?: "success" | "blocked" | "no_signal" | "budget_exhausted";
  criteriaResults?: Array<{
    criterion: string;
    status: "satisfied" | "partial" | "unsatisfied" | "not_applicable";
    evidence: string;
  }>;
  nextActions?: string[];
  unresolvedQuestions?: string[];
}) {
  return {
    intent: input.intent,
    outcome: input.outcome ?? "success",
    criteriaResults: input.criteriaResults ?? [{
      criterion: "The episode reached a deliberate stop condition.",
      status: "satisfied",
      evidence: input.summary,
    }],
    nextActions: input.nextActions ?? ["Review the run trace and recommendations."],
    unresolvedQuestions: input.unresolvedQuestions ?? [],
    summary: input.summary,
  };
}

function episodeEvaluationArgs(input: {
  verdict: "strong" | "useful" | "weak" | "unsafe" | "failed";
  objectiveAlignment: number;
  evidenceGrounding: number;
  toolDiscipline: number;
  safetyDiscipline: number;
  operatorValue: number;
  learningQuality: number;
  findings: string[];
  nextExperiment: string;
  playbookUpdates?: Array<{
    kind: "policy" | "heuristic" | "anti_pattern" | "operator_preference";
    instruction: string;
    rationale: string;
  }>;
  experimentResult?: {
    status: "succeeded" | "failed" | "skipped" | "not_applicable";
    summary: string;
  };
  reflection: {
    score: number;
    outcome: "useful" | "blocked" | "no_signal" | "unsafe" | "failed";
    summary: string;
    lessons: string[];
    nextRunGuidance: string;
  };
}) {
  return {
    ...input,
    playbookUpdates: input.playbookUpdates ?? [{
      kind: "heuristic",
      instruction: "Start by observing radar state, then inspect the highest-signal evidence before writing operator-facing actions.",
      rationale: "The controlled tests expect durable learning to reinforce minimal evidence-grounded loop behavior.",
    }],
    experimentResult: input.experimentResult ?? {
      status: "not_applicable",
      summary: "No active experiment was present.",
    },
  };
}

function fakeOpenAIConfig(): OpenAIResponsesConfig {
  return {
    apiKey: "test-key",
    baseUrl: "https://api.openai.test/v1",
    model: "gpt-5.5",
    timeoutMs: 1000,
    reasoningEffort: "low",
  };
}

function writePreferences() {
  fs.writeFileSync(process.env.NYC_APT_RADAR_PREFERENCES_PATH!, JSON.stringify({
    name: "Agent test profile",
    commuteTargets: [{
      label: "Bryant Park",
      address: "Bryant Park, New York, NY",
      latitude: 40.7536,
      longitude: -73.9832,
      maxMinutes: 35,
    }],
  }));
}
