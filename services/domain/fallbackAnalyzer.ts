import type {
  AnalyzeTicketRequest,
  AnalyzeTicketResponse,
  CaseType,
  Department,
  Severity,
} from "@/schemas/apiContract";
import {
  isAgentCashInText,
  isDuplicateText,
  isMerchantSettlementText,
  isPaymentFailedText,
  isPhishingText,
  isRefundText,
  isWrongTransferText,
  normalizeComplaint,
} from "@/services/domain/normalization";

type Classification = {
  caseType: CaseType;
  department: Department;
  severity: Severity;
};

/**
 * Deterministic fallback classifier.
 *
 * Produces an initial AnalyzeTicketResponse that is then forwarded to
 * formatAnalyzeTicketResponse (which runs the evidence engine + case policy +
 * safety guardrails) — exactly the same pipeline as the AI path.
 *
 * NOTE: relevant_transaction_id / evidence_verdict / severity / department /
 * human_review_required set here are placeholders that get overridden by the
 * shared pipeline. Only case_type, agent_summary, recommended_next_action,
 * and customer_reply originate from this module.
 */
export function analyzeTicketDeterministically(
  request: AnalyzeTicketRequest,
): AnalyzeTicketResponse {
  const classification = classifyComplaint(request.complaint);

  return {
    ticket_id: request.ticket_id,
    relevant_transaction_id: null,       // overridden by evidenceEngine
    evidence_verdict: "insufficient_data", // overridden by evidenceEngine
    case_type: classification.caseType,
    severity: classification.severity,   // overridden by casePolicy
    department: classification.department, // overridden by casePolicy
    agent_summary: buildAgentSummary(classification.caseType),
    recommended_next_action: buildRecommendedAction(classification.caseType),
    customer_reply: buildCustomerReply(classification.caseType),
    human_review_required: false,        // overridden by casePolicy
  };
}

// ─────────────────────────────────────────────────────────────
//  Complaint classifier – uses shared normalization helpers
// ─────────────────────────────────────────────────────────────

function classifyComplaint(complaint: string): Classification {
  const text = normalizeComplaint(complaint);

  if (isPhishingText(text) || /\botp\b|\bpin\b/.test(text)) {
    return {
      caseType: "phishing_or_social_engineering",
      department: "fraud_risk",
      severity: "critical",
    };
  }

  if (isWrongTransferText(text)) {
    return {
      caseType: "wrong_transfer",
      department: "dispute_resolution",
      severity: "high",
    };
  }

  if (isDuplicateText(text)) {
    return {
      caseType: "duplicate_payment",
      department: "payments_ops",
      severity: "high",
    };
  }

  if (isAgentCashInText(text)) {
    return {
      caseType: "agent_cash_in_issue",
      department: "agent_operations",
      severity: "high",
    };
  }

  if (isPaymentFailedText(text)) {
    return {
      caseType: "payment_failed",
      department: "payments_ops",
      severity: "high",
    };
  }

  if (isRefundText(text)) {
    return {
      caseType: "refund_request",
      department: "customer_support",
      severity: "low",
    };
  }

  if (isMerchantSettlementText(text)) {
    return {
      caseType: "merchant_settlement_delay",
      department: "merchant_operations",
      severity: "medium",
    };
  }

  return {
    caseType: "other",
    department: "customer_support",
    severity: "low",
  };
}

// ─────────────────────────────────────────────────────────────
//  Text builders
// ─────────────────────────────────────────────────────────────

function buildAgentSummary(caseType: CaseType): string {
  const descriptions: Record<CaseType, string> = {
    wrong_transfer:
      "Customer reports sending funds to an unintended recipient. Transaction details require verification.",
    payment_failed:
      "Customer reports a failed payment that may have caused a balance deduction. Ledger investigation required.",
    refund_request:
      "Customer is requesting a refund for a completed transaction. Eligibility depends on policy.",
    duplicate_payment:
      "Customer reports being charged twice for the same transaction. Duplicate verification required.",
    merchant_settlement_delay:
      "Merchant reports a delayed settlement beyond the expected processing window.",
    agent_cash_in_issue:
      "Customer reports a cash-in transaction via agent that has not been reflected in their balance.",
    phishing_or_social_engineering:
      "Customer reports a suspicious contact requesting sensitive credentials. Likely social engineering attempt.",
    other:
      "Customer has reported an issue requiring further clarification before investigation can proceed.",
  };

  return descriptions[caseType];
}

function buildRecommendedAction(caseType: CaseType): string {
  if (caseType === "phishing_or_social_engineering") {
    return "Escalate to fraud risk team immediately. Advise the customer never to share credentials with anyone.";
  }

  if (caseType === "wrong_transfer" || caseType === "duplicate_payment") {
    return "Escalate to dispute resolution for financial authorization review per policy.";
  }

  if (caseType === "payment_failed") {
    return "Investigate transaction ledger status with payments operations. Initiate reversal if deduction is confirmed on a failed transaction.";
  }

  if (caseType === "agent_cash_in_issue") {
    return "Investigate pending cash-in status with agent operations. Confirm settlement within standard SLA.";
  }

  if (caseType === "merchant_settlement_delay") {
    return "Route to merchant operations to check batch settlement status and provide an updated ETA.";
  }

  return "Route to the appropriate operations queue and request clarifying details from the customer if needed.";
}

function buildCustomerReply(caseType: CaseType): string {
  if (caseType === "phishing_or_social_engineering") {
    return (
      "Thank you for reaching out. We never ask for your PIN, OTP, or password under any circumstances. " +
      "Please do not share these with anyone. Our team has been notified and will follow up through official channels."
    );
  }

  return (
    "Thank you for contacting support. Our team will review your case and respond through official support channels. " +
    "Please do not share your PIN or OTP with anyone."
  );
}
