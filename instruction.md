# AI Editor Project Instructions: Codex Hackathon Preliminary Round

## 1. Project Context & Role

You are an expert backend engineer acting as a co-pilot for the SUST CSE Carnival 2026: Codex Community Hackathon.

Our goal is to build a highly reliable, safe, and schema-compliant API service deployed on Vercel.

**Do NOT build any frontend UI; this is strictly an API evaluation.**

Prioritize exact schema matching, error handling, and security over complex or unnecessarily abstracted architecture.

---

## 2. Tech Stack & Deployment

- **Environment:** Node.js (Serverless Functions on Vercel)
- **Format:** Strictly JSON for all inputs and outputs
- **Environment Variables:** Use `process.env` for all secrets (API keys)
- **Never** hardcode secrets
- Create a `.env.example` with placeholder values

---

## 3. Strict API Contract (CRITICAL)

The automated judge will fail the service if it does not meet these exact requirements.

### GET `/health`

Must immediately return exactly:

```json
{
  "status": "ok"
}
```

### POST Main Endpoint (e.g. `/analyze-ticket`)

- Accept the required JSON input
- Return the strictly defined JSON schema

### Schema Enforcement

Ensure all generated JSON outputs perfectly match the requested:

- field names
- data types
- enum values

defined in the main problem statement.

### Crash Prevention

- Wrap all route handlers and external API calls in `try/catch` blocks
- If an unexpected input is received or a missing optional field occurs, return a controlled error or safe fallback JSON
- **Do NOT** crash or return a 5xx error

### Performance

- Responses must execute in under **30 seconds**
- Optimize API calls to run as fast as possible (target **<5 seconds** for full p95 credit)

---

## 4. Safety & Escalation Rules (MANDATORY)

When writing the AI logic or prompts for the LLM integration, strictly enforce the following guardrails.

### 1. NO Credentials

The system must refuse to ask for:

- PINs
- OTPs
- Passwords
- Secret credentials

### 2. NO Unauthorized Actions

The system cannot promise:

- direct actions
- irreversible account changes
- outcomes outside its authority

### 3. Official Channels Only

If the request is suspicious or risky:

- Escalate or route the user to official support channels
- Do **NOT** instruct users to contact suspicious third parties

---

## 5. Coding Standards & Workflow

### Project Structure

```text
/api
  health.js
  analyze-ticket.js

/utils
  reasoning.js
  safety.js
```

### Validation

Validate incoming JSON payloads before processing.

### Logging

Do **NOT** print:

- sensitive data
- stack traces
- API keys

to the console.

---

## 6. Execution Priority

When writing or updating code, follow this priority order:

1. Implement or fix `/health` and the main `POST` endpoint.
2. Enforce schema correctness (JSON validation and formatting).
3. Implement evidence-based reasoning logic.
4. Add strict safety guardrails.
5. Optimize for speed and reliability.
