# Galli Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "Gallio" identity with "Galli" everywhere user-visible — brand copy, color tokens, logo lockups, and the auth cookie — with no broken styles.

**Architecture:** Four mechanical-but-verified tasks. Color token rename first (highest blast radius), then a reusable wordmark replaces frog logos, then copy, then the auth cookie via a shared constant. Each task is gated by a grep that proves zero stragglers plus the existing build/test suite — because a missed `gallio-*` Tailwind class fails silently (no error, just no style).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Vitest.

## Global Constraints

- Brand name is **Galli** (capital G), wordmark only. Frog retired from main UI; `public/gallio-frog.svg` kept solely as a favicon fallback (asset file NOT renamed).
- Tailwind brand color token renames `gallio` → `galli`; values unchanged (`#39D98A` etc.).
- Theme stays as-is in this sub-project (light theme restyle is sub-project 2). Do NOT restyle layouts here — only rename/replace identity.
- Auth cookie renames `gallio-auth` → `galli-auth` (one-time re-login is acceptable).
- Run every command with the correct DB URL inline (machine env var overrides `.env`):
  `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>` (PowerShell).
- Verification commands: `pnpm build` and `pnpm test` (vitest). The dev server is already running; restart not required for these.

---

### Task 1: Rename Tailwind brand token `gallio` → `galli`

Renames the color token + gradient utilities and every `gallio-*` className. Build does NOT catch a missed class, so the gate is a grep returning zero.

**Files:**
- Modify: `tailwind.config.ts:28-34` (the `gallio: {…}` color block)
- Modify: `src/app/globals.css:42-55` (`.text-gallio-gradient`, `.bg-gallio-gradient`, `.border-gallio-gradient` + comment)
- Modify (className `gallio-` / `gallio/` usages, ~104 occurrences across 25 files): `src/middleware.ts`, `src/app/create/page.tsx`, `src/lib/auth.ts`, `src/components/enterprise/*` (SolutionSection, EnterpriseFooter, SchoolSection, AthleticSection, PricingTeaser, HowItWorks, HeroSection, EnterpriseNav), `src/components/explore/ExploreClient.tsx`, `src/components/explore/ExploreCard.tsx`, `src/app/page.tsx`, `src/app/explore/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/api/auth/{signup,logout,login,google}/route.ts`, `src/app/(dashboard)/dashboard/page.tsx`, `src/app/(dashboard)/card-studio/page.tsx`, `src/components/editor/CardLibraryPicker.tsx`

**Interfaces:**
- Produces: Tailwind utilities `bg-galli`, `text-galli-violet`, `text-galli-gradient`, `bg-galli-gradient`, etc. (consumed by Task 2's wordmark and the rest of the app).

- [ ] **Step 1: Rename the token in `tailwind.config.ts`**

```ts
        galli: {
          DEFAULT: '#39D98A',
          dark: '#0F3D2E',
          aqua: '#1FB6FF',
          violet: '#6C63FF',
          light: '#A8F0C8',
        },
```

- [ ] **Step 2: Rename the gradient utilities + comment in `src/app/globals.css`**

Replace lines 42-55 with:

```css
/* Galli brand gradient text */
@layer utilities {
  .text-galli-gradient {
    background: linear-gradient(135deg, #39D98A, #1FB6FF, #6C63FF);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .bg-galli-gradient {
    background: linear-gradient(135deg, #39D98A, #1FB6FF, #6C63FF);
  }
  .border-galli-gradient {
    border-image: linear-gradient(135deg, #39D98A, #1FB6FF, #6C63FF) 1;
  }
}
```

- [ ] **Step 3: Replace all `gallio-` and `gallio/` class fragments under `src/`**

This is a literal, case-sensitive substring replace of `gallio` → `galli` applied ONLY to occurrences inside `className`/CSS contexts (i.e. the `gallio-*` and `gallio/NN` and `gallio-gradient` usages). Do NOT touch the string `/gallio-frog.svg` (handled in Task 2) or capital-G `Gallio` copy (Task 3) or `gallio-auth` (Task 4) in this step.

Apply per file. Example transforms:
- `bg-gradient-to-r from-gallio/15 via-gallio-aqua/10 to-gallio-violet/15` → `from-galli/15 via-galli-aqua/10 to-galli-violet/15`
- `text-gallio-gradient` → `text-galli-gradient`
- `bg-gallio/10 text-gallio-dark border-gallio/20` → `bg-galli/10 text-galli-dark border-galli/20`

- [ ] **Step 4: Grep gate — zero `gallio-`/`gallio/` class fragments remain**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; Select-String -Path src\**\*.tsx,src\**\*.ts,src\**\*.css,tailwind.config.ts -Pattern 'gallio[-/]' | Select-Object -ExpandProperty Line`
Expected: only lines containing `gallio-frog.svg` or `gallio-auth` (those belong to Tasks 2 and 4). NO `gallio-aqua`, `gallio-violet`, `gallio-dark`, `gallio/`, `gallio-gradient`, or bare `gallio` token references.

- [ ] **Step 5: Build gate**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add tailwind.config.ts src/app/globals.css src
git commit -m "refactor: rename gallio Tailwind token to galli"
```

---

### Task 2: Galli wordmark replaces frog logos

Creates one reusable wordmark and removes all 14 `/gallio-frog.svg` usages from the UI.

**Files:**
- Create: `src/components/brand/Wordmark.tsx`
- Modify (logo lockups → wordmark): `src/app/page.tsx:81,230`, `src/components/explore/ExploreClient.tsx:154`, `src/components/enterprise/EnterpriseNav.tsx:27`, `src/components/enterprise/EnterpriseFooter.tsx:13`, `src/app/(auth)/login/page.tsx:51`, `src/app/(auth)/signup/page.tsx:53`, `src/app/(dashboard)/dashboard/page.tsx:443`, `src/app/(dashboard)/card-studio/page.tsx:169`
- Modify (decorative frog → remove the `<Image>`): `src/app/page.tsx:109` (80px hero), `src/app/(dashboard)/dashboard/page.tsx:565` (64px empty-state), `src/components/explore/ExploreClient.tsx:277`

**Interfaces:**
- Consumes: `text-galli-gradient` utility from Task 1.
- Produces: `Wordmark` component — `export function Wordmark(props: { className?: string }): JSX.Element`.

- [ ] **Step 1: Create the wordmark component**

```tsx
// src/components/brand/Wordmark.tsx
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-extrabold tracking-tight text-galli-gradient ${className ?? ''}`}>
      Galli
    </span>
  )
}
```

- [ ] **Step 2: Replace each logo-lockup frog with the wordmark**

For every "logo lockup" site listed above, remove the `<Image src="/gallio-frog.svg" … />` AND any adjacent literal "Gallio"/"Galli" text span (the wordmark now carries the name), and render `<Wordmark />`. Import it: `import { Wordmark } from '@/components/brand/Wordmark'`.

Example — `src/app/(dashboard)/dashboard/page.tsx:442-445`, before:

```tsx
<Link href="/" className="flex items-center gap-3 text-2xl font-extrabold">
  <Image src="/gallio-frog.svg" alt="" width={38} height={38} className="drop-shadow-sm" />
  <span className="text-galli-gradient tracking-tight">Gallio</span>
