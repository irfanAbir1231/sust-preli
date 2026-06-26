# QueueStorm Investigator

**Evidence-grounded AI/API support copilot for digital-finance complaints**

---

## Project Overview

QueueStorm Investigator is an HTTP API that automates first-pass triage of customer support complaints for a digital payments platform. For each complaint ticket it receives, the system:

1. Accepts a customer complaint and recent transaction history.
2. Identifies the most relevant transaction in the history.
3. Determines whether transaction evidence supports, contradicts, or is insufficient to evaluate the complaint.
4. Classifies the case type (wrong transfer, duplicate payment, phishing, etc.).
5. Assigns a severity level and routes to the correct internal department.
6. Decides whether the case requires human review.
7. Produces an internal agent summary and a recommended next action.
8. Produces a safe, policy-compliant customer-facing reply.

> **Important:** QueueStorm Investigator is a support copilot, not an autonomous financial authority. It does not execute refunds, reversals, or any financial transactions. All decisions requiring fund movement require human authorization through the appropriate internal workflow.

---

## Live Links

| Resource | URL |
|---|---|
| Live application | https://sust-preli.vercel.app |
| Health endpoint | https://sust-preli.vercel.app/health |
| Analysis endpoint | https://sust-preli.vercel.app/analyze-ticket |
| GitHub repository | https://github.com/irfanAbir1231/sust-preli |

---

## Core Features

- **Strict API contract** — all request and response fields are validated with Zod; invalid enums return HTTP 400 with structured error details.
- **Evidence-grounded transaction matching** — scores each transaction in the provided history against the complaint text; selects the best match or returns `insufficient_data` when evidence is ambiguous.
- **English, Bangla, and mixed-language handling** — complaint text in any of the three supported language modes is processed correctly.
- **Bangla digit normalization** — Bengali numeric characters (০–৯) are converted to ASCII digits before any amount or pattern matching.
- **Duplicate-payment detection** — identifies two completed payments of the same amount to the same counterparty within a 5-minute window and returns the later transaction as the suspected duplicate.
- **Established-recipient contradiction detection** — flags a wrong-transfer claim as `inconsistent` when the history shows three or more prior transfers to the same counterparty.
- **Failed-payment reasoning** — matches failed transactions to complaints about balance deductions and routes to payments operations.
- **Merchant-settlement reasoning** — identifies pending settlement transactions for merchant-side complaints and routes to merchant operations.
- **Agent cash-in reasoning** — matches pending or completed cash-in transactions for agent-channel complaints and routes to agent operations.
- **Phishing and social-engineering handling** — detects credential-request complaints; always assigns `critical` severity, routes to fraud risk, and sets `human_review_required: true`.
- **Deterministic severity, department, and escalation policy** — a fixed policy table overrides LLM output for these three fields, ensuring consistency regardless of model variation.
- **Safety guardrails** — post-processing removes any sentence in `customer_reply` or `recommended_next_action` that requests credentials, promises refunds unconditionally, or directs users to unofficial third-party channels.
- **Groq failure fallback** — when the Groq API is unavailable, times out, or returns an invalid response, the system automatically falls back to a deterministic keyword-based classifier and continues through the same evidence, policy, and safety pipeline.
- **Interactive frontend demo** — a single-page Next.js dashboard at the root URL allows manual submission of complaint tickets and displays the full structured API response.

---

## Architecture

### Happy path (Groq available)

```
Client
  ↓
POST /analyze-ticket
  ↓
Zod request schema validation  →  400 on invalid enum or missing required field
  ↓
Empty complaint check           →  422 on whitespace-only complaint
  ↓
Groq language analysis
  (llama-3.3-70b-versatile, temperature 0.1, JSON mode,
   12 s timeout per attempt, up to 2 attempts per API key)
  ↓
Deterministic post-processing pipeline
  ├─ 1. Force ticket_id from request
  ├─ 2. Evidence engine  (transaction scoring, duplicate/merchant/agent rules)
  ├─ 3. Case policy      (severity, department, human_review_required table)
  ├─ 4. Safety guardrails (redact credentials, refund promises, third-party links)
  └─ 5. Final Zod response schema validation
  ↓
HTTP 200 JSON response
```

### Fallback path (Groq unavailable / timeout / invalid output)

```
Groq timeout / non-200 status / invalid JSON / parse failure
  ↓
Deterministic fallback classifier
  (keyword rules: phishing, wrong_transfer, duplicate, cash_in,
   payment_failed, refund, merchant_settlement, other)
  ↓
Same post-processing pipeline (steps 1–5 above)
  ↓
HTTP 200 JSON response
```

---

## Technology Stack

