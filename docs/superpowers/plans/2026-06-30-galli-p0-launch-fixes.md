# My Galli — P0 Launch-Blocker Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the P0 launch blockers from the 2026-06-30 Release Readiness Audit (all except the Next.js 15 upgrade, which is a separate effort).

**Architecture:** Six independent, surgical fixes across auth, uploads, comments, config, and dependencies. No new subsystems. Each fix is isolated and independently verifiable.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Prisma/PostgreSQL, JWT (jsonwebtoken), pnpm, vitest.

## Global Constraints

- These fixes must NOT break: Google sign-in (GIS), image loading from the 4 allowed hosts (Vercel Blob, Unsplash, UI Avatars, Google), the editor's same-origin iframe cards (`/sdk/*`), or public-page embedding.
- The Pro/auth gate stays `isPro(user)` / `getUser`; do not alter unrelated behavior.
- Migrations are non-interactive: generate SQL via `prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script` → write `prisma/migrations/<ts>_<name>/migration.sql` → `prisma migrate deploy`. **The dev DB host must be `127.0.0.1:5434` (NOT `localhost` — Node resolves it to IPv6 where Postgres isn't reachable), and you must set `DATABASE_URL` inline because a machine-level var overrides `.env`:** `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` before any prisma command.
- Commit only explicit paths — the repo has stray untracked files (`Documents/`, `Images/`, `g1t.json`, `nul`) and a modified `.claude/settings.local.json` that must never be committed. Never `git add .`/`-A`/`git add src`.
- `pnpm exec tsc --noEmit` must stay clean; `pnpm lint` must PASS (exit 0) after Task 1.

---

### Task 1: Fix the lint error + patch the vitest CVE (P0-6, P0-7)

**Files:**
- Modify: `src/components/library/LibraryClient.tsx`
- Modify: `package.json` + `pnpm-lock.yaml` (via `pnpm update`)

- [ ] **Step 1: Confirm lint currently fails**

Run: `pnpm lint 2>&1 | tail -20`
Expected: a `react-hooks/rules-of-hooks` error pointing at `useStarter` in `LibraryClient.tsx`, exit code 1.

- [ ] **Step 2: Rename the misnamed function**

In `src/components/library/LibraryClient.tsx`, the local async function is named with a `use` prefix, which ESLint treats as a React hook. Rename it. Change the definition:

```tsx
  const useStarter = async (s: Starter) => {
```
to:
```tsx
  const handleStarterClick = async (s: Starter) => {
```

And change the call site:
```tsx
                      onClick={() => useStarter(s)}
```
to:
```tsx
                      onClick={() => handleStarterClick(s)}
```

- [ ] **Step 3: Verify lint passes**

Run: `pnpm lint 2>&1 | tail -20`
Expected: no `react-hooks/rules-of-hooks` error; exit code 0 (warnings are acceptable, errors are not).

- [ ] **Step 4: Patch the vitest CVE**

Run: `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"; pnpm update vitest @vitest/ui 2>&1 | tail -15`
(If `@vitest/ui` is not a dependency, just `pnpm update vitest`.) Then confirm the advisory is gone:
Run: `pnpm audit 2>&1 | grep -iA3 vitest || echo "no vitest advisory"`
Expected: vitest no longer appears as a Critical advisory (it should resolve to ≥4.1.x).

- [ ] **Step 5: Verify tests + types still pass**

Run: `pnpm exec tsc --noEmit` → no errors.
Run: `pnpm test 2>&1 | tail -5` → all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/library/LibraryClient.tsx package.json pnpm-lock.yaml
git commit -m "fix(p0): rename useStarter->handleStarterClick (lint) + patch vitest CVE"
```

---

### Task 2: Remove SVG from the upload allowlist (P0-3, stored XSS)

**Files:**
- Modify: `src/app/api/upload/route.ts`

**Why:** `image/svg+xml` is in the allowlist; SVGs can carry `<script>`. Served from Vercel Blob (or `/uploads`) and navigated to directly, they execute in the site's origin → stored XSS. Raster images can't.

- [ ] **Step 1: Drop SVG from the allowed MIME types**

In `src/app/api/upload/route.ts`, change:
```ts
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
```
to:
```ts
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
```

- [ ] **Step 2: Drop the SVG extension mapping**

In the same file, in the extension map, remove the line:
```ts
    'image/svg+xml': '.svg',
```

- [ ] **Step 3: Verify**

Run: `pnpm exec tsc --noEmit` → no errors.
Run: `grep -n "svg" src/app/api/upload/route.ts` → expect no matches.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/upload/route.ts
git commit -m "fix(p0): drop SVG from upload allowlist (stored-XSS vector)"
```

---

### Task 3: Close the IDOR in comment moderation (P0-2)

**Files:**
- Modify: `src/app/api/displays/[id]/comments/route.ts`

**Why:** `PATCH` confirms the caller owns display `[id]`, then updates `comment` by `commentId` alone — so any display owner can approve/reject a comment belonging to *another* display. Scope the update to the display.

- [ ] **Step 1: Scope the update to the display**

In `src/app/api/displays/[id]/comments/route.ts`, in the `PATCH` handler, replace:
```ts
    const comment = await db.comment.update({
      where: { id: commentId },
      data: { approved },
    })

    return NextResponse.json(comment)
```
with (only updates the comment if it belongs to THIS display; 404 otherwise):
```ts
    const result = await db.comment.updateMany({
      where: { id: commentId, displayId: id },
      data: { approved },
    })

    if (result.count === 0) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    return NextResponse.json({ id: commentId, approved })
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 3: Verify behavior (controller-assisted)**

The controller verifies live with a minted session: create two displays owned by different users each with a comment, then PATCH display-A's endpoint with display-B's `commentId` → expect **404** (previously it would have updated it). PATCH with a comment that *does* belong to display-A → **200**. (The implementer confirms the code; the controller runs the authd cross-owner check.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/displays/[id]/comments/route.ts"
git commit -m "fix(p0): scope comment moderation to the display (IDOR)"
```

---

### Task 4: Add HTTP security headers incl. CSP (P0-1)

**Files:**
- Modify: `next.config.js`

**Why:** No security headers today. Add HSTS, nosniff, Referrer-Policy, Permissions-Policy, and a Content-Security-Policy crafted for the app's real origins (GIS, the 4 image hosts, same-origin iframe cards). `frame-ancestors` is set to `'self'` (NOT `'none'`) to avoid breaking same-origin embedding; cross-origin embedding of public pages, if required later, is a separate decision.

- [ ] **Step 1: Add the `headers()` config**

Replace the entire contents of `next.config.js` with (keeps the existing `images` block, adds `headers()`):

```js
/** @type {import('next').NextConfig} */

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://images.unsplash.com https://ui-avatars.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://accounts.google.com https://oauth2.googleapis.com",
  "frame-src 'self' https://accounts.google.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'ui-avatars.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

module.exports = nextConfig
```

- [ ] **Step 2: Restart the dev server with the correct DB and confirm headers + routes**

The dev server must be restarted to pick up `next.config.js` changes. Restart it with the correct DB (see Global Constraints), then:

Run: `curl -s -D - -o /dev/null http://localhost:3000/ | grep -iE "content-security-policy|strict-transport|x-content-type|referrer-policy|permissions-policy"`
Expected: all five headers present.

Run: `for p in / /login /dashboard /explore "/library?tab=apps"; do echo "$p -> $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000$p)"; done`
Expected: 200 or 307 (auth redirect) for each — NOT 500, and the pages still render (the CSP must not block first paint).

- [ ] **Step 3: Note the browser-verification gate**

In your report, explicitly flag that the CSP MUST be verified in a real browser before production for: (a) Google sign-in (GIS popup/script), (b) images from all 4 hosts, (c) the editor's iframe cards, (d) public-page rendering — watching the browser console for `Refused to … because it violates … Content Security Policy`. If any break, the offending directive is relaxed (e.g. add the origin to `script-src`/`img-src`/`frame-src`). This is a release-gate item, not an automated check.

- [ ] **Step 4: Commit**

```bash
git add next.config.js
git commit -m "fix(p0): add security headers + CSP (HSTS, nosniff, referrer, permissions)"
```

---

### Task 5: Revoke sessions on password reset (P0-4)

**Files:**
- Modify: `prisma/schema.prisma` (User model) + new migration
- Modify: `src/lib/auth.ts` (verifyAuth + getUser)
- Modify: `src/app/api/auth/login/route.ts`, `src/app/api/auth/signup/route.ts`, `src/app/api/auth/google/route.ts` (JWT payloads + google select)
- Modify: `src/app/api/auth/reset/route.ts` (bump version)

**Why:** After a password reset, an attacker's existing 7-day JWT stays valid. A `tokenVersion` embedded in the JWT and checked against the DB invalidates all prior sessions on reset.

**Interfaces produced:** `User.tokenVersion Int @default(0)`; JWT payload now carries `tokenVersion`; `verifyAuth`/`getUser` reject tokens whose `tokenVersion` is stale.

- [ ] **Step 1: Add the schema field**

In `prisma/schema.prisma`, inside `model User`, add (next to `plan`):
```prisma
  tokenVersion Int      @default(0)
```

- [ ] **Step 2: Generate + apply the migration**

```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script > /tmp/tv.sql
```
Create `prisma/migrations/<timestamp>_add_user_tokenversion/migration.sql` (timestamp `YYYYMMDDHHMMSS`) containing:
```sql
ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
```
Then:
```bash
export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"
npx prisma migrate deploy
npx prisma generate
```
(`prisma generate` may hit EPERM on Windows if the dev server holds the dll lock — non-fatal; note it and continue.)

- [ ] **Step 3: Enforce tokenVersion in auth**

In `src/lib/auth.ts`, in BOTH `verifyAuth` and `getUser`:
- Change the decode cast from `as { userId: string }` to `as { userId: string; tokenVersion?: number }`.
- Add `tokenVersion: true,` to the `select` object (next to `plan: true`).
- After the `const user = await db.user.findUnique(...)` lookup, before returning `user`, add:
```ts
    if (!user) return null
    if ((decoded.tokenVersion ?? 0) !== user.tokenVersion) return null
```
(Existing tokens have no `tokenVersion` → treated as `0` → still valid until a reset bumps the DB value, so this does not log everyone out on deploy.)

- [ ] **Step 4: Embed tokenVersion in newly-issued JWTs**

- `src/app/api/auth/login/route.ts` (line ~56): change `{ userId: user.id }` → `{ userId: user.id, tokenVersion: user.tokenVersion }`. (Login's `findUnique` has no `select`, so `user.tokenVersion` is present.)
- `src/app/api/auth/signup/route.ts` (line ~99): change `{ userId: user.id }` → `{ userId: user.id, tokenVersion: user.tokenVersion }`. (Ensure the user object the route holds includes `tokenVersion`; a freshly-created user defaults to `0` — if the create uses a `select`, add `tokenVersion: true` to it; otherwise `user.tokenVersion` is present.)
- `src/app/api/auth/google/route.ts`: add `tokenVersion: true,` to BOTH `select` blocks (the `findFirst` at ~line 78 and the `create` at ~line 111), then change the sign call (~line 116) `{ userId: user.id }` → `{ userId: user.id, tokenVersion: user.tokenVersion }`.

- [ ] **Step 5: Bump tokenVersion on reset**

In `src/app/api/auth/reset/route.ts`, change:
```ts
    await db.user.update({ where: { id: userId }, data: { password: await hash(password, 12) } })
```
to:
```ts
    await db.user.update({
      where: { id: userId },
      data: { password: await hash(password, 12), tokenVersion: { increment: 1 } },
    })
```

- [ ] **Step 6: Verify**

Run: `pnpm exec tsc --noEmit` → no errors.
Run: `pnpm test 2>&1 | tail -5` → all tests pass.
Controller verification (authd, with a minted session): mint a JWT for a test user (payload `{userId, tokenVersion:0}`), confirm `GET /api/auth/me` → 200; then `UPDATE "User" SET "tokenVersion" = 1` for that user; re-call `/api/auth/me` with the SAME token → expect **401** (session revoked). Restore the row afterward.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/auth.ts "src/app/api/auth/login/route.ts" "src/app/api/auth/signup/route.ts" "src/app/api/auth/google/route.ts" "src/app/api/auth/reset/route.ts"
git commit -m "fix(p0): revoke sessions on password reset via User.tokenVersion"
```

---

## Self-Review

**Spec coverage (P0 blockers from the audit):**
- P0-1 security headers + CSP → Task 4. ✅
- P0-2 IDOR comment moderation → Task 3. ✅
- P0-3 SVG upload XSS → Task 2. ✅
- P0-4 password reset session revocation → Task 5. ✅
- P0-5 Next.js 15 upgrade → **deliberately excluded** (separate effort, per decision). ✅
- P0-6 lint failure (`useStarter`) → Task 1. ✅
- P0-7 vitest CVE → Task 1. ✅

**Placeholder scan:** No "TBD"/uncoded steps — every change shows exact code. The CSP browser-verification is explicitly flagged as a human release-gate (Task 4 Step 3), not a silent gap.

**Type consistency:** `tokenVersion: number` is consistent across schema, the JWT payload at all three sign sites, and the `(decoded.tokenVersion ?? 0) !== user.tokenVersion` check in both `verifyAuth` and `getUser`. The comment fix returns `{ id, approved }` (a plain object, since `updateMany` returns a count, not the row).

## Notes / risks
- **Task 4 (CSP) is the highest-risk change** — a wrong directive can break Google login or embeds in the browser, which curl can't fully catch. Treat the browser verification as a hard release gate. If uncertain, the fallback is `Content-Security-Policy-Report-Only` to observe violations before enforcing — but enforced is the goal.
- The Next.js 15 upgrade (DoS CVE P0-5) is tracked separately and remains a launch blocker until done.
