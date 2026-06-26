"use client";

import { useState } from "react";
import type { AnalyzeTicketResponse } from "@/schemas/apiContract";

interface AnalysisResultProps {
  result: AnalyzeTicketResponse | null;
}

export default function AnalysisResult({ result }: AnalysisResultProps) {
  const [copiedAction, setCopiedAction] = useState(false);
  const [copiedReply, setCopiedReply] = useState(false);

  const copyText = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-zinc-300 rounded-lg min-h-[300px] bg-zinc-50/50">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="h-10 w-10 text-zinc-400 mb-3"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.375c.82 0 1.5-.68 1.5-1.5s-.68-1.5-1.5-1.5H9m.75-12h7.5c1.05 0 1.9.82 1.9 1.838v16.324c0 1.018-.85 1.838-1.9 1.838h-11c-1.05 0-1.9-.82-1.9-1.838V4.838c0-1.018.85-1.838 1.9-1.838h3.375c.446 0 .862.203 1.144.551l1.5 1.838a1.2 1.2 0 0 0 .914.373h1.838Z"
          />
        </svg>
        <span className="text-sm font-medium text-zinc-500 font-sans">
          Submit a ticket to view the investigation result.
        </span>
      </div>
    );
  }

  // Verdict Badges Visual Mapping
  const verdictStyles: Record<string, string> = {
    consistent: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800",
    inconsistent: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800",
    insufficient_data: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800",
  };

  // Severity Badges Visual Mapping
  const severityStyles: Record<string, string> = {
    low: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/20 dark:text-emerald-300",
    medium: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/20 dark:text-amber-300",
    high: "bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/20 dark:text-rose-300",
    critical: "bg-red-900/10 text-red-950 border-red-900/30 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/60 font-bold",
  };

  return (
    <div
      className="space-y-6 font-sans"
      aria-live="polite"
    >
      {/* Top Badges Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Case Type */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
          <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
            Case Type
          </span>
          <span className="text-sm font-semibold text-zinc-800 capitalize">
            {result.case_type.replace(/_/g, " ")}
          </span>
        </div>

        {/* Department */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
          <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
            Department
          </span>
          <span className="text-sm font-semibold text-zinc-800 capitalize">
            {result.department.replace(/_/g, " ")}
          </span>
        </div>

        {/* Evidence Verdict */}
        <div className={`p-3 border rounded-lg ${verdictStyles[result.evidence_verdict] || ""}`}>
          <span className="block text-[11px] font-semibold opacity-85 uppercase tracking-wider mb-1">
            Evidence Verdict
          </span>
          <span className="text-sm font-bold capitalize">
            {result.evidence_verdict.replace(/_/g, " ")}
          </span>
        </div>

        {/* Severity */}
        <div className={`p-3 border rounded-lg ${severityStyles[result.severity] || ""}`}>
          <span className="block text-[11px] font-semibold opacity-85 uppercase tracking-wider mb-1">
            Severity
          </span>
          <span className="text-sm font-bold capitalize">
            {result.severity}
          </span>
        </div>

        {/* Human Review Required */}
        <div
          className={`p-3 border rounded-lg ${
            result.human_review_required
              ? "bg-amber-50 text-amber-800 border-amber-300"
              : "bg-emerald-50 text-emerald-800 border-emerald-300"
          }`}
        >
          <span className="block text-[11px] font-semibold opacity-85 uppercase tracking-wider mb-1">
            Human Review
          </span>
          <span className="text-sm font-semibold capitalize">
            {result.human_review_required ? "Required" : "Not Required"}
          </span>
        </div>

        {/* Relevant Transaction */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg">
          <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
            Relevant Transaction
          </span>
          <span className="text-sm font-bold text-zinc-800 block truncate">
            {result.relevant_transaction_id ? (
              <span className="font-mono text-blue-600">{result.relevant_transaction_id}</span>
            ) : (
              <span className="text-zinc-500 italic">None identified</span>
            )}
          </span>
        </div>
      </div>

      {/* Optional Confidence and Reason Codes */}
      {(result.confidence !== undefined || result.reason_codes !== undefined) && (
        <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg space-y-3.5">
          {result.confidence !== undefined && (
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-zinc-500 mb-1.5">
                <span>ANALYSIS CONFIDENCE</span>
                <span className="font-mono text-zinc-700">{Math.round(result.confidence * 100)}%</span>
              </div>
              <div className="w-full bg-zinc-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${result.confidence * 100}%` }}
                />
              </div>
            </div>
          )}

          {result.reason_codes && result.reason_codes.length > 0 && (
            <div>
              <span className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                Reason Codes
              </span>
              <div className="flex flex-wrap gap-1.5">
                {result.reason_codes.map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-200 text-zinc-800"
                  >
                    {code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Agent Summary Section */}
      <div className="space-y-1.5">
        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
          Agent Summary
        </h4>
        <div className="p-4 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 leading-relaxed shadow-sm">
          {result.agent_summary}
        </div>
      </div>

      {/* Recommended Next Action Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Recommended Next Action
          </h4>
          <button
            type="button"
            onClick={() => copyText(result.recommended_next_action, setCopiedAction)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5"
          >
            {copiedAction ? (
              <span>Copied!</span>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"
                  />
                </svg>
                <span>Copy Action</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 leading-relaxed shadow-sm font-mono whitespace-pre-wrap">
          {result.recommended_next_action}
        </div>
      </div>

      {/* Customer Reply Section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Safe Customer Reply
          </h4>
          <button
            type="button"
            onClick={() => copyText(result.customer_reply, setCopiedReply)}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1.5"
          >
            {copiedReply ? (
              <span>Copied!</span>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.057 1.123-.08M15.75 18H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08M15.75 18.75v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5A3.375 3.375 0 0 0 6.375 7.5H5.25m11.9-3.664A2.251 2.251 0 0 0 15 2.25h-1.5a2.251 2.251 0 0 0-2.15 1.586m5.8 0c.065.21.1.433.1.664v.75h-6V4.5c0-.231.035-.454.1-.664M6.75 7.5H4.875c-.621 0-1.125.504-1.125 1.125v12c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V16.5a9 9 0 0 0-9-9Z"
                  />
                </svg>
                <span>Copy Reply</span>
              </>
            )}
          </button>
        </div>
        <div className="p-4 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 leading-relaxed shadow-sm whitespace-pre-wrap">
          {result.customer_reply}
        </div>
      </div>
    </div>
  );
}
