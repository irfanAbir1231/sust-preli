import type {
  AnalyzeTicketRequest,
  EvidenceVerdict,
  TransactionHistoryItem,
} from "@/schemas/apiContract";
import {
  extractAmounts,
  isAgentCashInText,
  isWrongTransferText,
  normalizeComplaint,
  normalizeCounterparty,
} from "@/services/domain/normalization";

export interface EvidenceResult {
  relevantTransactionId: string | null;
  verdict: EvidenceVerdict;
  matchScore: number;
  ambiguous: boolean;
  reasonCodes: string[];
}

type Transaction = TransactionHistoryItem;
type History = Transaction[];

// ─────────────────────────────────────────────────────────────
//  Public entry point
// ─────────────────────────────────────────────────────────────

export function runEvidenceEngine(
  request: AnalyzeTicketRequest,
  caseType: string,
): EvidenceResult {
  const complaint = normalizeComplaint(request.complaint);
  const history = (request.transaction_history ?? []).filter(
    (t) => t.transaction_id,
  );

  if (history.length === 0) {
    return {
      relevantTransactionId: null,
      verdict: "insufficient_data",
      matchScore: 0,
      ambiguous: false,
      reasonCodes: ["no_transaction_history"],
    };
  }

  // Rule 9.3: duplicate-payment detection takes precedence when case_type is duplicate_payment
  if (caseType === "duplicate_payment") {
    return evaluateDuplicatePayment(history);
  }

  // Rule 9.4: agent cash-in pending
  if (caseType === "agent_cash_in_issue") {
    return evaluateAgentCashIn(complaint, history, request);
  }

  // Rule 9.5: merchant settlement delay
  if (caseType === "merchant_settlement_delay") {
    return evaluateMerchantSettlement(complaint, history);
  }

  // General: score every transaction and pick the best
  return evaluateGeneralEvidence(complaint, history, request, caseType);
}

// ─────────────────────────────────────────────────────────────
//  Rule 9.3 – Duplicate-payment detection
// ─────────────────────────────────────────────────────────────

function evaluateDuplicatePayment(history: History): EvidenceResult {
  const duplicate = findLikelyDuplicatePayment(history);

  if (duplicate?.transaction_id) {
    return {
      relevantTransactionId: duplicate.transaction_id,
      verdict: "consistent",
      matchScore: 10,
      ambiguous: false,
      reasonCodes: ["duplicate_payment", "biller_verification_required"],
    };
  }

  return {
    relevantTransactionId: null,
    verdict: "insufficient_data",
    matchScore: 0,
    ambiguous: true,
    reasonCodes: ["ambiguous_match", "needs_clarification"],
  };
}

/**
 * A likely duplicate requires:
 * - Both completed payments
 * - Same amount and same counterparty
 * - Timestamps within 5 minutes of each other
 * Returns the *later* transaction.
 */
