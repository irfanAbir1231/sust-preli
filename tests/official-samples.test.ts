import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
    confidence?: number;
    reason_codes?: string[];
  };
  rationale: string;
};

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/analyze-ticket", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("official public sample cases (Groq Mocked)", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "mock-groq-key";
    process.env.GROQ_MODEL = "llama-3.3-70b-versatile";
  });

  afterEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GROQ_MODEL;
    vi.unstubAllGlobals();
  });

  it.each((samplePack.cases as OfficialSampleCase[]).map((sample) => [sample.id, sample]))(
    "%s checks functional equivalence",
    async (_id, sample) => {
      // Mock Groq API fetch call to return the expected output fields
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    ticket_id: sample.expected_output.ticket_id,
                    relevant_transaction_id: sample.expected_output.relevant_transaction_id,
                    evidence_verdict: sample.expected_output.evidence_verdict,
                    case_type: sample.expected_output.case_type,
                    severity: sample.expected_output.severity,
                    department: sample.expected_output.department,
                    agent_summary: "Mock summary of the complaint.",
                    recommended_next_action: "Mock next action per policy.",
                    customer_reply: "Mock customer reply. Please do not share OTP.",
                    human_review_required: sample.expected_output.human_review_required,
                  }),
                },
              },
            ],
          }),
        ),
      );

      const response = await POST(jsonRequest(sample.input));
      expect(response.status).toBe(200);

      const body = await response.json();
      const expected = sample.expected_output;

      const errors: string[] = [];

      const assertField = (field: keyof typeof expected) => {
        const actualVal = body[field];
        const expectedVal = expected[field];
        if (actualVal !== expectedVal) {
          errors.push(
            `\nCase ID: ${sample.id} (${sample.label})\nField: "${field}"\nExpected: ${JSON.stringify(
              expectedVal,
            )}\nActual: ${JSON.stringify(
              actualVal,
            )}\nRationale: ${sample.rationale}\n`,
          );
        }
      };

      assertField("ticket_id");
      assertField("relevant_transaction_id");
      assertField("evidence_verdict");
      assertField("case_type");
      assertField("severity");
      assertField("department");
      assertField("human_review_required");

      if (errors.length > 0) {
        throw new Error(errors.join("\n"));
      }
    },
  );
});

