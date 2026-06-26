import {
  type AnalyzeTicketRequest,
  type AnalyzeTicketResponse,
  analyzeTicketResponseSchema,
  isRecord,
} from "@/schemas/apiContract";
import { buildAnalyzeTicketMessages } from "@/services/ai/prompts";

type ChatCompletionChoice = {
  message?: {
    content?: unknown;
  };
};

type ChatCompletionResponse = {
  choices?: ChatCompletionChoice[];
};

type LlmClientConfig = {
  apiKey?: string | string[];
  apiUrl?: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
};

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_MAX_RETRIES = 1;

function readLlmApiKeys(config: LlmClientConfig): string[] {
  let raw: string | string[];

  if (Array.isArray(config.apiKey)) {
    raw = config.apiKey.join(",");
  } else {
    raw =
      config.apiKey ??
      process.env.GROQ_API_KEY ??
      process.env.GROQ_API_KEYS ??
      "";
  }

  return raw
    .split(",")
    .map((key) => key.trim())
    .filter((key) => key.length > 0);
}

function readLlmModel(config: LlmClientConfig): string {
  return config.model ?? process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL;
}

function readLlmApiUrl(config: LlmClientConfig): string {
  if (config.apiUrl) {
    return config.apiUrl;
  }

  return GROQ_API_URL;
}

export function isLlmConfigured(config: LlmClientConfig = {}): boolean {
  return readLlmApiKeys(config).length > 0;
}

export async function analyzeTicketWithAI(
  request: AnalyzeTicketRequest,
  config: LlmClientConfig = {},
): Promise<AnalyzeTicketResponse> {
  const apiKeys = readLlmApiKeys(config);
  const model = readLlmModel(config);

  if (apiKeys.length === 0) {
    throw new Error("LLM is not configured.");
  }

  const apiUrl = readLlmApiUrl(config);
  const maxRetries = Math.min(config.maxRetries ?? DEFAULT_MAX_RETRIES, 1);
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let lastError: unknown;

  for (const apiKey of apiKeys) {
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        const content = await callChatCompletion({
          apiKey,
          apiUrl,
          model,
          request,
          timeoutMs,
        });

        return parseAnalyzeTicketResponse(content, request.ticket_id);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("LLM analysis failed.");
}

async function callChatCompletion(options: {
  apiKey: string;
  apiUrl: string;
  model: string;
  request: AnalyzeTicketRequest;
  timeoutMs: number;
}): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(options.apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        messages: buildAnalyzeTicketMessages(options.request),
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`LLM request failed with status ${response.status}.`);
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== "string" || content.trim().length === 0) {
      throw new Error("LLM returned an empty response.");
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseAnalyzeTicketResponse(
  content: string,
  ticketId: string,
): AnalyzeTicketResponse {
  const parsed = JSON.parse(extractJsonObject(content));

  if (!isRecord(parsed)) {
    throw new Error("LLM response must be a JSON object.");
  }

  const normalized: Record<string, unknown> = {
    ticket_id: readString(parsed, "ticket_id") || ticketId,
    relevant_transaction_id: readNullableString(
      parsed,
      "relevant_transaction_id",
    ),
    evidence_verdict: readString(parsed, "evidence_verdict"),
    case_type: readString(parsed, "case_type"),
    severity: readString(parsed, "severity"),
    department: readString(parsed, "department"),
    agent_summary: readString(parsed, "agent_summary"),
    recommended_next_action: readString(parsed, "recommended_next_action"),
    customer_reply: readString(parsed, "customer_reply"),
    human_review_required: readBoolean(parsed, "human_review_required"),
  };

  // Preserve optional fields if present in the LLM response
  const confidence = readNullableNumber(parsed, "confidence");
  if (confidence !== null) normalized.confidence = confidence;

  const reasonCodes = readStringArray(parsed, "reason_codes");
  if (reasonCodes !== null) normalized.reason_codes = reasonCodes;

  return analyzeTicketResponseSchema.parse(normalized);
}

function extractJsonObject(content: string): string {
  const trimmed = content.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("LLM response did not contain JSON.");
  }

  return trimmed.slice(start, end + 1);
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key];

  if (typeof value !== "string") {
    throw new Error(`LLM response field "${key}" must be a string.`);
  }

  return value;
}

function readNullableString(
  source: Record<string, unknown>,
  key: string,
): string | null {
  const value = source[key];

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`LLM response field "${key}" must be a string or null.`);
  }

  return value;
}

function readBoolean(source: Record<string, unknown>, key: string): boolean {
  const value = source[key];

  if (typeof value !== "boolean") {
    throw new Error(`LLM response field "${key}" must be a boolean.`);
  }

  return value;
}

function readNullableNumber(
  source: Record<string, unknown>,
  key: string,
): number | null {
  const value = source[key];

  if (value === undefined || value === null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  return null;
}

function readStringArray(
  source: Record<string, unknown>,
  key: string,
): string[] | null {
  const value = source[key];

  if (!Array.isArray(value)) return null;

  const strings = value.filter((item) => typeof item === "string") as string[];

  return strings.length > 0 ? strings : null;
}

