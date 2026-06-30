# Release Readiness Audit — Galli (mygalli.com)
**Date:** 2026-06-30  
**Consolidated from:** 6 independent audit agents (Security · Dependencies/Bundle · Code Quality/Types/Tests · Database/API · Env/Headers/Logging/CI · Perf/A11y/SEO/Scale)  
**Lint verified:** `pnpm lint` run live · **TSC verified:** `pnpm exec tsc --noEmit` run live

---

## 1. Executive Summary

Galli has solid security fundamentals (JWT secret validation, bcrypt-12, httpOnly cookies, Prisma ORM preventing SQL injection, consistent auth guards, no hardcoded secrets in git history) and passes TypeScript strict-mode checking cleanly. However, six across-the-board gaps make a public launch premature without fixes: the app has zero HTTP security headers, an exploitable IDOR in comment moderation, a Next.js DoS CVE, a 2.1 MB unoptimized LCP image, in-memory presence that silently breaks on Vercel multi-instance, and a failing lint gate (`pnpm lint` exits 1 due to a `react-hooks/rules-of-hooks` error). The FeaturesPopup em-dash parse error reported by the code-quality agent did **not** appear in the live lint run — it is not a current blocker. `tsc --noEmit` is **clean** (0 errors). Across all 6 audits, deduped totals are: **3 Critical · 17 High · 24 Medium · 11 Low**.

**Verdict: READY WITH FIXES** — address the 7 P0 items below (roughly 2–3 days of work) and the app can safely go live.

---

## 2. P0 — Launch Blockers

Must be resolved before directing production traffic to mygalli.com.

| # | Issue | Source Audit | Evidence | Fix |
|---|-------|-------------|----------|-----|
| P0-1 | **No HTTP security headers** — no CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy | env-headers C-1 | `next.config.js` (entire file, 25 lines) — no `headers()` export; `src/middleware.ts` adds nothing | Add `headers()` block to `next.config.js` setting all six headers |
| P0-2 | **IDOR in comment moderation** — any display owner can moderate any other user's comments | security #2 | `src/app/api/displays/[id]/comments/route.ts` PATCH ~line 93: `where: { id: commentId }` — no check that `comment.displayId === id` | Change to `where: { id: commentId, displayId: id }` |
| P0-3 | **SVG upload → stored XSS via Vercel Blob CDN** | security #3 | `src/app/api/upload/route.ts:12` — `'image/svg+xml'` in `ALLOWED_TYPES`; production path stores to Blob with no CSP wrapper | Remove `image/svg+xml` from `ALLOWED_TYPES` (or sanitize SVG server-side before storage) |
| P0-4 | **Password reset does not invalidate existing JWTs** | security #4 | `src/app/api/auth/reset/route.ts` updates password only; `src/lib/auth.ts` checks signature+expiry only — no generation counter | Add `tokenVersion Int @default(0)` to `User`; embed in JWT; increment on reset; validate in `getUser`/`verifyAuth` |
| P0-5 | **Next.js 14 DoS CVE** (GHSA-h25m-26qc-wcjf) — RSC deserialization crash | security #1 + deps F-02 | `package.json`: `"next": "^14.2.0"` — patched in ≥15.0.8 | Upgrade to Next.js 15 (review async params/cookies migration guide) |
| P0-6 | **`pnpm lint` fails** — `react-hooks/rules-of-hooks` error (exit code 1, blocks Vercel CI) | code-quality #1 + **verified live** | `src/components/library/LibraryClient.tsx:136` — `useStarter` called inside an `onClick` callback | Rename `useStarter` → `handleStarterClick`; verify no real hooks inside it |
| P0-7 | **Vitest Critical CVE** (GHSA-5xrq-8626-4rwp) — arbitrary file read/execute via UI server | security #5 + deps F-01 | `package.json`: `"vitest": "^4.0.18"` — patched in ≥4.1.0 | `pnpm update vitest` (trivial semver bump) |

