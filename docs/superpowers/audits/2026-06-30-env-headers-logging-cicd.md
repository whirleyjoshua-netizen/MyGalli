# Ops Audit — Environment, Headers, Logging, CI/CD
**Date:** 2026-06-30  
**Scope:** Galli (pages-mvp) pre-launch review  
**Auditor:** Claude (read-only)

---

## Summary

The codebase has solid fundamentals for a pre-launch MVP: JWT secret validation fails hard on bad values, cookies are httpOnly + sameSite, rate limiting is in place, and the build passes CI. The main gaps are **zero HTTP security headers** (no CSP, HSTS, X-Frame-Options, etc.), **no health endpoint or error monitoring**, a **CI build that uses a fake DATABASE_URL** without running tests or type-check, and **email bodies including magic links logged to server console in dev** (low risk in prod but a hygiene issue).

---

## Findings

### CRITICAL

#### C-1 — No HTTP Security Headers Whatsoever
- **Evidence:** `next.config.js` (entire file, 25 lines) — no `headers()` export. `src/middleware.ts` adds no response headers.
- **Why it matters:** No CSP means XSS can exfiltrate auth cookies if any injection point exists. No HSTS means first-visit is vulnerable to SSL stripping. No X-Frame-Options means clickjacking is trivially possible.
- **Missing:** Content-Security-Policy, Strict-Transport-Security, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Referrer-Policy, Permissions-Policy.
- **Recommendation:** Add a `headers()` block to `next.config.js` (or inject in `middleware.ts`) setting all six headers before launch.

---

### HIGH

#### H-1 — No Type-Check or Tests in CI; Build Uses Fake DATABASE_URL
- **Evidence:** `.github/workflows/ci.yml` — two jobs: `lint` (ESLint only) and `build` (`DATABASE_URL=postgresql://fake:fake@localhost:5432/fake`). No `tsc --noEmit`, no `pnpm test`, no `pnpm audit`.
- **Why it matters:** TypeScript errors, failing tests, and known dependency vulnerabilities can reach `main`. The fake DATABASE_URL also means Prisma `migrate deploy` is never exercised in CI.
- **Recommendation:** Add a `typecheck` job (`pnpm tsc --noEmit`), a `test` job (`pnpm test`), and a `pnpm audit --audit-level=high` step.

#### H-2 — Cookie Missing `path` Flag
- **Evidence:** `src/app/api/auth/login/route.ts:75-80`, `signup/route.ts:107-112`, `google/route.ts:133-138`. All four auth routes (login, signup, google, logout) set `httpOnly`, `secure`, `sameSite: 'lax'`, `maxAge` — but no `path`.
- **Why it matters:** Without `path: '/'`, some browsers scope the cookie to the issuing path. Behaviour is implementation-defined and can cause silent auth failures on path changes.
- **Recommendation:** Add `path: '/'` to all `galli-auth` cookie set/delete calls.

#### H-3 — No Health Endpoint, No Error Monitoring
- **Evidence:** Grep of `src/` for `health`, `sentry`, `datadog`, `newrelic`, `opentelemetry` returned zero relevant hits.
- **Why it matters:** On day one there is no way to know if the app is up, if DB connections are saturated, or if errors are spiking — until a user complains.
- **Recommendation:** Add `/api/health` (DB ping + 200/503). Wire Sentry or similar (free tier) for server-side error aggregation.

---

### MEDIUM

#### M-1 — Email Dev Fallback Logs Full Email Body (Including Magic Links) to Server Console
- **Evidence:** `src/lib/email.ts:9` — when `RESEND_API_KEY` is absent the entire rendered HTML email (including verification/reset token URLs) is logged via `console.log`.
- **Why it matters:** In production, if `RESEND_API_KEY` is accidentally unset (e.g. env var not propagated to a new deployment), password-reset and verification links would be silently logged to Vercel's build/function logs rather than delivered — and would be visible to anyone with log access.
- **Recommendation:** In production (`NODE_ENV === 'production'`), throw or alert instead of logging. Keep dev console log but strip the link body or log only a truncated token.

