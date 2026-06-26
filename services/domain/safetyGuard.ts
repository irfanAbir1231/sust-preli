import type { AnalyzeTicketResponse } from "@/schemas/apiContract";

const CREDENTIAL_REQUEST_PATTERN =
  /\b(?:pin|otp|password|passcode|secret\s+code|security\s+code)\b/i;

const REFUND_PROMISE_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /\bwe\s+(?:will|shall|can)\s+(?:refund|reverse|return)\s+(?:you|your|the)?\s*(?:money|amount|payment|funds)?\b/gi,
    "any eligible amount will be returned through official channels",
  ],
  [
    /\byou\s+will\s+(?:be\s+)?(?:get|receive)\s+(?:a\s+)?(?:refund|reversal)\b/gi,
    "any eligible amount will be returned through official channels",
  ],
  [
    /\b(?:refund|reversal)\s+(?:is|has\s+been)\s+(?:guaranteed|approved|confirmed)\b/gi,
    "any eligible amount will be returned through official channels",
  ],
];

const SAFE_CREDENTIAL_WARNING =
  "For your safety, never share your PIN, OTP, password, or secret credentials with anyone.";

const HUMAN_REVIEW_CASE_TYPES = new Set([
  "phishing",
  "fraud",
  "account_takeover",
  "unauthorized_transaction",
]);

export const VALID_EVIDENCE_VERDICTS = [
  "consistent",
  "inconsistent",
  "insufficient_data",
] as const;

export const VALID_SEVERITIES = ["low", "medium", "high", "critical"] as const;

export const VALID_DEPARTMENTS = [
  "support",
  "fraud",
  "risk",
  "compliance",
  "operations",
] as const;

export const VALID_CASE_TYPES = [
  "general_support",
  "failed_transaction",
  "unauthorized_transaction",
  "refund_request",
  "phishing",
  "account_access",
  "campaign_issue",
] as const;

export function enforceSafetyGuardrails(
  llmResponse: AnalyzeTicketResponse,
): AnalyzeTicketResponse {
  const normalized = normalizeEnumFields(llmResponse);
  const customerReply = sanitizeCustomerReply(normalized.customer_reply);

  return {
    ...normalized,
    customer_reply: customerReply,
    human_review_required:
      normalized.human_review_required ||
      HUMAN_REVIEW_CASE_TYPES.has(normalized.case_type) ||
      normalized.severity === "critical",
  };
}

export function sanitizeCustomerReply(customerReply: string): string {
  const withoutCredentialRequests =
    removeCredentialRequestSentences(customerReply);
  const withoutRefundPromises = replaceRefundPromises(
    withoutCredentialRequests,
  );
  const cleaned = normalizeWhitespace(withoutRefundPromises);

  if (CREDENTIAL_REQUEST_PATTERN.test(customerReply)) {
    return appendSafetyWarning(cleaned);
  }

  return cleaned;
}

export function normalizeEnumFields(
  response: AnalyzeTicketResponse,
): AnalyzeTicketResponse {
  return {
    ...response,
    evidence_verdict: pickValidValue(
      response.evidence_verdict,
      VALID_EVIDENCE_VERDICTS,
      "insufficient_data",
    ),
    case_type: pickValidValue(
      response.case_type,
      VALID_CASE_TYPES,
      "general_support",
    ),
    severity: pickValidValue(response.severity, VALID_SEVERITIES, "medium"),
    department: pickValidValue(
      response.department,
      VALID_DEPARTMENTS,
      "support",
    ),
  };
}

function removeCredentialRequestSentences(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const safeSentences = sentences.filter(
    (sentence) => !CREDENTIAL_REQUEST_PATTERN.test(sentence),
  );

  return safeSentences.join(" ");
}

function replaceRefundPromises(text: string): string {
  return REFUND_PROMISE_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

function appendSafetyWarning(text: string): string {
  const cleaned = normalizeWhitespace(text);

  if (cleaned.length === 0) {
    return SAFE_CREDENTIAL_WARNING;
  }

  if (cleaned.includes(SAFE_CREDENTIAL_WARNING)) {
    return cleaned;
  }

  return `${cleaned} ${SAFE_CREDENTIAL_WARNING}`;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function pickValidValue<T extends readonly string[]>(
  value: string,
  validValues: T,
  fallback: T[number],
): T[number] {
  return validValues.includes(value) ? value : fallback;
}
