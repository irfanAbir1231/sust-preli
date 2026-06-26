"use client";

import { useState } from "react";
import HealthStatus from "@/components/HealthStatus";
import AnalysisResult from "@/components/AnalysisResult";
import { analyzeTicket, AnalysisError } from "@/lib/frontend-api";
import type { AnalyzeTicketRequest, AnalyzeTicketResponse } from "@/schemas/apiContract";

type SampleComplaint = {
  id: string;
  label: string;
  hint: string;
  ticketId: string;
  language: string;
  channel: string;
  userType: string;
  complaint: string;
};

const SAMPLE_COMPLAINTS: SampleComplaint[] = [
  {
    id: "duplicate_bill",
    label: "Duplicate Bill Payment",
    hint: "Customer charged twice for one bill",
    ticketId: "DEMO-DUP-SAMPLE",
    language: "en",
    channel: "in_app_chat",
    userType: "customer",
    complaint:
      "I paid my electricity bill once, but 850 BDT was deducted twice. Please check and refund the duplicate amount.",
  },
  {
    id: "wrong_transfer",
    label: "Wrong Transfer",
    hint: "Sent money to the wrong number",
    ticketId: "TKT-001",
    language: "en",
    channel: "in_app_chat",
    userType: "customer",
    complaint:
      "I sent 5000 taka to a wrong number around 2pm today. The number was supposed to be 01712345678 but I think I typed it wrong. The person isn't responding to my call. Please help me get my money back.",
  },
  {
    id: "payment_failed",
    label: "Failed Online Payment",
    hint: "Money deducted but order not placed",
    ticketId: "TKT-PAY-FAIL",
    language: "en",
    channel: "call_center",
    userType: "customer",
    complaint:
      "I tried to pay 1250 BDT for an order on Daraz at 9pm last night but the payment failed. My bank statement shows the amount was deducted, but I never received any order confirmation and the merchant has no record of my payment.",
  },
  {
    id: "merchant_settlement",
    label: "Merchant Settlement Delay",
    hint: "Merchant waiting for funds to settle",
    ticketId: "TKT-MERCH-22",
    language: "en",
    channel: "merchant_portal",
    userType: "merchant",
    complaint:
      "I run a small clothing shop and accept payments via QueueStorm. I made 3 transactions yesterday totaling 18,400 BDT but the settlement has not arrived in my bank account yet. It has been more than 24 hours. Please release the funds.",
  },
  {
    id: "phishing",
    label: "Phishing Attempt",
    hint: "Customer tricked into sharing OTP",
    ticketId: "TKT-PHISH-09",
    language: "mixed",
    channel: "in_app_chat",
    userType: "customer",
    complaint:
      "Ami ekjon caller ke amar OTP diye diyechi je amake boleche ami prize paisi. Tarpor amar account theke 7500 taka chole giyeche. Please help, eta fraud hoyeche.",
  },
];

export default function TicketAnalyzer() {
  // Input fields state
  const [ticketId, setTicketId] = useState("DEMO-001");
  const [language, setLanguage] = useState("");
  const [channel, setChannel] = useState("");
  const [userType, setUserType] = useState("");
  const [complaint, setComplaint] = useState("");

  // Validation & Error states
  const [validationError, setValidationError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Request & Response state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalyzeTicketResponse | null>(null);

  // Reset Handler
  const resetForm = () => {
    setTicketId("DEMO-001");
    setLanguage("");
    setChannel("");
    setUserType("");
    setComplaint("");
    setValidationError(null);
    setApiError(null);
    setResult(null);
  };

  // Synthetic Sample loader
  const applySample = (sample: SampleComplaint) => {
    setTicketId(sample.ticketId);
    setLanguage(sample.language);
    setChannel(sample.channel);
    setUserType(sample.userType);
    setComplaint(sample.complaint);
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

    // 2. Assemble JSON Payload (omit "Not provided" enums)
    const requestPayload: AnalyzeTicketRequest = {
      ticket_id: ticketId.trim(),
      complaint: complaint.trim(),
    };

    if (language) requestPayload.language = language as any;
    if (channel) requestPayload.channel = channel as any;
    if (userType) requestPayload.user_type = userType as any;

    // 3. Send POST request
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

          {/* Sample Complaint Picker */}
          <div className="space-y-2 pt-3 border-t border-zinc-100">
            <div className="flex items-center justify-between">
              <span className="block text-xs font-semibold text-zinc-600 font-sans">
                Try a sample complaint
              </span>
              <span className="text-[10px] text-zinc-400 font-sans">
                Click to load &rarr; then Analyze
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {SAMPLE_COMPLAINTS.map((sample) => {
                const isActive = ticketId === sample.ticketId;
                return (
                  <button
                    key={sample.id}
                    type="button"
                    onClick={() => applySample(sample)}
                    title={sample.hint}
                    className={`group inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-colors font-sans ${
                      isActive
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "bg-zinc-50 hover:bg-blue-50 border-zinc-200 hover:border-blue-300 text-zinc-700 hover:text-blue-700"
                    }`}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                      stroke="currentColor"
                      className="h-3 w-3 opacity-70"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z"
                      />
                    </svg>
                    <span>{sample.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Actions Section */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-100">
            <div className="flex items-center gap-2">
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
