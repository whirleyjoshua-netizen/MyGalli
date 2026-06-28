# Galli Email Auth Implementation Plan (Sub-project 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Add industry-standard email verification and password reset on top of the existing email/password + Google JWT auth, using Resend with a dev-console fallback so it works before a key is configured.

**Architecture:** A `VerificationToken` model backs single-use, expiring tokens for two purposes (`verify`, `reset`). A thin `src/lib/email.ts` sends via Resend when `RESEND_API_KEY` is set and otherwise logs the link to the console (dev). Pure token logic (generation, expiry) lives in tested `src/lib/auth-tokens.ts`. New API routes + pages drive the flows; an unverified banner nudges verification without blocking login.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + PostgreSQL, bcryptjs, jsonwebtoken, Resend, Vitest.

## Global Constraints

- **Login still works while unverified** — verification is encouraged via a banner, not enforced.
- **Verify token TTL = 24h; reset token TTL = 1h.** Tokens are single-use (deleted on consume).
- **Forgot-password never leaks account existence** — always returns success.
- **Email sender:** Resend via `RESEND_API_KEY` + `EMAIL_FROM` (default `Galli <onboarding@resend.dev>`). With no key, log the email + link to the server console (dev fallback, no hard failure).
- **Rate-limit** the send/reset endpoints with the existing `rateLimit(request, { limit, windowMs, prefix })` (returns `NextResponse | null`; call first, return if non-null).
- **DB safety + migrations (repo memory):** machine `DATABASE_URL` overrides `.env` — set inline every command: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>`. `migrate dev` is non-interactive-incompatible; use `migrate diff … --script` → write `prisma/migrations/<ts>_<name>/migration.sql` → `migrate deploy`. Confirm datasource `pages`/`5434`.
- Verify: `pnpm build` (stop dev server first), `pnpm test`, `pnpm exec tsc --noEmit`. Auth cookie constant: `AUTH_COOKIE` from `@/lib/constants`. JWT: `getJwtSecret()` from `@/lib/auth`. Async route params.

---

### Task 1: Schema — emailVerified + VerificationToken + migration

**Files:** Modify `prisma/schema.prisma`; create `prisma/migrations/20260628020000_add_email_verification/migration.sql`.

- [ ] **Step 1: Edit schema.** Add to `model User`: `emailVerified DateTime?` and `verificationTokens VerificationToken[]`. Add the model:

```prisma
model VerificationToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  type      String   // 'verify' | 'reset'
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Generate + inspect SQL** — `npx prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma\schema.prisma --script` (confirm datasource `pages`/`5434`; additive: ADD COLUMN emailVerified, CREATE TABLE VerificationToken, index, FK). Write it to the migration.sql path above.
- [ ] **Step 3: Apply** — `npx prisma migrate deploy` then `npx prisma generate`.
- [ ] **Step 4: Verify + build + commit**
```
docker exec pages-mvp-postgres-1 psql -U pages -d pages -tAc 'SELECT to_regclass('"'"'public."VerificationToken"'"'"');'
```
```bash
git add prisma/schema.prisma prisma/migrations/20260628020000_add_email_verification
git commit -m "feat(auth): emailVerified + VerificationToken migration"
```

---

### Task 2: Email sender (Resend + dev fallback)

**Files:** Create `src/lib/email.ts`. Modify `package.json` (add `resend`), `.env.example`.

**Interfaces:** Produces `sendEmail(opts: { to: string; subject: string; html: string }): Promise<void>`; `verificationEmail(link: string): { subject: string; html: string }`; `resetEmail(link: string): { subject: string; html: string }`.

- [ ] **Step 1: Install Resend** — `$env:DATABASE_URL='…'; pnpm add resend` (Expected: adds `resend` to dependencies).

- [ ] **Step 2: Implement**

```ts
// src/lib/email.ts
import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'Galli <onboarding@resend.dev>'

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    // Dev fallback: no provider configured — log so links are usable locally.
    console.log(`\n[email:dev] To: ${opts.to}\n[email:dev] Subject: ${opts.subject}\n[email:dev] ${opts.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}\n`)
    return
  }
  const resend = new Resend(key)
  await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html })
}

function shell(title: string, body: string, cta: { href: string; label: string }): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0F3D2E">${title}</h1>
    <p style="color:#475569;font-size:14px;line-height:1.6">${body}</p>
    <a href="${cta.href}" style="display:inline-block;margin-top:16px;background:#39D98A;color:#fff;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:600">${cta.label}</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px">If the button doesn't work, paste this link: ${cta.href}</p>
  </div>`
}