| Technology | Version | Role |
|---|---|---|
| Next.js | 16.2.9 | API routes and frontend |
| TypeScript | ^5 | Type safety across all code |
| Zod | ^4.4.3 | Request and response schema validation |
| Tailwind CSS | ^4 | Frontend styling |
| Groq API | — | Hosted LLM inference (llama-3.3-70b-versatile) |
| Vitest | ^4.1.9 | Unit and integration tests |
| Vercel | — | Production deployment platform |

---

## API Endpoints

### GET /health

Returns service liveness status.

```http
GET /health
```

**Response (200)**

```json
{
  "status": "ok"
}
```

---

### POST /analyze-ticket

Accepts a customer complaint ticket and returns a structured analysis.

```http
POST /analyze-ticket
Content-Type: application/json
```

#### Request body

| Field | Type | Required | Description |
|---|---|---|---|
| `ticket_id` | string | ✅ | Unique ticket identifier (min 1 character) |
| `complaint` | string | ✅ | Customer complaint text (must be non-empty) |
| `language` | enum | — | `"en"` · `"bn"` · `"mixed"` |
| `channel` | enum | — | `"in_app_chat"` · `"call_center"` · `"email"` · `"merchant_portal"` · `"field_agent"` |
| `user_type` | enum | — | `"customer"` · `"merchant"` · `"agent"` · `"unknown"` |
| `campaign_context` | string | — | Promotional or event context string |
| `transaction_history` | array | — | Array of transaction objects (see below) |
| `metadata` | object | — | Optional key-value pairs for additional context |

#### Transaction history item fields

| Field | Type | Required | Description |
|---|---|---|---|
| `transaction_id` | string | — | Unique transaction identifier |
| `timestamp` | string | — | ISO 8601 timestamp |
| `type` | enum | — | `"transfer"` · `"payment"` · `"cash_in"` · `"cash_out"` · `"settlement"` · `"refund"` |
| `amount` | number | — | Transaction amount (finite, positive) |
| `counterparty` | string | — | Recipient, sender, merchant, or biller identifier |
| `status` | enum | — | `"completed"` · `"failed"` · `"pending"` · `"reversed"` |

#### Response fields

| Field | Type | Required | Description |
|---|---|---|---|
| `ticket_id` | string | ✅ | Echoed from request |
| `relevant_transaction_id` | string \| null | ✅ | ID of the matched transaction, or `null` |
| `evidence_verdict` | enum | ✅ | `"consistent"` · `"inconsistent"` · `"insufficient_data"` |
| `case_type` | enum | ✅ | `"wrong_transfer"` · `"payment_failed"` · `"refund_request"` · `"duplicate_payment"` · `"merchant_settlement_delay"` · `"agent_cash_in_issue"` · `"phishing_or_social_engineering"` · `"other"` |
| `severity` | enum | ✅ | `"low"` · `"medium"` · `"high"` · `"critical"` |
| `department` | enum | ✅ | `"customer_support"` · `"dispute_resolution"` · `"payments_ops"` · `"merchant_operations"` · `"agent_operations"` · `"fraud_risk"` |
| `agent_summary` | string | ✅ | Internal summary for the support agent |
| `recommended_next_action` | string | ✅ | Suggested action for the handling team |
| `customer_reply` | string | ✅ | Safe, policy-compliant reply to send to the customer |
| `human_review_required` | boolean | ✅ | Whether the case must be escalated to a human |
| `confidence` | number | — | Model confidence 0.0–1.0 |
| `reason_codes` | string[] | — | Machine-readable codes explaining the verdict |

#### Error responses

| Status | Code | Cause |
|---|---|---|
| 400 | `malformed_json` | Request body is not valid JSON |
| 400 | `invalid_request` | Enum field has an invalid value or `ticket_id` is empty |
| 422 | `empty_complaint` | Complaint is empty or whitespace only |
| 500 | `internal_error` | Both Groq and deterministic fallback failed |

---

## Example Request

See [`samples/sample-request.json`](samples/sample-request.json) for the full SAMPLE-10 duplicate-payment case.

**Quick curl:**

```bash
curl -s -X POST https://sust-preli.vercel.app/analyze-ticket \
  -H "Content-Type: application/json" \
  -d @samples/sample-request.json | python3 -m json.tool
```

---

## Example Response

See [`samples/sample-response.json`](samples/sample-response.json) for the live response generated from the sample request above.

> Natural-language fields (`agent_summary`, `recommended_next_action`, `customer_reply`) may vary between calls when Groq is active. Structured decision fields (`relevant_transaction_id`, `evidence_verdict`, `case_type`, `severity`, `department`, `human_review_required`) are controlled by the deterministic post-processing pipeline and are stable.

