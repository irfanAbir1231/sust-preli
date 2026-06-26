# QueueStorm Investigator — Submission Notes

Internal helper file for completing the submission form.
Replace all `[ADD ...]` placeholders before submitting.

---

## Submission Form Details

| Field | Value |
|---|---|
| Registered Team Name | [ADD REGISTERED TEAM NAME] |
| Team ID | [ADD TEAM ID] |
| Team Members | [ADD ONLY IF FORM REQUIRES] |
| Submission Form URL | [ADD FORM LINK] |
| Submission Deadline | [ADD DEADLINE] |
| Architecture Video URL | [OPTIONAL — ADD VIEWABLE LINK] |

---

## Submission Path

**Live public endpoint**

---

## Base URL

```
https://sust-preli.vercel.app
```

---

## GitHub Repository

```
https://github.com/irfanAbir1231/sust-preli
```

---

## Exact Endpoint URLs

```
GET  https://sust-preli.vercel.app/health
POST https://sust-preli.vercel.app/analyze-ticket
```

---

## Required Environment Variable Names

> Provide names only. Do not include values in this file.

```
GROQ_API_KEY
GROQ_MODEL
GROQ_API_KEYS   (optional — comma-separated list for key rotation)
```

---

## AI / Model Usage Explanation

*(Copy-ready paragraph for the submission form)*

QueueStorm Investigator uses the Groq-hosted `llama-3.3-70b-versatile` model for complaint-language understanding and transaction-context interpretation. The model receives the complaint text and transaction history, then returns a structured JSON analysis at temperature 0.1 with `response_format: json_object`. Each Groq call has a 12-second timeout enforced by `AbortController`, with up to two attempts per API key. Multiple keys can be supplied via `GROQ_API_KEYS` for rotation. No GPU or local model weights are required. If Groq is unavailable or returns an invalid response, the system automatically falls back to a deterministic keyword-based classifier — no second external model is called. Final transaction grounding, severity, department assignment, escalation decisions, and safety enforcement are always applied deterministically after the model output and cannot be overridden by the LLM.

---

## Safety Logic Explanation

*(Copy-ready paragraph for the submission form)*

Every `customer_reply` and `recommended_next_action` field is post-processed by a regex-based safety guardrail layer before the response is returned. This layer removes any sentence that requests credentials (PIN, OTP, password, or full card number), replaces unconditional refund or reversal promises with policy-safe language ("any eligible amount will be returned through official channels according to applicable policy"), and removes any instruction directing the customer to unofficial third-party platforms. If a credential topic was present, a standard safety warning is appended. These rules cannot be overridden by content in the customer complaint, including adversarial instructions embedded in complaint text. Phishing and social-engineering cases are always escalated to critical severity with `human_review_required: true`.

---

## Evidence-Reasoning Explanation

*(Copy-ready paragraph for the submission form)*

The evidence engine scores each transaction in the supplied history against the complaint text using a rule-based scoring model. Signals include: explicit transaction ID mention (+8), amount match with Bangla digit normalization (+3), cash-in keyword match (+3), and type/counterparty/status/date keyword matches (+2 each). Specialized rules handle duplicate-payment detection (two identical completed payments within a 5-minute window), established-recipient contradiction (≥3 prior transfers to the same counterparty flagged as inconsistent with a wrong-transfer claim), agent cash-in matching, and merchant settlement matching. A score below 3 or a tie within 2 points between candidates returns `insufficient_data` with `relevant_transaction_id: null` rather than guessing. Empty transaction history always returns `insufficient_data`.

---

## Known Limitations

- Groq free-tier rate limits may prevent all tickets in a high-volume campaign from receiving LLM-backed analysis. The service degrades to deterministic analysis rather than erroring.
- The deterministic fallback has lower language-understanding quality than the LLM path, particularly for nuanced or ambiguous complaints.
- No persistent ticket database. Each request is stateless.
- No real payment system integration. Transaction history must be supplied by the caller.
- The service cannot authorize or execute financial actions (refunds, reversals, transfers).
- 40,000-ticket Groq capacity has not been load-tested.
- The frontend dashboard is a demonstration interface only.

---

## Synthetic Data Confirmation

This submission uses only synthetic complaint and transaction data. No real customer or payment data is included anywhere in the codebase, tests, or sample files.

---

## Secrets Confirmation

No real API keys, tokens, or environment secrets are committed to the repository. All secrets are supplied through environment variables (`.env.local` locally; Vercel environment settings in production). `.env.local` is covered by `.gitignore`.

---

## Sample Request and Response

Reference files generated from the official sample pack (SAMPLE-10 — duplicate payment):

```
samples/sample-request.json    — POST body sent to /analyze-ticket
samples/sample-response.json   — Live HTTP 200 response from https://sust-preli.vercel.app/analyze-ticket
```

---

## Submission Checklist

- [ ] Team name added to this file
- [ ] Team ID added to this file
- [ ] Repository is public or organizer has been granted access
- [ ] Live endpoint verified: `curl https://sust-preli.vercel.app/health` returns `{"status":"ok"}`
- [ ] README.md reviewed — contains `## Models` section
- [ ] RUNBOOK.md tested locally
- [ ] `samples/sample-response.json` generated from the live Vercel endpoint (not fabricated)
- [ ] No secrets committed: `grep -rn "gsk_\|sk-" .env.example README.md RUNBOOK.md SUBMISSION_NOTES.md`
- [ ] Optional architecture video link added and permissions checked (viewable by anyone)
- [ ] Official submission form completed and submitted
