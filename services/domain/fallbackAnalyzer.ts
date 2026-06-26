import type {
  AnalyzeTicketRequest,
  AnalyzeTicketResponse,
  CaseType,
  Department,
  Severity,
} from "@/schemas/apiContract";
import { hasCredentialRisk } from "@/services/domain/safetyGuard";

type Classification = {
  caseType: CaseType;
  department: Department;
  severity: Severity;
};

export function analyzeTicketDeterministically(
  request: AnalyzeTicketRequest,
): AnalyzeTicketResponse {
  const classification = classifyComplaint(request.complaint);
  const relevantTransactionId = findClearRelevantTransaction(request);
  const evidenceVerdict = relevantTransactionId
    ? inferEvidenceVerdict(request, relevantTransactionId)
    : "insufficient_data";
  const humanReviewRequired =
    classification.caseType === "phishing_or_social_engineering" ||
    classification.caseType === "wrong_transfer" ||
    classification.severity === "high" ||
    classification.severity === "critical" ||
    evidenceVerdict !== "consistent";

  return {
    ticket_id: request.ticket_id,
    relevant_transaction_id: relevantTransactionId,
    evidence_verdict: evidenceVerdict,
    case_type: classification.caseType,
    severity: classification.severity,
    department: classification.department,
    agent_summary: buildAgentSummary(classification.caseType, evidenceVerdict),
    recommended_next_action: buildRecommendedAction(classification.caseType),
    customer_reply:
      "Thanks for contacting support. Our team will review the transaction and respond through official support channels.",
    human_review_required: humanReviewRequired,
  };
}

function classifyComplaint(complaint: string): Classification {
  const text = complaint.toLowerCase();

  if (hasCredentialRisk(text) || /phish|scam|fraud|link|password|otp|pin/.test(text)) {
    return {
      caseType: "phishing_or_social_engineering",
      department: "fraud_risk",
      severity: "critical",
    };
  }

  if (/wrong|mistake|mistaken|sent.*wrong|ভুল/.test(text)) {
    return {
      caseType: "wrong_transfer",
      department: "dispute_resolution",
      severity: "high",
    };
  }

  if (/duplicate|twice|double|দুইবার/.test(text)) {
    return {
      caseType: "duplicate_payment",
      department: "payments_ops",
      severity: "high",
    };
  }

  if (/refund|return|reversal|ফেরত/.test(text)) {
    return {
      caseType: "refund_request",
      department: "dispute_resolution",
      severity: "medium",
    };
  }

  if (/merchant|settlement|settled|মার্চেন্ট/.test(text)) {
    return {
      caseType: "merchant_settlement_delay",
      department: "merchant_operations",
      severity: "medium",
    };
  }

  if (/agent|cash\s*in|cashin|ক্যাশ/.test(text)) {
    return {
      caseType: "agent_cash_in_issue",
      department: "agent_operations",
      severity: "medium",
    };
  }

  if (/failed|fail|pending|declined|timeout|ব্যর্থ/.test(text)) {
    return {
      caseType: "payment_failed",
      department: "payments_ops",
      severity: "medium",
    };
  }

  return {
    caseType: "other",
    department: "customer_support",
    severity: "low",
  };
}

function findClearRelevantTransaction(
  request: AnalyzeTicketRequest,
): string | null {
  const history = request.transaction_history ?? [];

  if (history.length === 0) {
    return null;
  }

  const scored = history
    .filter((transaction) => transaction.transaction_id)
    .map((transaction) => ({
      transaction,
      score: scoreTransaction(request.complaint, transaction),
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  const second = scored[1];

  if (!best || best.score < 3 || (second && best.score - second.score < 2)) {
    return null;
  }

  return best.transaction.transaction_id ?? null;
}

function inferEvidenceVerdict(
  request: AnalyzeTicketRequest,
  transactionId: string,
): AnalyzeTicketResponse["evidence_verdict"] {
  const transaction = request.transaction_history?.find(
    (item) => item.transaction_id === transactionId,
  );
  const complaint = request.complaint.toLowerCase();

  if (!transaction) {
    return "insufficient_data";
  }

  if (
    /failed|declined|pending|ব্যর্থ/.test(complaint) &&
    transaction.status &&
    /success|completed/i.test(transaction.status)
  ) {
    return "inconsistent";
  }

  return "consistent";
}

function scoreTransaction(
  complaint: string,
  transaction: NonNullable<AnalyzeTicketRequest["transaction_history"]>[number],
): number {
  const text = complaint.toLowerCase();
  let score = 0;

  if (
    transaction.transaction_id &&
    text.includes(transaction.transaction_id.toLowerCase())
  ) {
    score += 8;
  }

  if (
    typeof transaction.amount === "number" &&
    extractAmounts(text).includes(transaction.amount)
  ) {
    score += 3;
  }

  for (const field of ["type", "counterparty", "status"] as const) {
    const value = transaction[field];
    if (value && text.includes(value.toLowerCase())) {
      score += 2;
    }
  }

  return score;
}

function extractAmounts(text: string): number[] {
  return Array.from(text.matchAll(/\d+(?:\.\d+)?/g), ([match]) =>
    Number(match),
  ).filter(Number.isFinite);
}

function buildAgentSummary(
  caseType: CaseType,
  evidenceVerdict: AnalyzeTicketResponse["evidence_verdict"],
): string {
  return `Deterministic analysis classified the ticket as ${caseType} with ${evidenceVerdict} transaction evidence.`;
}

function buildRecommendedAction(caseType: CaseType): string {
  if (caseType === "phishing_or_social_engineering") {
    return "Escalate to fraud risk review and advise the customer to use only official support channels.";
  }

  if (caseType === "wrong_transfer" || caseType === "duplicate_payment") {
    return "Escalate to dispute resolution for human financial authorization review.";
  }

  return "Route to the responsible operations queue for review.";
}
