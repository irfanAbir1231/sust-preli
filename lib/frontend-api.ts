import type { AnalyzeTicketRequest, AnalyzeTicketResponse } from "@/schemas/apiContract";

export async function checkHealth(): Promise<{ status: "ok" | "checking" | "unavailable" }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for health checks

  try {
    const response = await fetch("/health", {
      signal: controller.signal,
    });
    if (response.ok) {
      const data = await response.json();
      if (data && data.status === "ok") {
        return { status: "ok" };
      }
    }
    return { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  } finally {
    clearTimeout(timeoutId);
  }
}

export type APIErrorResponse = {
  code: string;
  message: string;
  issues?: Array<{ path: string; message: string }>;
};

export class AnalysisError extends Error {
  status: number;
  errorPayload?: APIErrorResponse;

  constructor(message: string, status: number, errorPayload?: APIErrorResponse) {
    super(message);
    this.name = "AnalysisError";
    this.status = status;
    this.errorPayload = errorPayload;
  }
}

export async function analyzeTicket(
  payload: AnalyzeTicketRequest,
): Promise<AnalyzeTicketResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s client timeout

  try {
    const response = await fetch("/analyze-ticket", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const isJson = response.headers.get("content-type")?.includes("application/json");
    let responseBody: any = null;

    if (isJson) {
      responseBody = await response.json();
    } else {
      responseBody = { message: await response.text() };
    }

    if (!response.ok) {
      if (responseBody && responseBody.error) {
        throw new AnalysisError(
          responseBody.error.message || "Failed to analyze ticket.",
          response.status,
          responseBody.error,
        );
      }
      throw new AnalysisError(
        responseBody.message || "Unable to analyze ticket.",
        response.status,
      );
    }

    return responseBody;
  } catch (err: any) {
    if (err instanceof AnalysisError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw new AnalysisError("Request timed out after 30 seconds.", 408);
    }
    throw new AnalysisError(err.message || "Network failure or server unavailable.", 500);
  } finally {
    clearTimeout(timeoutId);
  }
}
