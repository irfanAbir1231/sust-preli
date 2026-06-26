import { describe, expect, it, vi, afterEach } from "vitest";
import { POST } from "../app/analyze-ticket/route";
import { isLlmConfigured } from "../services/ai/llmClient";

// Mock the AI module to verify that no LLM call is made for invalid enums.
vi.mock("../services/ai/llmClient", async (importOriginal) => {
  const original = await importOriginal<typeof import("../services/ai/llmClient")>();
  return {
    ...original,
    analyzeTicketWithAI: vi.fn().mockImplementation(() => {
      throw new Error("LLM should not be called for invalid requests!");
    }),
  };
});

function jsonRequest(payload: Record<string, unknown>): Request {
  return new Request("http://localhost/analyze-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function readJson(response: Response) {
  return response.json();
}

describe("strict validation request test suite", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("accepts valid request with standard enums", async () => {
    const response = await POST(
      jsonRequest({
        ticket_id: "T-VALID-1",
        complaint: "I sent money to the wrong recipient.",
        language: "en",
        channel: "in_app_chat",
        user_type: "customer",
        transaction_history: [
          {
            transaction_id: "TX-1",
            timestamp: "2026-06-26T10:00:00Z",
            type: "transfer",
            amount: 1000,
            counterparty: "+8801712001122",
            status: "completed",
          },
        ],
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");
  });

  it("accepts valid request with omitted optional fields", async () => {
    const response = await POST(
      jsonRequest({
        ticket_id: "T-VALID-2",
        complaint: "No transaction history, just a general question",
      }),
    );
    expect(response.status).toBe(200);
  });

  it("rejects invalid language with HTTP 400", async () => {
    const response = await POST(
      jsonRequest({
        ticket_id: "T-INVALID-1",
        complaint: "Test",
        language: "bangla", // invalid enum value
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.issues).toContainEqual(
      expect.objectContaining({
        path: "language",
      }),
    );
    // Controlled error verification: no stack traces, raw zod errors, or implementation details
    expect(body.stack).toBeUndefined();
    expect(body.error.issues[0].path).toBe("language");
  });

  it("rejects invalid channel with HTTP 400", async () => {
    const response = await POST(
      jsonRequest({
        ticket_id: "T-INVALID-2",
        complaint: "Test",
        channel: "whatsapp", // invalid enum value
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.error.issues).toContainEqual(
      expect.objectContaining({
        path: "channel",
      }),
    );
  });

  it("rejects invalid user type with HTTP 400", async () => {
    const response = await POST(
      jsonRequest({
        ticket_id: "T-INVALID-3",
        complaint: "Test",
        user_type: "not-an-enum", // invalid enum value
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.error.issues).toContainEqual(
      expect.objectContaining({
        path: "user_type",
      }),
    );
  });

  it("rejects invalid transaction type with HTTP 400", async () => {
    const response = await POST(
      jsonRequest({
        ticket_id: "T-INVALID-4",
        complaint: "Test",
        transaction_history: [
          {
            transaction_id: "TXN-1",
            type: "cash in", // invalid enum value (must be cash_in)
            status: "completed",
          },
        ],
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.error.issues).toContainEqual(
      expect.objectContaining({
        path: "transaction_history.0.type",
      }),
    );
  });

  it("rejects invalid transaction status with HTTP 400", async () => {
    const response = await POST(
      jsonRequest({
        ticket_id: "T-INVALID-5",
        complaint: "Test",
        transaction_history: [
          {
            transaction_id: "TXN-1",
            type: "cash_in",
            status: "success", // invalid enum value (must be completed)
          },
        ],
      }),
    );
    const body = await readJson(response);
    expect(response.status).toBe(400);
    expect(body.error.issues).toContainEqual(
      expect.objectContaining({
        path: "transaction_history.0.status",
      }),
    );
  });
});
