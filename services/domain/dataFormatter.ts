import type { AnalyzeTicketResponse } from "@/schemas/apiContract";
import { enforceSafetyGuardrails } from "@/services/domain/safetyGuard";

export function formatAnalyzeTicketResponse(
  response: AnalyzeTicketResponse,
): AnalyzeTicketResponse {
  return enforceSafetyGuardrails({
    ticket_id: response.ticket_id,
    relevant_transaction_id: response.relevant_transaction_id,
    evidence_verdict: response.evidence_verdict,
    case_type: response.case_type,
    severity: response.severity,
    department: response.department,
    agent_summary: response.agent_summary,
    recommended_next_action: response.recommended_next_action,
    customer_reply: response.customer_reply,
    human_review_required: response.human_review_required,
  });
}