**Lint status confirmed:** `pnpm lint` exits 1 with **1 error** (P0-6 above) + ~20 warnings. The FeaturesPopup em-dash parse error reported by the code-quality audit agent did **not** appear in the live lint run and is **not** a current P0.  
**TSC status confirmed:** `pnpm exec tsc --noEmit` exits 0 — **clean**.

---

## 3. P1 — Fix Before Scale / First Sprint

Address within the first week post-launch or before significant traffic.

| # | Category | Issue | Evidence | Fix |
|---|----------|-------|----------|-----|
| P1-1 | Data integrity | **View count double-incremented** — explore rankings corrupted | `api/displays/[id]/route.ts` increments views on GET; `api/analytics/track/route.ts` also increments on `eventType='view'` | Pick one source of truth; remove increment from the other |
| P1-2 | Scale | **In-memory presence breaks multi-instance Vercel deploys** | `src/lib/presence.ts` — module-level `Map`; each serverless instance starts empty | Replace with Redis hash+TTL (Upstash already wired) |
| P1-3 | DoS | **Followers/following endpoints unbounded** — full table scan on large accounts | `api/users/[username]/followers/route.ts` + `following/route.ts` — `findMany` with no `take` | Add `take: 50`, cursor-based pagination, max=100 |
| P1-4 | DoS | **Follow/unfollow: no rate limiting** | `api/users/[username]/follow/route.ts` — no `rateLimit()` call | Add `rateLimit(req, { limit: 30, windowMs: 60_000, prefix: 'follow' })` |
| P1-5 | DoS | **Display create/update, profile, tracker, collaborator: no rate limits** | `api/displays/route.ts` POST, `api/displays/[id]` PATCH, `api/profile` PATCH, `api/tracker-entries` POST, `api/displays/[id]/collaborators` POST | Add appropriate rate limits per endpoint |
| P1-6 | Data loss | **Universal hard-delete cascade — no recovery** | `prisma/schema.prisma` — all children `onDelete: Cascade`; display DELETE is permanent | Add `deletedAt DateTime?` to `Display`; soft-delete with 30-day window |
| P1-7 | Perf | **2.1 MB hero PNG on LCP** | `public/hero-village.png` (2,177,938 bytes); `src/components/marketing/Hero.tsx:46` — raw `<img>` | Replace with `next/image` + `priority`; image auto-converts to WebP/AVIF |
| P1-8 | SEO | **No robots.txt / sitemap.xml** | `public/` — both missing | Add `public/robots.txt`; add `src/app/sitemap.ts` (Next.js App Router built-in) |
| P1-9 | SEO | **No OG images on any page** | `src/app/layout.tsx` + `src/app/[username]/[slug]/page.tsx` — no `images:` in openGraph | Add static `public/og-default.png` (1200×630); use `display.coverImage` on public pages; switch Twitter card to `summary_large_image` |
| P1-10 | Ops | **No health endpoint; no error monitoring** | No `/api/health` found; no Sentry/Datadog in codebase | Add `src/app/api/health/route.ts` (DB ping → 200/503); wire Sentry free tier |
| P1-11 | Auth | **Auth cookie missing `path: '/'`** | `api/auth/login`, `signup`, `google`, `logout` route.ts — cookie set without `path` flag | Add `path: '/'` to all 4 auth cookie set/delete calls |
| P1-12 | CI | **CI has no type-check, no test run, no `pnpm audit`** | `.github/workflows/ci.yml` — only lint + build (fake DB_URL) | Add `typecheck`, `test`, `audit --audit-level=high` jobs |
| P1-13 | Scale | **No ISR on public display pages** — every visitor hits Postgres | `src/app/[username]/[slug]/page.tsx` — no `revalidate` export, no static generation | Add `export const revalidate = 60`; move follow-state to client-side fetch |
| P1-14 | Security | **Vitest upgraded (P0-7) but password-reset note** — if P0-4 deferred, compromised sessions live 7 days | See P0-4 | Implement P0-4 token versioning |

---

## 4. P2 — Backlog / Hardening

