import {
  type AnalyzeTicketRequest,
  type AnalyzeTicketResponse,
  analyzeTicketResponseSchema,
} from "@/schemas/apiContract";
import { runEvidenceEngine } from "@/services/domain/evidenceEngine";
import { applyCasePolicy } from "@/services/domain/casePolicy";
import { enforceSafetyGuardrails } from "@/services/domain/safetyGuard";

/**
 * Unified post-processing pipeline.
 *
 * Steps (Phase 10):
 *   1. Force ticket_id from request.
 *   2. Run evidence engine → determines relevantTransactionId + verdict.
 *   3. Apply case policy → corrects severity, department, human_review_required,
 *      confidence, reason_codes.
 *   4. Apply safety guardrails on customer_reply + recommended_next_action.
 *   5. Validate final response schema.
 */
export function formatAnalyzeTicketResponse(
  request: AnalyzeTicketRequest,
  response: AnalyzeTicketResponse,
): AnalyzeTicketResponse {
  // Step 1: Force ticket_id
  const withTicketId: AnalyzeTicketResponse = {
    ...response,
    ticket_id: request.ticket_id,
  };

  // Step 2: Run evidence engine
  const evidence = runEvidenceEngine(request, withTicketId.case_type);

  // Step 3: Apply case policy (sets verdict, department, severity, human_review)
  const afterPolicy = applyCasePolicy(request, withTicketId, evidence);

  // Step 4: Apply safety guardrails
  const afterSafety = enforceSafetyGuardrails(afterPolicy);

  // Step 5: Validate final schema
  return analyzeTicketResponseSchema.parse(afterSafety);
}

