import type {
  AnalyzeTicketResponse,
  CaseType,
  Department,
  EvidenceVerdict,
  Severity,
} from "@/schemas/apiContract";

const CREDENTIAL_REQUEST_PATTERN =
  /\b(?:send|share|provide|enter|disclose|reveal|give|submit|tell|confirm)\b[^.!?]*(?:pin|otp|password|passcode|full\s+card\s+number|secret\s+credentials?|security\s+code)\b/i;

const CREDENTIAL_TOPIC_PATTERN =
  /\b(?:pin|otp|password|passcode|full\s+card\s+number|secret\s+credentials?|security\s+code)\b/i;

const THIRD_PARTY_PATTERN =
  /\b(?:telegram|whatsapp|imo|messenger|facebook|third[-\s]?party|unofficial)\b/i;

const REFUND_PROMISE_REPLACEMENTS: Array<[RegExp, string]> = [
  [
    /\b(?:we|i|our\s+team)\s+(?:will|shall|can)\s+(?:refund|reverse|return|recover|unblock)\b[^.!?]*/gi,
    "Our team will review the transaction, and any eligible amount will be returned through official channels according to applicable policy",
  ],
  [
    /\b(?:refund|reversal|account\s+unblock|funds?\s+recovery)\s+(?:is|has\s+been|will\s+be)\s+(?:guaranteed|approved|confirmed|completed)\b[^.!?]*/gi,
    "Our team will review the transaction, and any eligible amount will be returned through official channels according to applicable policy",
  ],
  [
    /\byou\s+will\s+(?:get|receive|recover)\b[^.!?]*(?:refund|reversal|money|funds?)\b[^.!?]*/gi,
    "Our team will review the transaction, and any eligible amount will be returned through official channels according to applicable policy",
  ],
];

const SAFE_CREDENTIAL_WARNING =
  "For your safety, never share your PIN, OTP, password, full card number, or secret credentials with anyone.";

const OFFICIAL_CHANNELS_MESSAGE =
  "Please use only official support channels for follow-up.";

export const VALID_EVIDENCE_VERDICTS: readonly EvidenceVerdict[] = [
  "consistent",
  "inconsistent",
  "insufficient_data",
];

export const VALID_CASE_TYPES: readonly CaseType[] = [
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "duplicate_payment",
  "merchant_settlement_delay",
  "agent_cash_in_issue",
  "phishing_or_social_engineering",
  "other",
];

export const VALID_SEVERITIES: readonly Severity[] = [
  "low",
  "medium",
  "high",
  "critical",
];

export const VALID_DEPARTMENTS: readonly Department[] = [
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "merchant_operations",
  "agent_operations",
  "fraud_risk",
];

export function enforceSafetyGuardrails(
  response: AnalyzeTicketResponse,
): AnalyzeTicketResponse {
  const normalized = normalizeEnumFields(response);
  const customerReply = sanitizePublicText(normalized.customer_reply);
  const recommendedNextAction = sanitizePublicText(
    normalized.recommended_next_action,
  );

  return {
    ...normalized,
    customer_reply: customerReply,
    recommended_next_action: recommendedNextAction,
    human_review_required:
      normalized.human_review_required || requiresHumanReview(normalized),
  };
}

export function sanitizePublicText(text: string): string {
  const sentences = splitSentences(text);
  const safeSentences = sentences.filter(
    (sentence) =>
      !isUnsafeCredentialRequest(sentence) &&
      !THIRD_PARTY_PATTERN.test(sentence),
  );
  const hadCredentialRequest = sentences.some(isUnsafeCredentialRequest);
  const hadThirdPartyInstruction = sentences.some((sentence) =>
    THIRD_PARTY_PATTERN.test(sentence),
  );

  const replacedRefundPromises = replaceRefundPromises(
    safeSentences.join(" "),
  );
  let cleaned = normalizeWhitespace(replacedRefundPromises);

  if (hadCredentialRequest) {
    cleaned = appendSentence(cleaned, SAFE_CREDENTIAL_WARNING);
  }

  if (hadThirdPartyInstruction) {
    cleaned = appendSentence(cleaned, OFFICIAL_CHANNELS_MESSAGE);
  }

  return cleaned || OFFICIAL_CHANNELS_MESSAGE;
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
    case_type: pickValidValue(response.case_type, VALID_CASE_TYPES, "other"),
    severity: pickValidValue(response.severity, VALID_SEVERITIES, "medium"),
    department: pickValidValue(
      response.department,
      VALID_DEPARTMENTS,
      "customer_support",
    ),
  };
}

export function hasCredentialRisk(text: string): boolean {
  return CREDENTIAL_TOPIC_PATTERN.test(text);
}

function requiresHumanReview(response: AnalyzeTicketResponse): boolean {
  // Safety-specific escalation only: phishing and critical severity.
  // Operational escalation (wrong_transfer, duplicate_payment, etc.)
  // is handled by casePolicy.ts to avoid false overrides on ambiguous cases.
  return (
    response.case_type === "phishing_or_social_engineering" ||
    response.severity === "critical"
  );
}


function isUnsafeCredentialRequest(sentence: string): boolean {
  if (!CREDENTIAL_REQUEST_PATTERN.test(sentence)) {
    return false;
  }

  return !/\b(?:do\s+not|don't|never|not)\s+(?:send|share|provide|enter|disclose|reveal|give|submit|tell)\b/i.test(
    sentence,
  );
}

function replaceRefundPromises(text: string): string {
  return REFUND_PROMISE_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

function splitSentences(text: string): string[] {
  return text.match(/[^.!?]+[.!?]*/g) ?? [text];
}

function appendSentence(text: string, sentence: string): string {
  const cleaned = normalizeWhitespace(text);

  if (cleaned.includes(sentence)) {
    return cleaned;
  }

  return normalizeWhitespace(`${cleaned} ${sentence}`);
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
