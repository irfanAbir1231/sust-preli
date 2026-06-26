import TicketAnalyzer from "@/components/TicketAnalyzer";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      {/* Top navigation bar */}
      <header className="bg-white border-b border-zinc-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            {/* Lightning bolt icon */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5 text-blue-600"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M14.615 1.595a.75.75 0 01.359.852L12.982 9.75h7.268a.75.75 0 01.548 1.262l-10.5 11.25a.75.75 0 01-1.272-.71l1.992-7.302H3.75a.75.75 0 01-.548-1.262l10.5-11.25a.75.75 0 01.913-.143z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm font-bold text-zinc-900 tracking-tight">
              QueueStorm
            </span>
            <span className="hidden sm:inline-block text-xs font-medium text-zinc-400 border-l border-zinc-200 pl-2.5">
              Investigator
            </span>
          </div>

          {/* Badge */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Live API
            </span>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-xl font-bold text-zinc-900 leading-tight">
            Complaint Analysis Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-500 max-w-2xl">
            Submit a customer complaint ticket to the AI reasoning engine. Results include
            intent classification, safety signals, evidence assessment, and a recommended
            resolution policy.
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <TicketAnalyzer />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <span className="text-xs text-zinc-400">
            QueueStorm Investigator &mdash; SUST CSE Hackathon
          </span>
          <span className="text-xs text-zinc-400">
            POST&nbsp;/analyze-ticket &nbsp;&bull;&nbsp; GET&nbsp;/health
          </span>
        </div>
      </footer>
    </div>
  );
}