export function verificationEmail(link: string) {
  return { subject: 'Verify your Galli email', html: shell('Welcome to Galli', 'Confirm your email to secure your account.', { href: link, label: 'Verify email' }) }
}

export function resetEmail(link: string) {
  return { subject: 'Reset your Galli password', html: shell('Reset your password', 'Click below to choose a new password. This link expires in 1 hour.', { href: link, label: 'Reset password' }) }
}
```

- [ ] **Step 3: Document env** — append to `.env.example`:
```
# Email (optional — links log to the server console in dev if unset)
# RESEND_API_KEY=""
# EMAIL_FROM="Galli <onboarding@resend.dev>"
```

- [ ] **Step 4: Build, commit**
```bash
git add src/lib/email.ts package.json pnpm-lock.yaml .env.example
git commit -m "feat(auth): Resend email sender with dev-console fallback"
```

---

### Task 3: Token helpers (TDD)

**Files:** Create `src/lib/auth-tokens.ts`, `src/__tests__/auth-tokens.test.ts`.

**Interfaces:** Produces `generateToken(): string` (URL-safe, ≥32 chars); `tokenTtlMs(type: 'verify' | 'reset'): number` (verify=24h, reset=1h); `isExpired(expiresAt: Date, now?: Date): boolean`. Plus DB helpers `createToken(userId, type)` and `consumeToken(token, type)` (not unit-tested — DB).

- [ ] **Step 1: Write failing tests**

```ts
// src/__tests__/auth-tokens.test.ts
import { describe, it, expect } from 'vitest'
import { generateToken, tokenTtlMs, isExpired } from '@/lib/auth-tokens'

describe('generateToken', () => {
  it('returns a long url-safe token', () => {
    const t = generateToken()
    expect(t.length).toBeGreaterThanOrEqual(32)
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/)
  })
  it('returns unique values', () => {
    expect(generateToken()).not.toBe(generateToken())
  })
})

describe('tokenTtlMs', () => {
  it('verify is 24h, reset is 1h', () => {
    expect(tokenTtlMs('verify')).toBe(24 * 60 * 60 * 1000)
    expect(tokenTtlMs('reset')).toBe(60 * 60 * 1000)
  })
})

