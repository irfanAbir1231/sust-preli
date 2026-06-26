export type UnknownRecord = Record<string, unknown>;

export type TransactionHistoryItem = {
  transaction_id?: string;
  timestamp?: string;
  type?: string;
  amount?: number;
  counterparty?: string;
  status?: string;
};

export type AnalyzeTicketRequest = {
  ticket_id: string;
  complaint: string;
  language?: string;
  channel?: string;
  user_type?: string;
  campaign_context?: unknown;
  transaction_history?: TransactionHistoryItem[];
  metadata?: UnknownRecord;
};

export type AnalyzeTicketResponse = {
  ticket_id: string;
  relevant_transaction_id: string | null;
  evidence_verdict: string;
  case_type: string;
  severity: string;
  department: string;
  agent_summary: string;
  recommended_next_action: string;
  customer_reply: string;
  human_review_required: boolean;
};

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

function readOptionalString(
  source: UnknownRecord,
  key: string,
  issues: ValidationIssue[],
): string | undefined {
  const value = source[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    issues.push({ path: key, message: "Expected a string." });
    return undefined;
  }

  return value;
}

function readRequiredString(
  source: UnknownRecord,
  key: string,
  issues: ValidationIssue[],
): string {
  const value = source[key];

  if (typeof value !== "string") {
    issues.push({ path: key, message: "Expected a required string." });
    return "";
  }

  if (value.trim().length === 0) {
    issues.push({ path: key, message: "Value cannot be empty." });
  }

  return value;
}

function validateTransactionHistory(
  value: unknown,
  issues: ValidationIssue[],
): TransactionHistoryItem[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    issues.push({
      path: "transaction_history",
      message: "Expected an array of transaction objects.",
    });
    return undefined;
  }

  return value.map((item, index) => {
    const path = `transaction_history.${index}`;

    if (!isRecord(item)) {
      issues.push({ path, message: "Expected a transaction object." });
      return {};
    }

    const transaction: TransactionHistoryItem = {};
    const stringFields = [
      "transaction_id",
      "timestamp",
      "type",
      "counterparty",
      "status",
    ] as const;

    for (const field of stringFields) {
      const fieldValue = item[field];

      if (fieldValue === undefined) {
        continue;
      }

      if (typeof fieldValue !== "string") {
        issues.push({
          path: `${path}.${field}`,
          message: "Expected a string.",
        });
        continue;
      }

      transaction[field] = fieldValue;
    }

    if (item.amount !== undefined) {
      if (typeof item.amount !== "number" || !Number.isFinite(item.amount)) {
        issues.push({
          path: `${path}.amount`,
          message: "Expected a finite number.",
        });
      } else {
        transaction.amount = item.amount;
      }
    }

    return transaction;
  });
}

export function validateAnalyzeTicketRequest(
  body: unknown,
): ValidationResult<AnalyzeTicketRequest> {
  const issues: ValidationIssue[] = [];

  if (!isRecord(body)) {
    return {
      success: false,
      issues: [{ path: "$", message: "Expected a JSON object." }],
    };
  }

  const ticketId = readRequiredString(body, "ticket_id", issues);
  const complaint = readRequiredString(body, "complaint", issues);
  const language = readOptionalString(body, "language", issues);
  const channel = readOptionalString(body, "channel", issues);
  const userType = readOptionalString(body, "user_type", issues);
  const transactionHistory = validateTransactionHistory(
    body.transaction_history,
    issues,
  );

  const metadata = body.metadata;
  if (metadata !== undefined && !isRecord(metadata)) {
    issues.push({ path: "metadata", message: "Expected an object." });
  }

  if (issues.length > 0) {
    return { success: false, issues };
  }

  return {
    success: true,
    data: {
      ticket_id: ticketId,
      complaint,
      ...(language !== undefined ? { language } : {}),
      ...(channel !== undefined ? { channel } : {}),
      ...(userType !== undefined ? { user_type: userType } : {}),
      ...(body.campaign_context !== undefined
        ? { campaign_context: body.campaign_context }
        : {}),
      ...(transactionHistory !== undefined
        ? { transaction_history: transactionHistory }
        : {}),
      ...(isRecord(metadata) ? { metadata } : {}),
    },
  };
}