</Link>
```

after:

```tsx
<Link href="/" className="flex items-center text-2xl">
  <Wordmark />
</Link>
```

Sizing guidance per site: nav/header lockups use default (inherits surrounding `text-2xl`/`text-xl`); auth screens (`login`/`signup`) wrap in `text-3xl`; footers use `text-xl`. Keep each link/anchor wrapper and its `href`.

- [ ] **Step 3: Remove the three decorative frog illustrations**

Delete only the `<Image src="/gallio-frog.svg" … />` element at each decorative site (`page.tsx:109`, `dashboard/page.tsx:565`, `ExploreClient.tsx:277`). Leave surrounding headings/text and layout wrappers intact (final hero/empty-state visuals are finalized in sub-project 2).

- [ ] **Step 4: Remove now-unused `Image` imports**

In each modified file, if `Image` from `next/image` is no longer referenced, remove the import to keep the build lint-clean. (Check: dashboard still uses `Image` for cover images — keep it there.)

- [ ] **Step 5: Grep gate — no frog in the UI**

Run: `Select-String -Path src\**\*.tsx -Pattern 'gallio-frog'`
Expected: zero matches.

- [ ] **Step 6: Build gate**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/brand/Wordmark.tsx src
git commit -m "feat: replace frog logos with Galli wordmark"
```

---

### Task 3: Rebrand user-facing copy "Gallio" → "Galli"

Replaces the 43 capital-G "Gallio" copy occurrences, including metadata and the AI system prompt.

**Files:**
- Modify: `src/app/layout.tsx:7,11-12,18-19,25` (titles, template, siteName, `APP_URL` fallback)
- Modify (copy, ~43 occurrences): `src/components/explore/ExploreClient.tsx`, `src/components/tabs/PublicTabView.tsx`, `src/components/enterprise/{WaitlistForm,SolutionSection,HeroSection,EnterpriseNav,EnterpriseFooter}.tsx`, `src/lib/ai/system-prompt.ts`, `src/app/enterprise/page.tsx`, `src/app/explore/page.tsx`, `src/components/elements/TimelineElement.tsx`, `src/app/[username]/[slug]/page.tsx`, `src/app/s/[code]/page.tsx`, `src/app/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(dashboard)/card-studio/page.tsx`, `src/app/(dashboard)/dashboard/page.tsx`

**Interfaces:** None consumed/produced (copy only).

- [ ] **Step 1: Update root metadata in `src/app/layout.tsx`**

```tsx
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://galli.page'

export const metadata: Metadata = {
  title: {
    default: 'Galli — A living gallery of you.',
    template: '%s | Galli',
  },
  description: 'Create, share, and track beautiful interactive displays. Build your personal page with kits for athletes, resumes, weddings, and more.',
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: 'website',
    siteName: 'Galli',
    title: 'Galli — A living gallery of you.',
    description: 'Create, share, and track beautiful interactive displays.',
    url: APP_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Galli — A living gallery of you.',
    description: 'Create, share, and track beautiful interactive displays.',
  },
}
```