describe('isExpired', () => {
  it('true when expiry is in the past', () => {
    expect(isExpired(new Date(Date.now() - 1000))).toBe(true)
  })
  it('false when expiry is in the future', () => {
    expect(isExpired(new Date(Date.now() + 60_000))).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect fail** (`pnpm vitest run src/__tests__/auth-tokens.test.ts`).

- [ ] **Step 3: Implement**

```ts
// src/lib/auth-tokens.ts
import { randomBytes } from 'crypto'
import { db } from './db'

export type TokenType = 'verify' | 'reset'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function tokenTtlMs(type: TokenType): number {
  return type === 'verify' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime()
}

export async function createToken(userId: string, type: TokenType): Promise<string> {
  const token = generateToken()
  await db.verificationToken.create({
    data: { token, userId, type, expiresAt: new Date(Date.now() + tokenTtlMs(type)) },
  })
  return token
}

// Returns the userId if valid (correct type, not expired); always single-use.
export async function consumeToken(token: string, type: TokenType): Promise<string | null> {
  const row = await db.verificationToken.findUnique({ where: { token } })
  if (!row || row.type !== type) return null
  await db.verificationToken.delete({ where: { token } }).catch(() => {})
  if (isExpired(row.expiresAt)) return null
  return row.userId
}
```

- [ ] **Step 4: Run — expect pass. Commit.**
```bash
git add src/lib/auth-tokens.ts src/__tests__/auth-tokens.test.ts
git commit -m "feat(auth): tested token helpers + DB create/consume"
```

---

### Task 4: Verification flow — signup sends email, verify + resend routes

**Files:** Modify `src/app/api/auth/signup/route.ts`; create `src/app/api/auth/verify/route.ts`, `src/app/api/auth/resend-verification/route.ts`.

**Interfaces:** Consumes `createToken`, `consumeToken`, `sendEmail`, `verificationEmail`, `getUser`, `rateLimit`. `POST /api/auth/verify` body `{ token }` → `{ verified: true }` or 400. `POST /api/auth/resend-verification` (auth) → `{ sent: true }`.

- [ ] **Step 1: Signup sends a verification email.** In `src/app/api/auth/signup/route.ts`, after the `const user = await db.user.create(...)` block and before generating the JWT, add:

```ts
    // Fire a verification email (non-blocking on failure)
    try {
      const token = await createToken(user.id, 'verify')
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      const { subject, html } = verificationEmail(`${appUrl}/verify?token=${token}`)
      await sendEmail({ to: user.email, subject, html })
    } catch (e) {
      console.error('Verification email failed:', e)
    }
```
Add imports at top: `import { createToken } from '@/lib/auth-tokens'` and `import { sendEmail, verificationEmail } from '@/lib/email'`.

- [ ] **Step 2: Verify route**

```ts
// src/app/api/auth/verify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { consumeToken } from '@/lib/auth-tokens'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token || typeof token !== 'string') return NextResponse.json({ error: 'Missing token' }, { status: 400 })
    const userId = await consumeToken(token, 'verify')
    if (!userId) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    await db.user.update({ where: { id: userId }, data: { emailVerified: new Date() } })
    return NextResponse.json({ verified: true })
  } catch (e) {
    console.error('Verify error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Resend route (rate-limited, auth)**

```ts
// src/app/api/auth/resend-verification/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getUser } from '@/lib/auth'
import { createToken } from '@/lib/auth-tokens'
import { sendEmail, verificationEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 5, windowMs: 60_000, prefix: 'resend-verify' })
  if (limited) return limited
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const fresh = await db.user.findUnique({ where: { id: me.id }, select: { email: true, emailVerified: true } })
    if (!fresh) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (fresh.emailVerified) return NextResponse.json({ sent: true }) // already verified, no-op
    const token = await createToken(me.id, 'verify')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { subject, html } = verificationEmail(`${appUrl}/verify?token=${token}`)
    await sendEmail({ to: fresh.email, subject, html })
    return NextResponse.json({ sent: true })
  } catch (e) {
    console.error('Resend verify error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 4: Build, curl smoke (signup logs a verify link in dev console; POST that token to /verify → {verified:true}; reuse → 400), commit**
```bash
git add "src/app/api/auth/signup/route.ts" "src/app/api/auth/verify" "src/app/api/auth/resend-verification"
git commit -m "feat(auth): send verification email on signup + verify/resend routes"
```

---

### Task 5: Password reset flow

**Files:** Create `src/app/api/auth/forgot/route.ts`, `src/app/api/auth/reset/route.ts`.

**Interfaces:** `POST /api/auth/forgot` body `{ email }` → always `{ sent: true }`. `POST /api/auth/reset` body `{ token, password }` → `{ reset: true }` or 400.

- [ ] **Step 1: Forgot route (rate-limited, no enumeration)**

```ts
// src/app/api/auth/forgot/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createToken } from '@/lib/auth-tokens'
import { sendEmail, resetEmail } from '@/lib/email'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 5, windowMs: 60_000, prefix: 'forgot' })
  if (limited) return limited
  try {
    const { email } = await request.json()
    if (typeof email === 'string' && email.includes('@')) {
      const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } })
      if (user) {
        const token = await createToken(user.id, 'reset')
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const { subject, html } = resetEmail(`${appUrl}/reset?token=${token}`)
        await sendEmail({ to: user.email, subject, html })
      }
    }
    return NextResponse.json({ sent: true }) // never reveal whether the email exists
  } catch (e) {
    console.error('Forgot error:', e)
    return NextResponse.json({ sent: true })
  }
}
```

- [ ] **Step 2: Reset route**

```ts
// src/app/api/auth/reset/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { consumeToken } from '@/lib/auth-tokens'
import { rateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 10, windowMs: 60_000, prefix: 'reset' })
  if (limited) return limited
  try {
    const { token, password } = await request.json()
    if (!token || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const userId = await consumeToken(token, 'reset')
    if (!userId) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    await db.user.update({ where: { id: userId }, data: { password: await hash(password, 12) } })
    return NextResponse.json({ reset: true })
  } catch (e) {
    console.error('Reset error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Build, curl smoke (forgot logs a reset link; reset with that token + new password → {reset:true}; login with new password works), commit**
```bash
git add "src/app/api/auth/forgot" "src/app/api/auth/reset"
git commit -m "feat(auth): forgot + reset password routes"
```

---

### Task 6: Pages — verify, forgot, reset + login link

**Files:** Create `src/app/(auth)/verify/page.tsx`, `src/app/(auth)/forgot/page.tsx`, `src/app/(auth)/reset/page.tsx`. Modify `src/app/(auth)/login/page.tsx`.

**Interfaces:** Consume the routes from Tasks 4–5. Reuse the auth-page styling (surface card + brand backdrop + Wordmark) from the existing login/signup pages.

- [ ] **Step 1: Verify page** — client page reading `?token` (via `useSearchParams`), POSTing to `/api/auth/verify` on mount, showing one of: verifying… / "Email verified ✓" (link to /dashboard) / "Link invalid or expired" (button to resend if logged in, else link to /login). Wrap the `useSearchParams` usage in a `<Suspense>` boundary (Next requirement).

- [ ] **Step 2: Forgot page** — email input → POST `/api/auth/forgot` → always show "If that email exists, we sent a reset link." Reuse the auth card styling.

- [ ] **Step 3: Reset page** — read `?token`, password + confirm inputs → POST `/api/auth/reset`; on success show "Password updated" + link to /login; on 400 show the error. `<Suspense>` around `useSearchParams`.

- [ ] **Step 4: Login link** — in `src/app/(auth)/login/page.tsx`, add a "Forgot password?" `<Link href="/forgot">` under the password field (small, right-aligned, `text-primary`).

- [ ] **Step 5: Build, manual check, commit**
```bash
git add "src/app/(auth)/verify" "src/app/(auth)/forgot" "src/app/(auth)/reset" "src/app/(auth)/login/page.tsx"
git commit -m "feat(auth): verify, forgot, reset pages + login link"
```

---

### Task 7: Expose emailVerified + unverified banner

**Files:** Modify `src/lib/auth.ts` (add `emailVerified` to both `select`s), `src/app/api/auth/login/route.ts` + `src/app/api/auth/signup/route.ts` + `src/app/api/auth/google/route.ts` (add `emailVerified` to the returned user `select`), `src/lib/store.ts` (User type), and `src/components/dashboard/Sidebar.tsx` (or the dashboard layout) for the banner. Create `src/components/auth/VerifyBanner.tsx`.

**Interfaces:** `getUser`/`verifyAuth` return `emailVerified: Date | null`; store `user.emailVerified` available client-side.

- [ ] **Step 1: Add `emailVerified: true` to the `select` in both `getUser` and `verifyAuth` in `src/lib/auth.ts`, and to the user `select`/return in the login, signup, and google routes** so the client receives it.

- [ ] **Step 2: Extend the store's `User` type** in `src/lib/store.ts` with `emailVerified?: string | null`.

- [ ] **Step 3: VerifyBanner component**

```tsx
// src/components/auth/VerifyBanner.tsx
'use client'
import { useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { MailWarning } from 'lucide-react'

export function VerifyBanner() {
  const { user } = useAuthStore()
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!user || user.emailVerified) return null
  const resend = async () => {
    setBusy(true)
    try { await fetch('/api/auth/resend-verification', { method: 'POST' }); setSent(true) } finally { setBusy(false) }
  }
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm">
      <MailWarning className="w-4 h-4 shrink-0" />
      <span className="flex-1">Verify your email to secure your account.</span>
      {sent ? <span className="text-amber-700 font-medium">Sent — check your inbox</span> : (
        <button onClick={resend} disabled={busy} className="font-semibold underline hover:no-underline disabled:opacity-50 cursor-pointer">Resend email</button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Render the banner** at the top of the dashboard main area — in `src/app/(dashboard)/layout.tsx`, render `<VerifyBanner />` just inside `<main>` above `{children}`.

- [ ] **Step 5: Build, manual check (unverified user sees banner; after verifying, banner gone), commit**
```bash
git add src/lib/auth.ts src/lib/store.ts "src/app/api/auth/login/route.ts" "src/app/api/auth/signup/route.ts" "src/app/api/auth/google/route.ts" src/components/auth/VerifyBanner.tsx "src/app/(dashboard)/layout.tsx"
git commit -m "feat(auth): expose emailVerified + unverified banner"
```

---

## Self-Review

**Spec coverage (sub-project 3):**
- `User.emailVerified` + `VerificationToken` (verify|reset, expiring) → Task 1. ✅
- Resend sender + console fallback, env `RESEND_API_KEY`/`EMAIL_FROM` → Task 2. ✅
- Signup → verification email → verify link → set `emailVerified` → Tasks 4. ✅
- Unverified banner + resend → Task 7. ✅
- Forgot → reset email → reset link → set password → Task 5 + pages Task 6. ✅
- Rate-limit send endpoints → Tasks 4 (resend), 5 (forgot/reset). ✅
- Tokens single-use + expiring (verify 24h, reset 1h), no email enumeration → Tasks 3, 5. ✅

**Placeholder scan:** Task 6 describes the three auth pages at assembly level (they reuse the existing login/signup card pattern and consume fixed route contracts) rather than full JSX — a conscious altitude choice; everything they call is fully specified. All libs/routes/schema have complete code.

**Type consistency:** `createToken(userId, type)`/`consumeToken(token, type)` with `TokenType = 'verify'|'reset'` consistent Tasks 3/4/5. `sendEmail({to,subject,html})` + `verificationEmail`/`resetEmail` returning `{subject,html}` consistent Tasks 2/4/5. `emailVerified` threaded through auth selects + store + banner (Task 7).
