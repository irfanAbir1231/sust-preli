import { afterEach, describe, expect, it } from "vitest";
import { POST } from "../app/analyze-ticket/route";
import samplePack from "./fixtures/SUST_Preli_Sample_Cases.json";

type OfficialSampleCase = {
  id: string;
  label: string;
  input: Record<string, unknown>;
  expected_output: {
    ticket_id: string;
    relevant_transaction_id: string | null;
    evidence_verdict: string;
    case_type: string;
    severity: string;
    department: string;
    human_review_required: boolean;
  };
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/analyze-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function severityRank(severity: string): number {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity] ?? 0;
}

function expectSafeText(value: unknown) {
  const text = String(value).toLowerCase();

  expect(text).not.toMatch(/\b(?:send|share|provide|enter|disclose|reveal)\b[^.!?]*(?:pin|otp|password|full card number)/);
  expect(text).not.toMatch(/\b(?:we|our team)\s+will\s+(?:refund|reverse|recover|unblock)\b/);
}

describe("official public sample cases", () => {
  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
  });

  it.each((samplePack.cases as OfficialSampleCase[]).map((sample) => [sample.id, sample]))(
    "%s returns functionally equivalent fields",
    async (_id, sample) => {
      const response = await POST(jsonRequest(sample.input));
      const body = await response.json();
      const expected = sample.expected_output;

      expect(response.status).toBe(200);
      expect(body.ticket_id).toBe(expected.ticket_id);
      expect(body.relevant_transaction_id).toBe(expected.relevant_transaction_id);
      expect(body.evidence_verdict).toBe(expected.evidence_verdict);
      expect(body.case_type).toBe(expected.case_type);
      expect(body.department).toBe(expected.department);
      expect(Math.abs(severityRank(String(body.severity)) - severityRank(expected.severity))).toBeLessThanOrEqual(1);

      if (
        expected.human_review_required ||
        expected.case_type === "phishing_or_social_engineering" ||
        expected.case_type === "wrong_transfer"
      ) {
        expect(body.human_review_required).toBe(true);
      }

      expectSafeText(body.customer_reply);
      expectSafeText(body.recommended_next_action);
    },
  );
});
