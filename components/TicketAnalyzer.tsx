"use client";

import { useState } from "react";
import HealthStatus from "@/components/HealthStatus";
import TransactionRow from "@/components/TransactionRow";
import AnalysisResult from "@/components/AnalysisResult";
import { analyzeTicket, AnalysisError } from "@/lib/frontend-api";
import type { AnalyzeTicketRequest, AnalyzeTicketResponse, TransactionHistoryItem } from "@/schemas/apiContract";

type LocalTransactionItem = TransactionHistoryItem & { localTime?: string };

export default function TicketAnalyzer() {
  // Input fields state
  const [ticketId, setTicketId] = useState("DEMO-001");
  const [language, setLanguage] = useState("");
  const [channel, setChannel] = useState("");
  const [userType, setUserType] = useState("");
  const [complaint, setComplaint] = useState("");
  const [transactions, setTransactions] = useState<LocalTransactionItem[]>([]);

  // Validation & Error states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Request & Response state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeTicketResponse | null>(null);

  // Transaction Builders controls
  const addTransaction = () => {
    setTransactions((prev) => [
      ...prev,
      {
        transaction_id: `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
        localTime: "",
        type: "transfer",
        amount: undefined,
        counterparty: "",
        status: "completed",
      },
    ]);
  };

  const removeTransaction = (index: number) => {
    setTransactions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTransaction = (
    index: number,
    updatedFields: Partial<LocalTransactionItem>,
  ) => {
    setTransactions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...updatedFields } : item)),
    );
  };

  // Reset Handler
  const resetForm = () => {
    setTicketId("DEMO-001");
    setLanguage("");
    setChannel("");
    setUserType("");
    setComplaint("");
    setTransactions([]);
    setValidationError(null);
    setApiError(null);
    setResult(null);
  };

  // Synthetic Sample loader
  const loadSample = () => {
    setTicketId("DEMO-DUP-SAMPLE");
    setLanguage("en");
    setChannel("in_app_chat");
    setUserType("customer");
    setComplaint("I paid my electricity bill once, but 850 BDT was deducted twice.");
    
    // Set 2 duplicate transaction items close in time (e.g. 1 minute apart)
    setTransactions([
      {
        transaction_id: "TXN-9821",
        localTime: "2026-04-13T10:15",
        type: "payment",
        amount: 850,
        counterparty: "DESCO-BILLER",
        status: "completed",
      },
      {
        transaction_id: "TXN-9822",
        localTime: "2026-04-13T10:16",
        type: "payment",
        amount: 850,
        counterparty: "DESCO-BILLER",
        status: "completed",
      },
    ]);
    
    setValidationError(null);
    setApiError(null);
    setResult(null);
  };

  // Submit Analyzer Handler
  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setApiError(null);

    // 1. Basic field validation
    if (!ticketId.trim()) {
      setValidationError("Ticket ID is required.");
      return;
    }
    if (!complaint.trim()) {
      setValidationError("Complaint description cannot be empty.");
      return;
    }

    // 2. Validate transaction history builders
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i]!;
      if (!tx.transaction_id || !tx.transaction_id.trim()) {
        setValidationError(`Transaction #${i + 1} is missing a Transaction ID.`);
        return;
      }
      if (!tx.localTime || !tx.localTime.trim()) {
        setValidationError(`Transaction #${i + 1} is missing a valid date/time.`);
        return;
      }
      if (tx.amount === undefined || isNaN(tx.amount) || tx.amount < 0) {
        setValidationError(`Transaction #${i + 1} must have a valid non-negative amount.`);
        return;
      }
      if (!tx.counterparty || !tx.counterparty.trim()) {
        setValidationError(`Transaction #${i + 1} is missing a counterparty.`);
        return;
      }
    }

    // 3. Assemble JSON Payload (omit "Not provided" enums)
    const requestPayload: AnalyzeTicketRequest = {
      ticket_id: ticketId.trim(),
      complaint: complaint.trim(),
    };

    if (language) requestPayload.language = language as any;
    if (channel) requestPayload.channel = channel as any;
    if (userType) requestPayload.user_type = userType as any;

    if (transactions.length > 0) {
      requestPayload.transaction_history = transactions.map((tx) => {
        // Convert datetime-local to standard ISO 8601 string
        const timestamp = tx.localTime ? new Date(tx.localTime).toISOString() : undefined;
        
        const historyItem: TransactionHistoryItem = {
          transaction_id: tx.transaction_id!.trim(),
          timestamp,
          type: tx.type,
          amount: tx.amount,
          counterparty: tx.counterparty!.trim(),
          status: tx.status,
        };
        return historyItem;
      });
    }

    // 4. Send POST request
    setIsAnalyzing(true);
    try {
      const response = await analyzeTicket(requestPayload);
      setResult(response);
    } catch (err: any) {
      if (err instanceof AnalysisError) {
        const pathDetails = err.errorPayload?.issues
          ? `: ${err.errorPayload.issues.map((i) => `[${i.path}] ${i.message}`).join(", ")}`
          : "";
        setApiError(`${err.message}${pathDetails}`);
      } else {
        setApiError(err.message || "Failed to analyze ticket.");
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Ticket form card - 53% width on Desktop */}
      <div className="w-full lg:w-[54%] bg-white border border-zinc-200 shadow-sm rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 mb-5">
          <h2 className="text-base font-bold text-zinc-950 font-sans">
            Incident Diagnosis Form
          </h2>
          <HealthStatus />
        </div>

        <form onSubmit={handleAnalyze} className="space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Ticket ID */}
            <div>
              <label htmlFor="ticket-id" className="block text-xs font-semibold text-zinc-600 mb-1.5 font-sans">
                Ticket ID *
              </label>
              <input
                id="ticket-id"
                type="text"
                value={ticketId}
                onChange={(e) => setTicketId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
                placeholder="DEMO-001"
                required
              />
            </div>

            {/* Language */}
            <div>
              <label htmlFor="language" className="block text-xs font-semibold text-zinc-600 mb-1.5 font-sans">
                Language
              </label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              >
                <option value="">Not provided</option>
                <option value="en">en</option>
                <option value="bn">bn</option>
                <option value="mixed">mixed</option>
              </select>
            </div>

            {/* Intake Channel */}
            <div>
              <label htmlFor="channel" className="block text-xs font-semibold text-zinc-600 mb-1.5 font-sans">
                Intake Channel
              </label>
              <select
                id="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              >
                <option value="">Not provided</option>
                <option value="in_app_chat">in_app_chat</option>
                <option value="call_center">call_center</option>
                <option value="email">email</option>
                <option value="merchant_portal">merchant_portal</option>
                <option value="field_agent">field_agent</option>
              </select>
            </div>

            {/* User Type */}
            <div>
              <label htmlFor="user-type" className="block text-xs font-semibold text-zinc-600 mb-1.5 font-sans">
                User Type
              </label>
              <select
                id="user-type"
                value={userType}
                onChange={(e) => setUserType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              >
                <option value="">Not provided</option>
                <option value="customer">customer</option>
                <option value="merchant">merchant</option>
                <option value="agent">agent</option>
                <option value="unknown">unknown</option>
              </select>
            </div>
          </div>

          {/* Complaint Textarea */}
          <div>
            <label htmlFor="complaint" className="block text-xs font-semibold text-zinc-600 mb-1.5 font-sans">
              Customer Complaint (supports Bangla/English) *
            </label>
            <textarea
              id="complaint"
              rows={3}
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Describe what happened, including the amount, approximate time, recipient, or transaction details."
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans"
              required
            />
          </div>

          {/* Transaction History Builder */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-semibold text-zinc-600 font-sans">
                Transaction History
              </span>
              <button
                type="button"
                onClick={addTransaction}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Add transaction</span>
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="p-5 text-center text-xs text-zinc-500 border border-zinc-200 rounded-lg bg-zinc-50/30 font-sans">
                No transactions added yet.
              </div>
            ) : (
              <div className="overflow-x-auto border border-zinc-200 rounded-lg">
                <table className="w-full text-left border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-sans">
                      <th className="p-3 w-1/4">Transaction ID *</th>
                      <th className="p-3 w-[150px]">Date/Time *</th>
                      <th className="p-3 w-[120px]">Type</th>
                      <th className="p-3 w-[100px]">Amount *</th>
                      <th className="p-3 w-1/5">Counterparty *</th>
                      <th className="p-3 w-[125px]">Status</th>
                      <th className="p-3 w-[45px] text-center"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => (
                      <TransactionRow
                        key={idx}
                        index={idx}
                        item={tx}
                        isHighlighted={result?.relevant_transaction_id === tx.transaction_id}
                        onUpdate={updateTransaction}
                        onRemove={removeTransaction}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Form Actions Section */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadSample}
                className="px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-md transition-colors font-sans"
              >
                Load Sample
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-3.5 py-2 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded-md transition-colors font-sans"
              >
                Reset
              </button>
            </div>

            <button
              type="submit"
              disabled={isAnalyzing}
              className={`px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors font-sans shadow-sm flex items-center gap-2 ${
                isAnalyzing ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              {isAnalyzing ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <span>Analyze Ticket</span>
              )}
            </button>
          </div>

          {/* Validation & Api Error Panels */}
          {validationError && (
            <div className="p-3.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg font-semibold font-sans">
              {validationError}
            </div>
          )}
          {apiError && (
            <div className="p-3.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg font-semibold font-sans">
              <strong>API Error:</strong> {apiError}
            </div>
          )}
        </form>
      </div>

      {/* Result Panel card - 46% width on Desktop */}
      <div className="w-full lg:w-[46%] bg-white border border-zinc-200 shadow-sm rounded-lg p-5">
        <h2 className="text-base font-bold text-zinc-950 border-b border-zinc-100 pb-4 mb-5 font-sans">
          Investigation Diagnostics
        </h2>
        <AnalysisResult result={result} />
      </div>
    </div>
  );
}
