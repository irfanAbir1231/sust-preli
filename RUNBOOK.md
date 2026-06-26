# QueueStorm Investigator — Runbook

Reproducibility guide for local setup, testing, and Vercel deployment.
All commands have been verified against the repository.

---

## Prerequisites

- **Node.js 20.9 or newer** (Node 20 LTS or Node 22 LTS recommended)
- **npm** (bundled with Node.js; confirmed package manager for this repo)
- **Groq API key** — required for live LLM-backed analysis; obtain one at https://console.groq.com
- Git

---

## Clone

```bash
git clone https://github.com/irfanAbir1231/sust-preli.git
cd sust-preli
```

---

## Install

```bash
npm install
```

---

## Configure Environment

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in your values:

```env
GROQ_API_KEY=<your-groq-api-key>
# GROQ_API_KEYS=key1,key2   # Optional: comma-separated keys for rotation
GROQ_MODEL=llama-3.3-70b-versatile
```

**Notes:**
- `GROQ_API_KEY` is required for live Groq analysis. Without it the service runs in deterministic-fallback mode.
- `GROQ_API_KEYS` is optional. Provide a comma-separated list to enable key rotation across multiple Groq keys.
- `GROQ_MODEL` defaults to `llama-3.3-70b-versatile` if not set.
- Never commit `.env.local` to the repository (covered by `.gitignore`).
- Never paste real keys into screenshots, chat, or public channels.

---

## Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the interactive dashboard.

---

## Verify Health

```bash
curl -i http://localhost:3000/health
```

**Expected response:**

```
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok"}
```

---

## Analyze a Ticket

```bash
curl -s -X POST http://localhost:3000/analyze-ticket \
  -H "Content-Type: application/json" \
  -d @samples/sample-request.json | python3 -m json.tool
```

**Expected:** HTTP 200 JSON response with all required fields.
See `samples/sample-response.json` for a reference output generated from the live Vercel endpoint.

---

## Run Tests

```bash
npm test
```

Runs the Vitest test suite, which covers route behavior, domain logic, validation, and official sample cases.

---

## Run Lint

```bash
npm run lint
```

Runs ESLint across the project.

---

## Run Typecheck

No dedicated `typecheck` script exists in `package.json`. Run TypeScript directly:

```bash
npx tsc --noEmit
```

---

## Build Production Version

```bash
npm run build
```

Produces an optimized Next.js production build. Expected output includes confirmed routes for `/`, `/analyze-ticket`, and `/health`.

---

## Start Production Server Locally

```bash
npm start
```

Serves the previously built production bundle. Requires `npm run build` to have completed successfully.

---

## Vercel Deployment

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import Git Repository** and select `irfanAbir1231/sust-preli`.
3. In the **Environment Variables** section, add:
   - `GROQ_API_KEY` — your Groq API key
   - `GROQ_MODEL` — `llama-3.3-70b-versatile`
   - `GROQ_API_KEYS` — optional comma-separated list for key rotation
4. Click **Deploy** and wait for the build to complete.
5. Verify the health endpoint:
   ```bash
   curl -i https://sust-preli.vercel.app/health
   ```
6. Verify the analysis endpoint:
   ```bash
   curl -s -X POST https://sust-preli.vercel.app/analyze-ticket \
     -H "Content-Type: application/json" \
     -d @samples/sample-request.json | python3 -m json.tool
   ```

---

## Troubleshooting

**Missing Groq key**
> Service operates in deterministic-fallback mode. `agent_summary`, `recommended_next_action`, and `customer_reply` will use template text instead of LLM-generated output. This is expected behavior — the API still returns 200.

**Groq timeout or rate limit**
> The service automatically falls back to the deterministic classifier. No action required. If this happens frequently, supply additional keys via `GROQ_API_KEYS` for rotation.

**HTTP 400 with `invalid_request`**
> A field contains an invalid enum value. Check that `language`, `channel`, `user_type`, `type`, and `status` all use exact enum strings (e.g., `"cash_in"` not `"cash-in"`, `"completed"` not `"success"`).

**HTTP 422 with `empty_complaint`**
> The `complaint` field is missing, empty, or contains only whitespace. Provide a non-empty complaint string.

**HTTP 400 with `malformed_json`**
> The request body is not valid JSON. Check for trailing commas, unquoted keys, or incorrect `Content-Type` header.

**Port already in use**
```bash
# Find and kill the process on port 3000
lsof -ti:3000 | xargs kill -9
npm run dev
```

**Vercel deployment not reflecting latest commit**
> Trigger a manual redeployment from the Vercel dashboard, or push a new commit to the `main` branch.

**`/api/health` returns 404**
> The correct route is `/health`, not `/api/health`. There is no `/api/` prefix in this project.

---

## Security Checklist

- [ ] `.env.local` is listed in `.gitignore` — never commit it.
- [ ] No API keys in source code, comments, or test fixtures.
- [ ] No API keys in screenshots, error logs, or chat history.
- [ ] Rotate any key that may have been accidentally exposed.
- [ ] Use only synthetic complaint and transaction data in testing.
- [ ] Verify `curl https://sust-preli.vercel.app/health` before submission to confirm the live deployment is healthy.
