import {
  type AnalyzeTicketResponse,
  type ValidationIssue,
  validateAnalyzeTicketRequest,
  validateAnalyzeTicketResponse,
} from "@/schemas/apiContract";
import {
  analyzeTicketWithAI,
  isLlmConfigured,
} from "@/services/ai/llmClient";
import { analyzeTicketDeterministically } from "@/services/domain/fallbackAnalyzer";
import { formatAnalyzeTicketResponse } from "@/services/domain/dataFormatter";

export const maxDuration = 30;

type ErrorResponse = {
  error: {
    code: string;
    message: string;
    issues?: ValidationIssue[];
  };
};

const MALFORMED_JSON = Symbol("malformed_json");

function json<T>(body: T, status: number) {
  return Response.json(body, { status });
}

async function readJson(request: Request): Promise<unknown | typeof MALFORMED_JSON> {
  try {
    return await request.json();
  } catch {
    return MALFORMED_JSON;
  }
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);

    if (body === MALFORMED_JSON) {
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
        400,
      );
    }

    if (validation.data.complaint.trim().length === 0) {
      return json<ErrorResponse>(
        {
          error: {
            code: "empty_complaint",
            message: "Complaint cannot be empty.",
            issues: [
              {
                path: "complaint",
                message: "Complaint cannot be empty or whitespace only.",
              },
            ],
          },
        },
        422,
      );
    }

    let analysis: AnalyzeTicketResponse | null = null;

    if (isLlmConfigured()) {
      try {
        analysis = await analyzeTicketWithAI(validation.data);
      } catch {
        analysis = null;
      }
    }

    const fallbackAnalysis = () =>
      formatAnalyzeTicketResponse(
        validation.data,
        analyzeTicketDeterministically(validation.data),
      );

    try {
      const finalResponse = analysis
        ? formatAnalyzeTicketResponse(validation.data, analysis)
        : fallbackAnalysis();
      const finalValidation = validateAnalyzeTicketResponse(finalResponse);

      if (finalValidation.success) {
        return json<AnalyzeTicketResponse>(finalValidation.data, 200);
      }

      const fallbackResponse = fallbackAnalysis();
      const fallbackValidation = validateAnalyzeTicketResponse(fallbackResponse);

      if (fallbackValidation.success) {
        return json<AnalyzeTicketResponse>(fallbackValidation.data, 200);
      }
    } catch {
      try {
        const fallbackResponse = fallbackAnalysis();
        const fallbackValidation = validateAnalyzeTicketResponse(fallbackResponse);

        if (fallbackValidation.success) {
          return json<AnalyzeTicketResponse>(fallbackValidation.data, 200);
        }
      } catch {
        // Final controlled 500 is below.
      }
    }

    return json<ErrorResponse>(
      {
        error: {
          code: "internal_error",
          message: "An internal error occurred during processing.",
        },
      },
      500,
    );
  } catch {
    return json<ErrorResponse>(
      {
        error: {
          code: "internal_error",
          message: "An internal error occurred during processing.",
        },
      },
      500,
    );
  }
}
