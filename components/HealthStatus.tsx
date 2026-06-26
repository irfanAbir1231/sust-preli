"use client";

import { useEffect, useState } from "react";
import { checkHealth } from "@/lib/frontend-api";

export default function HealthStatus() {
  const [status, setStatus] = useState<"ok" | "checking" | "unavailable">("checking");

  const refresh = async () => {
    setStatus("checking");
    const res = await checkHealth();
    setStatus(res.status);
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div
      className="flex items-center gap-3 text-xs md:text-sm font-medium"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            status === "ok"
              ? "bg-emerald-500 animate-pulse"
              : status === "checking"
                ? "bg-amber-500 animate-pulse"
                : "bg-rose-500"
          }`}
          aria-hidden="true"
        />
        <span className="text-zinc-600 dark:text-zinc-400 font-sans">
          {status === "ok" ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">API Online</span>
          ) : status === "checking" ? (
            <span className="text-amber-700 dark:text-amber-400">Checking...</span>
          ) : (
            <span className="text-rose-700 dark:text-rose-400 font-semibold">API Unavailable</span>
          )}
        </span>
      </div>
      <button
        onClick={refresh}
        className="p-1.5 text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-100 rounded-md transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        title="Refresh health status"
        aria-label="Refresh health status"
        type="button"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="2.5"
          stroke="currentColor"
          className="h-4 w-4"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </button>
    </div>
  );
}