---

## Local Setup

**Prerequisites:** Node.js 20.9 or newer (Node 20 LTS or 22 LTS recommended), npm.

```bash
# 1. Clone the repository
git clone https://github.com/irfanAbir1231/sust-preli.git
cd sust-preli

# 2. Install dependencies
npm install

# 3. Create local environment file
cp .env.example .env.local
# Then open .env.local and set GROQ_API_KEY to your Groq API key.
# Without a key the service runs in deterministic-fallback mode.

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the interactive dashboard.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | For LLM analysis | Your Groq API key (https://console.groq.com) |
| `GROQ_API_KEYS` | Optional | Comma-separated list of Groq keys for key rotation |
| `GROQ_MODEL` | Optional | Groq model name (default: `llama-3.3-70b-versatile`) |

- `GROQ_API_KEY` and `GROQ_API_KEYS` are mutually inclusive — provide at least one for live Groq analysis.
- Without either key the system operates entirely in deterministic fallback mode.
- Real API keys must never be committed to the repository.
- Set secrets through `.env.local` locally or through Vercel environment variable settings in production.

---

## Testing and Verification

```bash
# Run test suite
npm test

# Run ESLint
npm run lint

# TypeScript type check (no dedicated script; run directly)
npx tsc --noEmit

# Build production bundle
npm run build

# Start production server locally
npm start
```

---

## Evidence-Reasoning Approach

The evidence engine scores each transaction in `transaction_history` against the complaint and selects the best match. General scoring rules:

| Signal | Points |
|---|---|
| Transaction ID explicitly mentioned in complaint text | +8 |
| Amount in complaint matches transaction amount (with Bangla digit normalization) | +3 |
| Complaint mentions cash-in keywords (English or Bangla) and transaction type is `cash_in` | +3 |
| Complaint mentions transaction type, counterparty, or status keyword | +2 each |
| Date in complaint matches transaction timestamp date | +2 |

**Match threshold:** A score below 3 → `insufficient_data`. A tie within 2 points between the top two candidates → `ambiguous`, `relevant_transaction_id: null`.

**Specialized rules:**

- **Duplicate payment** — two completed `payment` or `settlement` transactions with identical amount and counterparty within a 5-minute window → returns the later one as the suspected duplicate.
- **Agent cash-in** — prioritizes `cash_in` type transactions; falls back to the single available cash-in even without an explicit amount match.
- **Merchant settlement** — prioritizes `settlement` type transactions; uses amount matching when multiple are present.
- **Established recipient** — three or more prior transactions to the same counterparty → wrong-transfer claim is marked `inconsistent`.
- **Insufficient data** — when no transaction history is provided, or no candidate scores above the threshold, returns `relevant_transaction_id: null` and `evidence_verdict: insufficient_data`.

---

## Safety Guardrails

The API enforces the following safety rules on every response, regardless of model output:

**The `customer_reply` and `recommended_next_action` fields will never:**
- Ask the customer for a PIN, OTP, password, or full card number.
- Promise a refund, reversal, chargeback, or account unblock.
- Guarantee any financial outcome.
- Direct the customer to unofficial third-party platforms (Telegram, WhatsApp, etc.).

**Implementation:** Post-processing regex patterns scan and sanitize both fields. Any sentence triggering a credential-request pattern is removed and replaced with a standard safety warning. Unconditional refund language is replaced with policy-safe wording ("any eligible amount will be returned through official channels according to applicable policy"). Adversarial instructions embedded in complaint text cannot override these rules.

---

## Models

**Provider:** Groq  
**Model:** `llama-3.3-70b-versatile`  
**Execution location:** External Groq API (https://api.groq.com)  
**Purpose:** Complaint-language understanding and transaction-context interpretation  
**Why selected:** Fast hosted inference, multilingual capability (English and Bangla), and structured JSON output support via `response_format: json_object`.

Final transaction grounding, enum validation, routing, escalation, and safety enforcement are deterministic and are not delegated solely to the model. The LLM output is always passed through the evidence engine, case policy table, and safety guardrails before the response is returned.

**Fallback:** Deterministic local rule-based classifier — no second external model.

---

## Model and Cost Reasoning

- The project uses one hosted Groq model. No GPU or local multi-gigabyte model weights are required.
- Each Groq call has a 12-second timeout enforced by `AbortController`.
- Up to 2 attempts are made per configured API key. Multiple keys can be supplied via `GROQ_API_KEYS` for rotation.
- The deterministic fallback eliminates hard dependency on Groq availability — the service remains functional during provider outages.
- Groq free-tier rate limits may prevent every ticket in a high-volume campaign from receiving LLM-backed analysis. The system degrades gracefully to deterministic analysis rather than returning errors.
- No claim is made that 40,000 tickets per campaign will all receive live Groq analysis. Volume capacity depends on the active Groq plan and key configuration.

---

## Deployment

**Deploy to Vercel:**

1. Go to [vercel.com/new](https://vercel.com/new) and import the GitHub repository.
2. In **Environment Variables**, add:
   - `GROQ_API_KEY` — your Groq API key
   - `GROQ_MODEL` — `llama-3.3-70b-versatile` (or leave unset for default)
   - `GROQ_API_KEYS` — optional comma-separated list for key rotation
3. Click **Deploy**.
4. Verify the health endpoint: `curl https://<your-domain>/health`
5. Verify the analysis endpoint with a sample request: `curl -X POST https://<your-domain>/analyze-ticket -H "Content-Type: application/json" -d @samples/sample-request.json`

