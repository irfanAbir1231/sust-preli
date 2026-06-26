import { NextResponse } from "next/server";
import {
  type AnalyzeTicketRequest,
  type AnalyzeTicketResponse,
  type ValidationIssue,
  validateAnalyzeTicketRequest,
} from "@/schemas/apiContract";
import {
  analyzeTicketWithAI,
  isLlmConfigured,
} from "@/services/ai/llmClient";
import { formatAnalyzeTicketResponse } from "@/services/domain/dataFormatter";

export const maxDuration = 30;

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    issues?: ValidationIssue[];
  };
};

function json<T>(body: T, status: number) {
  return NextResponse.json(body, { status });
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

function buildFallbackAnalysis(
  request: AnalyzeTicketRequest,
): AnalyzeTicketResponse {
  return {
    ticket_id: request.ticket_id,
    relevant_transaction_id: null,
    evidence_verdict: "insufficient_data",
    case_type: "general_support",
    severity: "medium",
    department: "support",
    agent_summary:
      "The ticket was received and validated, but automated analysis is not configured yet.",
    recommended_next_action:
      "Route this ticket to a human support agent for review.",
    customer_reply:
      "Thanks for contacting support. We have received your complaint and will review it through official support channels.",
    human_review_required: true,
  };
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);

    if (body === undefined) {
      return json<ErrorResponse>(
        {
          error: {
            code: "malformed_json",
            message: "Request body must be valid JSON.",
          },
        },
        400,
      );
    }

    const validation = validateAnalyzeTicketRequest(body);

    if (!validation.success) {
      return json<ErrorResponse>(
        {
          error: {
            code: "invalid_request",
            message: "Request body does not match the API contract.",
            issues: validation.issues,
          },
        },
        422,
      );
    }

    let analysis = buildFallbackAnalysis(validation.data);

    if (isLlmConfigured()) {
      try {
        analysis = await analyzeTicketWithAI(validation.data);
      } catch (error) {
        console.error(
          "Internal Groq Error:",
          error instanceof Error ? error.message : "Unknown error",
        );

        return json<ErrorResponse>(
          {
            error: {
              code: "internal_groq_error",
              message: "An internal error occurred during processing.",
            },
          },
          500,
        );
      }
    }

    return json<AnalyzeTicketResponse>(
      formatAnalyzeTicketResponse(analysis),
      200,
    );
  } catch {
    return json<ErrorResponse>(
      {
        error: {
          code: "internal_error",
          message: "The request could not be processed safely.",
        },
      },
      422,
    );
  }
}