export function findLikelyDuplicatePayment(
  history: History,
): Transaction | null {
  const payments = history.filter(
    (t) =>
      t.transaction_id &&
      typeof t.amount === "number" &&
      t.counterparty &&
      t.status === "completed" &&
      (t.type === "payment" || t.type === "settlement"),
  );

  for (let i = 0; i < payments.length; i++) {
    for (let j = i + 1; j < payments.length; j++) {
      const a = payments[i]!;
      const b = payments[j]!;

      if (
        a.amount === b.amount &&
        normalizeCounterparty(a.counterparty ?? "") ===
          normalizeCounterparty(b.counterparty ?? "")
      ) {
        // Check timestamps close (within 5 minutes = 300 000 ms)
        const tA = a.timestamp ? Date.parse(a.timestamp) : NaN;
        const tB = b.timestamp ? Date.parse(b.timestamp) : NaN;
        const withinWindow =
          Number.isNaN(tA) ||
          Number.isNaN(tB) ||
          Math.abs(tA - tB) <= 300_000;

        if (withinWindow) {
          // Return the later one as the suspected duplicate
          if (!Number.isNaN(tA) && !Number.isNaN(tB)) {
            return tA > tB ? a : b;
          }
          return b; // default to later index
        }
      }
    }
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
//  Rule 9.4 – Agent cash-in pending
// ─────────────────────────────────────────────────────────────

function evaluateAgentCashIn(
  complaint: string,
  history: History,
  request: AnalyzeTicketRequest,
): EvidenceResult {
  const amounts = extractAmounts(complaint);

  const cashIns = history.filter(
    (t) => t.type === "cash_in" && t.transaction_id,
  );

  if (cashIns.length === 0) {
    return {
      relevantTransactionId: null,
      verdict: "insufficient_data",
      matchScore: 0,
      ambiguous: false,
      reasonCodes: ["no_cash_in_transaction"],
    };
  }

  // Score each cash-in transaction
  const scored = cashIns
    .map((t) => ({ t, score: scoreTransaction(complaint, t, request) }))
    .sort((a, b) => b.score - a.score);

  const best = scored[0]!;
  const second = scored[1];

  if (
    best.score >= 3 &&
    (!second || best.score - second.score >= 2)
  ) {
    const verdict: EvidenceVerdict =
      best.t.status === "pending" ? "consistent" : "consistent";

    return {
      relevantTransactionId: best.t.transaction_id!,
      verdict,
      matchScore: best.score,
      ambiguous: false,
      reasonCodes: ["agent_cash_in", "pending_transaction", "agent_ops"],
    };
  }

  // Fallback: only one cash-in exists and amount matches
  if (cashIns.length === 1 && amounts.length > 0) {
    const t = cashIns[0]!;
    if (typeof t.amount === "number" && amounts.includes(t.amount)) {
      return {
        relevantTransactionId: t.transaction_id!,
        verdict: "consistent",
        matchScore: 5,
        ambiguous: false,
        reasonCodes: ["agent_cash_in", "amount_match"],
      };
    }
    // Single cash-in even without amount match is likely the right one
    return {
      relevantTransactionId: t.transaction_id!,
      verdict: "consistent",
      matchScore: 3,
      ambiguous: false,
      reasonCodes: ["agent_cash_in", "pending_transaction"],
    };
  }

  return {
    relevantTransactionId: null,
    verdict: "insufficient_data",
    matchScore: 0,
    ambiguous: true,
    reasonCodes: ["ambiguous_match"],
  };
}

// ─────────────────────────────────────────────────────────────
//  Rule 9.5 – Merchant settlement delay
// ─────────────────────────────────────────────────────────────

function evaluateMerchantSettlement(
  complaint: string,
  history: History,
): EvidenceResult {
  const settlements = history.filter(
    (t) =>
      t.transaction_id &&
      (t.type === "settlement" || t.counterparty === "MERCHANT-SELF"),
  );

  if (settlements.length === 0) {
    return {
      relevantTransactionId: null,
      verdict: "insufficient_data",
      matchScore: 0,
      ambiguous: false,
      reasonCodes: ["no_settlement_transaction"],
    };
  }

  if (settlements.length === 1) {
    return {
      relevantTransactionId: settlements[0]!.transaction_id!,
      verdict: "consistent",
      matchScore: 8,
      ambiguous: false,
      reasonCodes: ["merchant_settlement", "delay", "pending"],
    };
  }

  // Multiple settlements – try amount match
  const amounts = extractAmounts(complaint);
  const matched = settlements.find(
    (t) => typeof t.amount === "number" && amounts.includes(t.amount),
  );

  return {
    relevantTransactionId: matched?.transaction_id ?? null,
    verdict: matched ? "consistent" : "insufficient_data",
    matchScore: matched ? 8 : 0,
    ambiguous: !matched,
    reasonCodes: matched
      ? ["merchant_settlement", "amount_match"]
      : ["ambiguous_match"],
  };
}

// ─────────────────────────────────────────────────────────────
//  General evidence evaluation (Phases 9.1, 9.2, default)
// ─────────────────────────────────────────────────────────────

function evaluateGeneralEvidence(
  complaint: string,
  history: History,
  request: AnalyzeTicketRequest,
  caseType: string,
): EvidenceResult {
  const scored = history
    .filter((t) => t.transaction_id)
    .map((t) => ({ t, score: scoreTransaction(complaint, t, request) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return noMatch();
  }

  const best = scored[0]!;
  const second = scored[1];

  // Ambiguity check: two transactions with similar scores
  if (best.score < 3) return noMatch();

  if (second && best.score - second.score < 2) {
    return {
      relevantTransactionId: null,
      verdict: "insufficient_data",
      matchScore: best.score,
      ambiguous: true,
      reasonCodes: ["ambiguous_match", "needs_clarification"],
    };
  }

  const txId = best.t.transaction_id!;

  // Rule 9.2 – Failed payment: transaction status=failed and complaint says failed/deducted
  if (
    caseType === "payment_failed" &&
    best.t.status === "failed" &&
    /failed|fail|deducted|কেটে/.test(complaint)
  ) {
    return {
      relevantTransactionId: txId,
      verdict: "consistent",
      matchScore: best.score,
      ambiguous: false,
      reasonCodes: ["payment_failed", "possible_balance_deduction"],
    };
  }

  // Rule 9.1 – Established-recipient contradiction for wrong transfers
  if (isWrongTransferText(complaint) || caseType === "wrong_transfer") {
    const establishedPattern = hasEstablishedRecipient(
      best.t,
      request.transaction_history ?? [],
    );

    if (establishedPattern) {
      return {
        relevantTransactionId: txId,
        verdict: "inconsistent",
        matchScore: best.score,
        ambiguous: false,
        reasonCodes: [
          "wrong_transfer_claim",
          "established_recipient_pattern",
          "evidence_inconsistent",
        ],
      };
    }
  }

  // Default: evidence is consistent
  return {
    relevantTransactionId: txId,
    verdict: "consistent",
    matchScore: best.score,
    ambiguous: false,
    reasonCodes: ["transaction_id_match"],
  };
}

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

function noMatch(): EvidenceResult {
  return {
    relevantTransactionId: null,
    verdict: "insufficient_data",
    matchScore: 0,
    ambiguous: false,
    reasonCodes: ["no_matching_transaction"],
  };
}

function scoreTransaction(
  complaint: string,
  t: Transaction,
  request: AnalyzeTicketRequest,
): number {
  let score = 0;

  // Explicit transaction ID in complaint – strongest signal
  if (
    t.transaction_id &&
    complaint.includes(t.transaction_id.toLowerCase())
  ) {
    score += 8;
  }

  // Amount match
  if (
    typeof t.amount === "number" &&
    extractAmounts(complaint).includes(t.amount)
  ) {
    score += 3;
  }

  // Type match signals (cash_in with Bangla/English keywords)
  if (t.type === "cash_in" && isAgentCashInText(complaint)) {
    score += 3;
  }

  // Counterparty / type / status keyword match
  for (const field of ["type", "counterparty", "status"] as const) {
    const val = t[field];
    if (val && complaint.includes(String(val).toLowerCase().replace(/_/g, " "))) {
      score += 2;
    }
  }

  // Date match
  if (t.timestamp) {
    const date = t.timestamp.slice(0, 10);
    if (complaint.includes(date)) score += 2;
  }

  return score;
}

/** Rule 9.1 – Three or more prior transfers to the same counterparty. */
function hasEstablishedRecipient(
  tx: Transaction,
  history: Transaction[],
): boolean {
  if (!tx.counterparty) return false;

  const matches = history.filter(
    (t) =>
      t.counterparty &&
      normalizeCounterparty(t.counterparty) ===
        normalizeCounterparty(tx.counterparty!),
  );

  return matches.length >= 3;
}