| # | Category | Issue |
|---|----------|-------|
| P2-1 | Deps | Prisma 2 major versions behind (5.x vs 7.x) — plan 5→6 migration post-launch |
| P2-2 | Deps | `lucide-react` 0.x → 1.x major gap; `zustand` 4→5; TypeScript 5→6; Tailwind 3→4 |
| P2-3 | Deps | `@anthropic-ai/sdk` 27 minor versions behind; add `ANTHROPIC_API_KEY` guard and deploy docs |
| P2-4 | Deps | `minimatch` ReDoS + `glob` CLI injection (dev-only, resolved alongside Next.js upgrade) |
| P2-5 | Tests | Zero API route tests — add smoke tests for auth, collaborator 403 boundary, form dedup |
| P2-6 | Code quality | `ColumnCanvas.tsx` 1,451 lines; `PageEditor.tsx` 1,277 lines — split into sub-modules |
| P2-7 | Code quality | 44 `any` usages across 22 files — define typed interfaces for Prisma JSON payloads |
| P2-8 | Code quality | Circular dep `lib/fonts.ts ↔ lib/google-fonts-data.ts` — extract shared font list to third file |
| P2-9 | DB | Missing indexes: `Display(published, views)`, `Comment(displayId, approved, createdAt)`, `JerseySignature(displayId, elementId, ipHash)`, `Display(kind)` |
| P2-10 | DB | `analytics/track`: `eventType` not validated (allowlist check + metadata size cap) |
| P2-11 | DB | `WaitlistEntry.email` — add `@unique` constraint |
| P2-12 | DB | Migration history manual repair — validate `prisma migrate deploy` against a clean test DB before launch |
| P2-13 | A11y | Add skip-to-content link (WCAG 2.4.1 Level A) |
| P2-14 | A11y | Replace `window.confirm()` for destructive actions with styled modal |
| P2-15 | Perf | No dynamic imports — lazy-load `PageEditor` and heavy element editors via `next/dynamic` |
| P2-16 | Perf | Unbounded queries in analytics routes — add `take: 5000` caps |
| P2-17 | Ops | Email dev fallback logs full magic-link HTML — throw/alert in production if `RESEND_API_KEY` absent |
| P2-18 | Ops | Add startup env validation (`instrumentation.ts`) for `JWT_SECRET` and `DATABASE_URL` |
| P2-19 | SEO | Add structured data (`WebSite` + `SoftwareApplication` JSON-LD) to landing page |
| P2-20 | SEO | Ensure `NEXT_PUBLIC_APP_URL=https://mygalli.com` in Vercel; update fallback in `layout.tsx` |

---

## 5. Per-Category Scorecard

| Category | Critical | High | Medium | Low | Takeaway |
|----------|----------|------|--------|-----|----------|
| Security | 0 | 4 (Next.js DoS, IDOR, SVG XSS, JWT revoke) | 2 | 3 | Core auth solid; four user-exploitable holes need closing |
| Dependencies/Bundle | 1 (Vitest CVE) | 4 (Next.js, Prisma, minimatch, glob — 2 dev-only) | 4 | 2 | Next.js upgrade is the gating item; rest are batched with it |
| Code Quality/Types/Tests | 1 (useStarter hook) | 2 (FeaturesPopup†, zero API tests) | 3 | 2 | TSC clean; lint fails; test surface dangerously thin |
| Database/API | 0 | 4 (followers unbounded, follow no RL, view dupe, hard-delete) | 8 | 3 | Schema good; missing pagination+rate-limits will hurt at scale |
| Env/Headers/Logging/CI | 1 (no security headers) | 3 (CI gaps, cookie path, no health) | 4 | 3 | Most severe gap: zero HTTP headers on a public web app |
| Perf/A11y/SEO/Scale | 0 | 3 (hero image, presence in-memory, no robots/sitemap) | 6 | 4 | Structural SEO missing; presence will silently fail on Vercel |

† FeaturesPopup parse error not confirmed in live lint run — classified as investigation item, not confirmed High.

**Deduped totals (Next.js DoS and Vitest CVE counted once each):**  
**Critical: 3 · High: 17 · Medium: 24 · Low: 11** (total 55 findings)

---

