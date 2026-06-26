import type {
  AnalyzeTicketRequest,
  AnalyzeTicketResponse,
  CaseType,
  Department,
  Severity,
} from "@/schemas/apiContract";
import type { EvidenceResult } from "@/services/domain/evidenceEngine";

// ─────────────────────────────────────────────────────────────
//  Policy table constants
// ─────────────────────────────────────────────────────────────

const POLICY: Record<
  CaseType,
  {
    department: Department;
    severity: Severity;
    humanReview: boolean;
  }
> = {
  wrong_transfer: {
    department: "dispute_resolution",
    severity: "high",
    humanReview: true,
  },
  payment_failed: {
    department: "payments_ops",
    severity: "high",
    humanReview: false,
  },
  refund_request: {
    department: "customer_support",
    severity: "low",
    humanReview: false,
  },
  duplicate_payment: {
    department: "payments_ops",
    severity: "high",
    humanReview: true,
  },
  merchant_settlement_delay: {
    department: "merchant_operations",
    severity: "medium",
    humanReview: false,
  },
  agent_cash_in_issue: {
    department: "agent_operations",
    severity: "high",
    humanReview: true,
  },
  phishing_or_social_engineering: {
    department: "fraud_risk",
    severity: "critical",
    humanReview: true,
  },
  other: {
    department: "customer_support",
    severity: "low",
    humanReview: false,
  },
};

// ─────────────────────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────────────────────

/**
 * Applies deterministic case policy to the response, overriding fields
 * that Groq may have gotten wrong:  severity, department, human_review_required.
 */
export function applyCasePolicy(
  request: AnalyzeTicketRequest,
  response: AnalyzeTicketResponse,
  evidence: EvidenceResult,
): AnalyzeTicketResponse {
  const caseType = response.case_type;
  const base = POLICY[caseType];

  const department = base.department;
  const severity = resolveSeverity(caseType, evidence, base.severity);
  const humanReview = resolveHumanReview(
    caseType,
    evidence,
    request,
    base.humanReview,
  );

  return {
    ...response,
    relevant_transaction_id: evidence.relevantTransactionId,
    evidence_verdict: evidence.verdict,
    department,
    severity,
    human_review_required: humanReview,
    reason_codes:
      evidence.reasonCodes.length > 0 ? evidence.reasonCodes : response.reason_codes,
    confidence: resolveConfidence(evidence),
  };
}

// ─────────────────────────────────────────────────────────────
//  Internal resolution helpers
// ─────────────────────────────────────────────────────────────

function resolveSeverity(
  caseType: CaseType,
  evidence: EvidenceResult,
  defaultSeverity: Severity,
): Severity {
  // Wrong-transfer: established-recipient contradiction OR no/ambiguous transaction ID → medium
  if (caseType === "wrong_transfer") {
    if (
      evidence.relevantTransactionId === null ||
      evidence.reasonCodes.includes("established_recipient_pattern")
    ) {
      return "medium";
    }
  }

  // Phishing is always critical
  if (caseType === "phishing_or_social_engineering") return "critical";

  return defaultSeverity;
}

function resolveHumanReview(
  caseType: CaseType,
  evidence: EvidenceResult,
  request: AnalyzeTicketRequest,
  defaultHumanReview: boolean,
): boolean {
  // Phishing is always true
  if (caseType === "phishing_or_social_engineering") return true;

  // Duplicate payment always needs review
  if (caseType === "duplicate_payment") return true;

  // Agent cash-in always needs review
  if (caseType === "agent_cash_in_issue") return true;

  // Wrong transfer:
  //   - confirmed (has a transaction id) → true
  //   - ambiguous / no match (needs clarification only) → false
  if (caseType === "wrong_transfer") {
    return evidence.relevantTransactionId !== null;
  }

  // Inconsistent evidence (established-recipient contradiction etc.) → true
  if (evidence.verdict === "inconsistent") return true;

  // Payment failed: routine ops workflow → false
  if (caseType === "payment_failed") return false;

  // Refund request: only escalate if contested (inconsistent evidence)
  if (caseType === "refund_request") return false;

  // Merchant settlement: routine → false
  if (caseType === "merchant_settlement_delay") return false;

  // Vague / other: no match → false
  if (caseType === "other" && evidence.relevantTransactionId === null)
    return false;

  return defaultHumanReview;
}

function resolveConfidence(evidence: EvidenceResult): number {
  if (evidence.reasonCodes.includes("phishing_detected")) return 0.95;
  if (evidence.reasonCodes.includes("transaction_id_match")) return 0.92;
  if (evidence.reasonCodes.includes("duplicate_payment")) return 0.92;
  if (evidence.reasonCodes.includes("established_recipient_pattern")) return 0.75;
  if (evidence.reasonCodes.includes("agent_cash_in")) return 0.88;
  if (evidence.reasonCodes.includes("merchant_settlement")) return 0.9;
  if (evidence.matchScore >= 8) return 0.92;
  if (evidence.matchScore >= 5) return 0.82;
  if (evidence.matchScore >= 3) return 0.72;
  if (evidence.ambiguous) return 0.6;
  return 0.55;
}
