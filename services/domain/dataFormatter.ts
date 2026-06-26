import {
  type AnalyzeTicketRequest,
  type AnalyzeTicketResponse,
  analyzeTicketResponseSchema,
} from "@/schemas/apiContract";
import { enforceSafetyGuardrails } from "@/services/domain/safetyGuard";

export function formatAnalyzeTicketResponse(
  request: AnalyzeTicketRequest,
  response: AnalyzeTicketResponse,
): AnalyzeTicketResponse {
  const evidenceCorrected = enforceEvidenceGrounding(request, {
    ...response,
    ticket_id: request.ticket_id,
  });
  const safeResponse = enforceSafetyGuardrails(evidenceCorrected);

  return analyzeTicketResponseSchema.parse(safeResponse);
}

function enforceEvidenceGrounding(
  request: AnalyzeTicketRequest,
  response: AnalyzeTicketResponse,
): AnalyzeTicketResponse {
  const history = request.transaction_history ?? [];
  const selectedId = response.relevant_transaction_id;

  if (!selectedId || history.length === 0) {
    return {
      ...response,
      relevant_transaction_id: null,
      evidence_verdict:
        response.evidence_verdict === "inconsistent"
          ? "inconsistent"
          : "insufficient_data",
    };
  }

  const selectedTransaction = history.find(
    (transaction) => transaction.transaction_id === selectedId,
  );

  if (!selectedTransaction) {
    return {
      ...response,
      relevant_transaction_id: null,
      evidence_verdict: "insufficient_data",
    };
  }

  const scored = history
    .filter((transaction) => transaction.transaction_id)
    .map((transaction) => ({
      id: transaction.transaction_id ?? "",
      score: scoreTransactionMatch(request.complaint, transaction),
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const second = scored[1];
  const selectedScore =
    scored.find((transaction) => transaction.id === selectedId)?.score ?? 0;

  if (
    !best ||
    (best.id !== selectedId && response.case_type !== "duplicate_payment") ||
    selectedScore < 3 ||
    (second &&
      best.score - second.score < 2 &&
      response.case_type !== "duplicate_payment")
  ) {
    return {
      ...response,
      relevant_transaction_id: null,
      evidence_verdict: "insufficient_data",
    };
  }

  return response;
}

function scoreTransactionMatch(
  complaint: string,
  transaction: NonNullable<AnalyzeTicketRequest["transaction_history"]>[number],
): number {
  const normalizedComplaint = complaint.toLowerCase();
  let score = 0;

  if (
    transaction.transaction_id &&
    normalizedComplaint.includes(transaction.transaction_id.toLowerCase())
  ) {
    score += 8;
  }

  if (
    typeof transaction.amount === "number" &&
    extractAmounts(normalizedComplaint).includes(transaction.amount)
  ) {
    score += 3;
  }

  if (transaction.type === "cash_in" && /cash\s*in|cashin|ক্যাশ/.test(normalizedComplaint)) {
    score += 3;
  }

  for (const field of ["type", "counterparty", "status"] as const) {
    const value = transaction[field];
    if (value && normalizedComplaint.includes(value.toLowerCase().replace("_", " "))) {
      score += 2;
    }
  }

  if (transaction.timestamp) {
    const date = transaction.timestamp.slice(0, 10).toLowerCase();
    if (date && normalizedComplaint.includes(date)) {
      score += 2;
    }
  }

  return score;
}

function extractAmounts(text: string): number[] {
  const normalized = normalizeBanglaDigits(text);

  return Array.from(normalized.matchAll(/\d+(?:\.\d+)?/g), ([match]) =>
    Number(match),
  ).filter(Number.isFinite);
}

function normalizeBanglaDigits(text: string): string {
  const banglaDigits = "০১২৩৪৫৬৭৮৯";

  return text.replace(/[০-৯]/g, (digit) =>
    String(banglaDigits.indexOf(digit)),
  );
}