> Do not commit `.env.local` or paste API keys into the repository.

---

## Assumptions

- Input complaint and transaction data are synthetic. No real customer data or live payment records are used.
- No real payment system, ledger, or financial institution is integrated.
- The service does not execute refunds, reversals, transfers, or any financial action.
- Recent transaction history relevant to the complaint is supplied by the caller with each request. The service has no persistent transaction database.
- The service operates as a support copilot. All financial decisions require human authorization.

---

## Known Limitations

- **Groq availability and quota** — live analysis depends on Groq API availability and the configured key's rate limits.
- **Deterministic fallback quality** — the keyword-based fallback classifier has lower language-understanding quality than the LLM path, particularly for nuanced or ambiguous complaint text.
- **No persistent ticket database** — ticket state is not stored between requests; each call is independent.
- **No real payment integration** — the service cannot look up live transaction records; it relies entirely on transaction history supplied in the request body.
- **No financial authority** — the system cannot authorize or execute any financial action.
- **No production-scale load test** — 40,000-ticket Groq capacity has not been validated.
- **Frontend is a demonstration interface** — the dashboard is for manual testing only and is not intended for production customer-facing use.

---

## Privacy and Security

- All complaint and transaction data used in development and testing is synthetic.
- No real customer identifiers, payment data, or account numbers are included anywhere in the codebase.
- No API keys or secrets are committed to the repository. Secrets are supplied through environment variables.
- Error responses do not expose stack traces, provider error details, or environment secrets.

---

## Repository Structure

```
sust-preli/
├── app/
│   ├── analyze-ticket/route.ts   # POST /analyze-ticket handler
│   ├── health/route.ts           # GET /health handler
│   ├── globals.css               # Global styles (Tailwind CSS v4)
│   ├── layout.tsx                # Root layout and metadata
│   └── page.tsx                  # Dashboard homepage
├── components/
│   ├── AnalysisResult.tsx        # Response display component
│   ├── HealthStatus.tsx          # Health indicator
│   ├── TicketAnalyzer.tsx        # Main form and state controller
│   └── TransactionRow.tsx        # Transaction history row editor
├── lib/
│   └── frontend-api.ts           # Frontend API client module
├── samples/
│   ├── sample-request.json       # Example POST body (SAMPLE-10)
│   └── sample-response.json      # Live response from Vercel
├── schemas/
│   └── apiContract.ts            # Zod schemas and TypeScript types
├── services/
│   ├── ai/
│   │   ├── llmClient.ts          # Groq API client (timeout, retry, key rotation)
│   │   └── prompts.ts            # System and user prompt builders
│   └── domain/
│       ├── casePolicy.ts         # Deterministic severity/department/escalation table
│       ├── dataFormatter.ts      # Unified post-processing pipeline
│       ├── evidenceEngine.ts     # Transaction scoring and verdict logic
│       ├── fallbackAnalyzer.ts   # Keyword-based deterministic classifier
│       ├── normalization.ts      # Bangla digit normalization and text helpers
│       └── safetyGuard.ts        # Safety regex guardrails
├── tests/
│   ├── fixtures/
│   │   └── SUST_Preli_Sample_Cases.json   # Official 10-case sample pack
│   ├── analyze-ticket.route.test.ts
│   ├── domain.test.ts
│   ├── official-samples.test.ts
│   └── validation.test.ts
├── .env.example                  # Environment variable template
├── next.config.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Submission Information

| Item | Value |
|---|---|
| Submission path | Live public endpoint |
| Base URL | https://sust-preli.vercel.app |
| Repository | https://github.com/irfanAbir1231/sust-preli |
| Health endpoint | GET https://sust-preli.vercel.app/health |
| Analysis endpoint | POST https://sust-preli.vercel.app/analyze-ticket |
