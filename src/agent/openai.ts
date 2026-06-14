import { fetchWithTimeout, readPositiveIntegerEnv } from "../config/timeouts";

export type OpenAIResponsesConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  reasoningEffort: "low" | "medium" | "high" | "xhigh";
};

export type OpenAIResponseOutputItem = {
  id?: string;
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  status?: string;
  role?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  [key: string]: unknown;
};

export type OpenAIResponse = {
  id?: string;
  status?: string;
  output?: OpenAIResponseOutputItem[];
  output_text?: string;
  usage?: unknown;
  error?: unknown;
};

export type OpenAIResponseRequest = {
  model: string;
  instructions: string;
  input: unknown;
  tools: unknown[];
  tool_choice?: unknown;
  parallel_tool_calls?: boolean;
  reasoning?: {
    effort: OpenAIResponsesConfig["reasoningEffort"];
  };
  text?: {
    verbosity?: "low" | "medium" | "high";
  };
  store?: boolean;
  metadata?: Record<string, string>;
};

export type OpenAIResponsesClient = {
  createResponse(request: OpenAIResponseRequest): Promise<OpenAIResponse>;
};

export function readOpenAIResponsesConfig(): OpenAIResponsesConfig | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    baseUrl: validateBaseUrl(process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"),
    model: process.env.NYC_APT_RADAR_OPENAI_MODEL?.trim() || "gpt-5.5",
    timeoutMs: readPositiveIntegerEnv("NYC_APT_RADAR_OPENAI_TIMEOUT_MS", 30000),
    reasoningEffort: readReasoningEffort(),
  };
}

export function createOpenAIResponsesClient(config: OpenAIResponsesConfig): OpenAIResponsesClient {
  return {
    async createResponse(request: OpenAIResponseRequest) {
      const response = await fetchWithTimeout(`${config.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      }, config.timeoutMs);

      const text = await response.text();
      if (!response.ok) {
        throw new Error(`OpenAI Responses API failed: ${response.status} ${text.slice(0, 400)}`);
      }

      return JSON.parse(text) as OpenAIResponse;
    },
  };
}

export function outputText(response: OpenAIResponse) {
  if (typeof response.output_text === "string") {
    return response.output_text;
  }

  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function functionCalls(response: OpenAIResponse) {
  return (response.output ?? []).filter((item) => item.type === "function_call" && item.call_id && item.name);
}

export function compactResponseTrace(response: OpenAIResponse) {
  return {
    id: response.id ?? null,
    status: response.status ?? null,
    outputTypes: (response.output ?? []).map((item) => item.type),
    text: outputText(response).slice(0, 2000),
    usage: response.usage ?? null,
    error: response.error ?? null,
  };
}

function validateBaseUrl(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error("OPENAI_BASE_URL must be a valid HTTPS URL.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("OPENAI_BASE_URL must use HTTPS.");
  }

  parsed.pathname = parsed.pathname.replace(/\/$/, "");
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString().replace(/\/$/, "");
}

function readReasoningEffort(): OpenAIResponsesConfig["reasoningEffort"] {
  const value = process.env.NYC_APT_RADAR_OPENAI_REASONING_EFFORT?.trim();

  if (value === "low" || value === "medium" || value === "high" || value === "xhigh") {
    return value;
  }

  return "low";
}
