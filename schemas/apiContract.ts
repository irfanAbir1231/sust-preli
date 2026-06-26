import { z } from "zod";

export const evidenceVerdictSchema = z.enum([
  "consistent",
  "inconsistent",
  "insufficient_data",
]);

export const caseTypeSchema = z.enum([
  "wrong_transfer",
  "payment_failed",
  "refund_request",
  "duplicate_payment",
  "merchant_settlement_delay",
  "agent_cash_in_issue",
  "phishing_or_social_engineering",
  "other",
]);

export const severitySchema = z.enum(["low", "medium", "high", "critical"]);

export const departmentSchema = z.enum([
  "customer_support",
  "dispute_resolution",
  "payments_ops",
  "merchant_operations",
  "agent_operations",
  "fraud_risk",
]);

export const languageSchema = z.enum(["en", "bn", "mixed"]);
export const channelSchema = z.enum([
  "in_app_chat",
  "call_center",
  "email",
  "merchant_portal",
  "field_agent",
]);
export const userTypeSchema = z.enum([
  "customer",
  "merchant",
  "agent",
  "unknown",
]);
export const transactionTypeSchema = z.enum([
  "transfer",
  "payment",
  "cash_in",
  "cash_out",
  "settlement",
  "refund",
]);
export const transactionStatusSchema = z.enum([
  "completed",
  "failed",
  "pending",
  "reversed",
]);

export const transactionHistoryItemSchema = z
  .object({
    transaction_id: z.string().optional(),
    timestamp: z.string().optional(),
    type: transactionTypeSchema.optional(),
    amount: z.number().finite().optional(),
    counterparty: z.string().optional(),
    status: transactionStatusSchema.optional(),
  })
  .passthrough();

export const analyzeTicketRequestSchema = z
  .object({
    ticket_id: z.string().min(1),
    complaint: z.string(),
    language: languageSchema.optional(),
    channel: channelSchema.optional(),
    user_type: userTypeSchema.optional(),
    campaign_context: z.unknown().optional(),
    transaction_history: z.array(transactionHistoryItemSchema).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();




export const analyzeTicketResponseSchema = z.object({
  ticket_id: z.string(),
  relevant_transaction_id: z.string().nullable(),
  evidence_verdict: evidenceVerdictSchema,
  case_type: caseTypeSchema,
  severity: severitySchema,
  department: departmentSchema,
  agent_summary: z.string(),
  recommended_next_action: z.string(),
  customer_reply: z.string(),
  human_review_required: z.boolean(),
  confidence: z.number().min(0).max(1).optional(),
  reason_codes: z.array(z.string()).optional(),
});

export type UnknownRecord = Record<string, unknown>;
export type EvidenceVerdict = z.infer<typeof evidenceVerdictSchema>;
export type CaseType = z.infer<typeof caseTypeSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Department = z.infer<typeof departmentSchema>;
export type TransactionHistoryItem = z.infer<typeof transactionHistoryItemSchema>;
export type AnalyzeTicketRequest = z.infer<typeof analyzeTicketRequestSchema>;
export type AnalyzeTicketResponse = z.infer<typeof analyzeTicketResponseSchema>;

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; issues: ValidationIssue[] };

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join(".") : "$",
    message: issue.message,
  }));
}

export function validateAnalyzeTicketRequest(
  body: unknown,
): ValidationResult<AnalyzeTicketRequest> {
  const result = analyzeTicketRequestSchema.safeParse(body);

  if (!result.success) {
    return { success: false, issues: toValidationIssues(result.error) };
  }

  return { success: true, data: result.data };
}

export function validateAnalyzeTicketResponse(
  body: unknown,
): ValidationResult<AnalyzeTicketResponse> {
  const result = analyzeTicketResponseSchema.safeParse(body);

  if (!result.success) {
    return { success: false, issues: toValidationIssues(result.error) };
  }

  return { success: true, data: result.data };
}