#### M-2 — JWT Secret Guarded at Runtime Only; No Startup Validation
- **Evidence:** `src/lib/auth.ts:6-11` — `getJwtSecret()` throws if secret is missing or equals the placeholder, but this function is only called per-request, not at startup.
- **Why it matters:** The app will start and appear healthy but crash on every authenticated request if `JWT_SECRET` is wrong — with no early warning.
- **Recommendation:** Add an env validation module (e.g. using `zod` or a simple guard) called from `next.config.js` or a top-level instrumentation file (`instrumentation.ts`).

#### M-3 — `sameSite: 'lax'` on Auth Cookie (Cross-Site POST Not Blocked)
- **Evidence:** All four auth cookie set sites use `sameSite: 'lax'`.
- **Why it matters:** `lax` blocks cross-site `POST`, but `strict` would also block cross-site top-level navigation carrying the cookie. For a social platform where users can click links from external sites this is acceptable, but worth documenting as a deliberate choice.
- **Recommendation:** Keep `lax` but document it. If CSRF protection is ever needed on state-mutating GETs, add a CSRF token.

#### M-4 — No `pnpm audit` / Dependency Vulnerability Scanning
- **Evidence:** `ci.yml` has no security scan step.
- **Why it matters:** Supply-chain vulnerabilities in transitive deps go undetected.
- **Recommendation:** Add `pnpm audit --audit-level=high` as a CI step; optionally add Dependabot via `.github/dependabot.yml`.

---

### LOW

#### L-1 — No Compression Config in `next.config.js`
- **Evidence:** `next.config.js` has no `compress` key.
- **Why it matters:** Next.js enables gzip by default in `next start`; Vercel adds Brotli at the edge. No action needed for Vercel deploys, but worth confirming if self-hosting.
- **Recommendation:** Document the assumption; add `compress: true` explicitly for clarity.

#### L-2 — `ANTHROPIC_API_KEY` in Env Var Surface Without Docs
- **Evidence:** Grep finds `process.env.ANTHROPIC_API_KEY` referenced in `src/lib/ai/validate.ts` but the deployment checklist in the README does not mention it.
- **Why it matters:** Deployment will fail silently for AI features if the key is absent and the code doesn't guard it.
- **Recommendation:** Add to deployment checklist and add a runtime guard/log if the key is missing when the feature is invoked.

#### L-3 — `console.error` in Every Auth Route Logs Raw Error Objects
- **Evidence:** All auth routes (`login`, `signup`, `forgot`, `reset`, `verify`, `google`, etc.) catch-all `console.error('X error:', e)`.
- **Why it matters:** Error objects can include stack traces with internal paths and occasionally PII (e.g. a failed DB query that echoes the attempted email). Not a blocker but increases attack surface of log aggregation.
- **Recommendation:** Log `e instanceof Error ? e.message : String(e)` rather than the raw error; forward to structured log in production.

---

## Environment Variable Inventory

| Variable | Required | Guard |
|---|---|---|
| `DATABASE_URL` | Yes (runtime crash) | None — Prisma throws on connect |
| `JWT_SECRET` | Yes (per-request throw) | `getJwtSecret()` check with good message |
| `NEXT_PUBLIC_APP_URL` | Recommended | Fallback to `https://galli.page` in layout |
| `BLOB_READ_WRITE_TOKEN` | Prod only | Falls back to local disk in dev |
| `RESEND_API_KEY` | Prod only | Falls back to console.log |
| `EMAIL_FROM` | Optional | Defaults to `onboarding@resend.dev` |
| `UPSTASH_REDIS_REST_URL` | Optional | Falls back to in-memory |
| `UPSTASH_REDIS_REST_TOKEN` | Optional | Falls back to in-memory |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Optional | Feature hidden if absent |
| `ANTHROPIC_API_KEY` | Feature-gated | No guard found |

---

## Cookie Flags Summary (`galli-auth`)

| Flag | Set? | Value |
|---|---|---|
| `httpOnly` | Yes | `true` |
| `secure` | Yes | `process.env.NODE_ENV === 'production'` |
| `sameSite` | Yes | `'lax'` |
| `maxAge` | Yes | 7 days (604800s) |
| `path` | **No** | Missing — see H-2 |

---

## Launch Blockers

| # | Severity | Finding |
|---|---|---|
| C-1 | Critical | No HTTP security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy) |
| H-1 | High | CI has no type-check, no tests, no `pnpm audit` |
| H-2 | High | `galli-auth` cookie missing `path: '/'` |
| H-3 | High | No health endpoint and no error monitoring |