- [ ] **Step 2: Replace remaining capital-G "Gallio" copy**

Literal case-sensitive replace `Gallio` → `Galli` across the files listed above (JSX text, `alt` attributes, prose in `system-prompt.ts`). Skip any occurrence that is part of `gallio-frog.svg` (already gone) — only the word `Gallio` remains to change.

- [ ] **Step 3: Grep gate — no "Gallio" copy remains**

Run: `Select-String -Path src\**\*.tsx,src\**\*.ts -Pattern 'Gallio'`
Expected: zero matches.

- [ ] **Step 4: Build gate**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "refactor: rebrand user-facing copy Gallio to Galli"
```

---

### Task 4: Rename auth cookie `gallio-auth` → `galli-auth` via shared constant

Extracts the cookie name to one dependency-free constant (DRY; safe to import from middleware), renames it, and adds a guard test.

**Files:**
- Create: `src/lib/constants.ts`
- Create: `src/lib/constants.test.ts`
- Modify: `src/lib/auth.ts:41`, `src/middleware.ts:19`, `src/app/api/auth/signup/route.ts:91`, `src/app/api/auth/logout/route.ts:6`, `src/app/api/auth/login/route.ts:71`, `src/app/api/auth/google/route.ts:128`

**Interfaces:**
- Produces: `export const AUTH_COOKIE = 'galli-auth'` in `src/lib/constants.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/constants.test.ts
import { describe, it, expect } from 'vitest'
import { AUTH_COOKIE } from './constants'

describe('AUTH_COOKIE', () => {
  it('is the galli-auth cookie name', () => {
    expect(AUTH_COOKIE).toBe('galli-auth')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm vitest run src/lib/constants.test.ts`
Expected: FAIL — cannot resolve `./constants` (module not yet created).

- [ ] **Step 3: Create the constant**

```ts
// src/lib/constants.ts
export const AUTH_COOKIE = 'galli-auth'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm vitest run src/lib/constants.test.ts`
Expected: PASS.

- [ ] **Step 5: Use the constant at all 6 cookie sites**

In each of the 6 files, add `import { AUTH_COOKIE } from '@/lib/constants'` (use a relative path `./constants` in `src/lib/auth.ts`) and replace the literal `'gallio-auth'` with `AUTH_COOKIE`. Examples:

`src/lib/auth.ts:41` → `const token = request.cookies.get(AUTH_COOKIE)?.value`
`src/middleware.ts:19` → `const token = request.cookies.get(AUTH_COOKIE)?.value`
`src/app/api/auth/login/route.ts:71` → `response.cookies.set(AUTH_COOKIE, token, {`
`src/app/api/auth/signup/route.ts:91` → `response.cookies.set(AUTH_COOKIE, token, {`
`src/app/api/auth/google/route.ts:128` → `response.cookies.set(AUTH_COOKIE, token, {`
`src/app/api/auth/logout/route.ts:6` → `response.cookies.set(AUTH_COOKIE, '', {`

- [ ] **Step 6: Grep gate — no literal `gallio-auth` remains**

Run: `Select-String -Path src\**\*.ts,src\**\*.tsx -Pattern 'gallio-auth'`
Expected: zero matches.

- [ ] **Step 7: Build + full test suite gate**

Run: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; pnpm build; pnpm test`
Expected: build succeeds; all vitest tests pass (existing 30 + the new one).

- [ ] **Step 8: Manual smoke — login round-trips with the new cookie**

With the dev server running: log out, log in with a demo account (`marcus@demo.gallio.app` / `demo1234`), confirm the dashboard loads and a `galli-auth` cookie is set (DevTools → Application → Cookies). Confirm a protected route (`/dashboard`) stays accessible and `/editor` loads.

- [ ] **Step 9: Commit**

```bash
git add src/lib/constants.ts src/lib/constants.test.ts src
git commit -m "refactor: rename auth cookie to galli-auth via shared constant"
```

---

## Self-Review

**Spec coverage (sub-project 1 section):**
- "Replace user-facing Gallio → Galli (landing, dashboard, metadata, auth, email templates)" → Task 3 (email templates don't exist yet — created in sub-project 3 already branded Galli).
- "New Galli wordmark; remove frog; favicon fallback" → Task 2 (asset retained, not renamed).
- "Tailwind gallio-* → galli-* via find/replace; build+tests verify" → Task 1 (grep gate added because build alone is insufficient).
- "Cookie gallio-auth → galli-auth; update auth.ts, middleware, store" → Task 4. NOTE: verified the Zustand store (`src/lib/store.ts`) does NOT write the cookie (project memory was stale on this) — the cookie is set only in the 6 server-side files listed. The grep gate in Step 6 is the backstop if any other literal exists.

**Placeholder scan:** none — every step has concrete code or an exact command.

**Type consistency:** `Wordmark` signature matches between Task 2 definition and its usages; `AUTH_COOKIE` name consistent across Task 4.
