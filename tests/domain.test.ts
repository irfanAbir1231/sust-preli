import { describe, expect, it, vi, afterEach } from "vitest";
import { analyzeTicketWithAI } from "../services/ai/llmClient";
import { analyzeTicketDeterministically } from "../services/domain/fallbackAnalyzer";
import { formatAnalyzeTicketResponse } from "../services/domain/dataFormatter";
import { sanitizePublicText } from "../services/domain/safetyGuard";
import type { AnalyzeTicketRequest } from "../schemas/apiContract";

const sampleCases: Array<{
  complaint: string;
  expectedCaseType: string;
  expectedDepartment: string;
}> = [
  ["Sent money to wrong number", "wrong_transfer", "dispute_resolution"],
  ["Payment failed but amount debited", "payment_failed", "payments_ops"],
  ["Need refund for my order", "refund_request", "customer_support"],
  ["Charged duplicate twice", "duplicate_payment", "payments_ops"],
  ["Merchant settlement is delayed", "merchant_settlement_delay", "merchant_operations"],
  ["Agent cash in issue", "agent_cash_in_issue", "agent_operations"],
  ["Suspicious phishing link asked for OTP", "phishing_or_social_engineering", "fraud_risk"],
  ["General account question", "other", "customer_support"],
  ["ভুল নাম্বারে টাকা পাঠিয়েছি", "wrong_transfer", "dispute_resolution"],
  ["Payment failed, টাকা কেটে গেছে", "payment_failed", "payments_ops"],
].map(([complaint, expectedCaseType, expectedDepartment]) => ({
  complaint,
  expectedCaseType,
  expectedDepartment,
}));

function request(complaint: string): AnalyzeTicketRequest {
  return {
    ticket_id: "T-SAMPLE",
    complaint,
    transaction_history: [
      {
        transaction_id: "TX-SAMPLE",
        amount: 500,
        type: "payment",
        counterparty: "Shop",
        status: "success",
      },
    ],
  };
}

describe("deterministic domain analysis", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(sampleCases)(
    "classifies public-style sample: $complaint",
    ({ complaint, expectedCaseType, expectedDepartment }) => {
      const input = request(`${complaint} 500`);
      const output = formatAnalyzeTicketResponse(
        input,
        analyzeTicketDeterministically(input),
      );

      expect(output.ticket_id).toBe(input.ticket_id);
      expect(output.case_type).toBe(expectedCaseType);
      expect(output.department).toBe(expectedDepartment);
      expect(output.customer_reply.toLowerCase()).not.toContain("provide otp");
    },
  );

  it("allows safe credential warnings", () => {
    const text = "Please do not share your PIN or OTP with anyone.";

    expect(sanitizePublicText(text)).toBe(text);
  });

  it("removes credential requests", () => {
    const text = sanitizePublicText(
      "Please provide your OTP so we can check. We will review this.",
    );

    expect(text.toLowerCase()).not.toContain("provide your otp");
    expect(text).toContain("never share your PIN");
  });

  it("replaces unsafe refund promises", () => {
    const text = sanitizePublicText("We will refund your money today.");

    expect(text).not.toContain("will refund");
    expect(text).toContain("eligible amount");
  });

  it("removes suspicious third-party instructions", () => {
    const text = sanitizePublicText("Contact us on Telegram for help.");

    expect(text.toLowerCase()).not.toContain("telegram");
    expect(text).toContain("official support channels");
  });

  it("rejects Groq timeout through the client", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string | URL | Request, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new Error("aborted"));
            });
          }),
      ),
    );

    const promise = analyzeTicketWithAI(request("Payment failed"), {
      apiKey: "test-key",
      model: "llama-3.3-70b-versatile",
      timeoutMs: 1,
      maxRetries: 0,
    });
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });
});