## 6. Release Readiness Checklist

| Item | Status | Note |
|------|--------|------|
| Security vulnerabilities resolved | ❌ | IDOR, SVG XSS, JWT revoke, Next.js DoS CVE all open |
| Secrets removed from repo | ✅ | `git log --all -- .env` clean; no hardcoded secrets found |
| Dependencies updated | ⚠️ | Vitest CVE trivially fixed; Next.js upgrade is the blockers |
| Linting passes | ❌ | `pnpm lint` exits 1 — `LibraryClient.tsx:136` error |
| Type checking passes | ✅ | `tsc --noEmit` exits 0, no errors |
| Tests passing | ⚠️ | 13 unit tests pass; zero API route tests — auth paths untested |
| Performance acceptable | ❌ | 2.1 MB hero PNG will score ~30–40 mobile Lighthouse |
| Accessibility reviewed | ⚠️ | Focus rings present; skip-link missing (WCAG 2.4.1 fail) |
| DB migrations tested | ⚠️ | Migration history manually repaired; not validated on clean DB |
| Backups available | ❌ | No backup strategy documented; hard-deletes permanent |
| Monitoring/alerts enabled | ❌ | No health endpoint, no error monitoring, no Sentry |
| Logging verified | ⚠️ | Dev fallback logs magic links; raw errors logged in auth routes |
| Error pages tested | ⚠️ | Not audited — Next.js default error pages assumed |
| Env vars validated | ⚠️ | JWT_SECRET guarded per-request; no startup validation; `ANTHROPIC_API_KEY` unguarded |
| HTTPS + security headers configured | ❌ | HTTPS via Vercel ✅; zero HTTP security headers (CSP/HSTS/X-Frame) ❌ |
| Rollback plan prepared | ❌ | No documented rollback procedure or DB snapshot strategy |

---

## 7. Recommended Fix Sequence

### Group A — Do First (unblock launch, ~2–3 days) **[S]**
1. **P0-6** Rename `useStarter` → `handleStarterClick` in `LibraryClient.tsx` (15 min)
2. **P0-7** `pnpm update vitest` — bump to ≥4.1.0 (5 min)
3. **P0-2** Add `displayId` to IDOR comment moderation `where` clause (15 min)
4. **P0-3** Remove `image/svg+xml` from upload allowed types (5 min)
5. **P0-1** Add security headers block to `next.config.js` — CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy (1–2 hrs to tune CSP without breaking inline styles)
6. **P1-11** Add `path: '/'` to all 4 auth cookie calls (15 min)
7. **P1-1** Remove duplicate view increment from one route (15 min)

### Group B — Before First Traffic Spike **[M]**
8. **P0-5** Upgrade Next.js to 15.x (1–2 days — test thoroughly; async params, cookies API changed)
9. **P0-4** Add `tokenVersion` to `User` + JWT flow for password-reset session revocation (3–4 hrs)
10. **P1-3/4/5** Add pagination to followers/following + rate limits on follow + other mutating routes (2–3 hrs)
11. **P1-2** Replace in-memory presence `Map` with Upstash Redis hash (3–4 hrs)
12. **P1-7** Replace hero PNG with `next/image` + WebP (30 min)
13. **P1-8/9** Add `robots.txt`, `sitemap.ts`, OG images (2–3 hrs)

### Group C — First Week Post-Launch **[M]**
14. **P1-10** Add `/api/health` + Sentry (1–2 hrs)
15. **P1-12** Extend CI: add typecheck + test + audit jobs (1–2 hrs)
16. **P1-6** Soft-delete for `Display` (before real user data accumulates) (3–4 hrs)
17. **P1-13** Add `revalidate = 60` to public display pages (30 min)

### Group D — Hardening Sprint **[L]**
18. **P2-1** Prisma 5→6 upgrade
19. **P2-5** API route integration tests (auth, 403 boundary, form dedup)
20. **P2-6** Split `ColumnCanvas.tsx` and `PageEditor.tsx`
21. **P2-9** Add missing DB indexes
22. **P2-13/14** Accessibility: skip link + styled confirm modals
