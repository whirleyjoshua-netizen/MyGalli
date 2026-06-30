# Code Quality / Type Safety / Testing Audit — 2026-06-30

**Scope:** `src/` (~325 files, ~39 k lines). Next.js 14 App Router + TypeScript strict mode.

## Summary

- `tsc --noEmit`: **0 errors** (clean)
- `pnpm lint`: **2 errors, ~8 warnings**
- `any` usages: **44 occurrences across 22 files**
- `@ts-ignore` / `@ts-expect-error`: **0**
- `console.log` in app code: **4 occurrences** (1 real, 3 in code-block template strings)
- `TODO/FIXME/HACK/XXX`: **0**
- Files > 500 lines: **4** (ColumnCanvas 1451, PageEditor 1277, canvas.ts 1030, kits/generate.ts 959)
- Circular deps: **1** (`lib/fonts.ts ↔ lib/google-fonts-data.ts`)
- Test files: **13** (unit/integration helpers only; 0 API route tests, 0 e2e)

---

## Findings

---

### [Critical] React Hook called inside a callback — runtime crash risk

**Severity:** Critical
**File:** `src/components/library/LibraryClient.tsx:64,136`

A function named `useStarter` is defined as a regular `async` function (not a component/hook) at line 64, then invoked in an `onClick` at line 136. ESLint reports: `React Hook "useStarter" cannot be called inside a callback`. If `useStarter` internally calls any real hook (or if React's linter warning fires at build time), this will break at runtime.

**Why it matters:** Hook rule violations can cause React to throw during render or user interaction in production.

**Recommendation:** Rename `useStarter` to `handleStarterClick` (or any non-`use*` name) to make intent clear and silence the rule. Verify no real hooks are called inside it.

---

### [High] ESLint parse error in deployed file

**Severity:** High
**File:** `src/components/marketing/popups/FeaturesPopup.tsx:92:65`

ESLint emits `Parsing error: ',' expected` on the em-dash character `—` in a string literal. The file exports `FeaturesPopup` but is not imported anywhere (dead code). However, the parse error causes `pnpm lint` to exit with code 1, which will fail CI/CD lint gates on Vercel.

**Why it matters:** Broken lint exit code blocks deployment pipelines that enforce `lint` as a build step. Even as dead code, it must be fixed or deleted.

**Recommendation:** Delete the file (it's unused), or escape/replace the `—` with `&mdash;` / a regular hyphen if the component is ever wired up.

---

### [High] Zero API route tests — all authorization paths untested

**Severity:** High
**File:** `src/__tests__/` (all 13 test files)

Tests cover pure utility functions (`auth-tokens`, `sanitize`, `rate-limit`, `collab`, `social`, etc.) but **no test file exercises any `src/app/api/` route handler**. Auth flows (login, signup, Google OAuth, forgot/reset), permission checks (owner-vs-collaborator PATCH gating, 403 responses), and form submission dedup are fully untested at the HTTP layer.

**Why it matters:** Authorization bugs ship silently. A collaborator accidentally gaining owner-level write access, or a rate limiter bypass, would not be caught before production.

**Recommendation:** Add at minimum: (1) API route integration tests for `POST /api/auth/login` (valid/invalid creds), (2) `PATCH /api/displays/[id]` (collaborator gets 403 on owner-only fields), (3) `POST /api/forms/submit` (dedup logic). Use `vitest` + `msw` or Next.js `createMocks`.

---

### [Medium] `any` type scattered across API and analytics code — 44 occurrences

**Severity:** Medium
**Files (top offenders):**
- `src/app/api/analytics/[displayId]/elements/route.ts` — 7 (`responses: any[]` in every aggregate function)
- `src/app/api/generate/route.ts` — 6 (`as any` on Prisma JSON fields, `err: any`)
- `src/lib/ai/validate.ts` — 8

**Why it matters:** With `strict: true` in tsconfig, these are intentional escapes. In analytics aggregation functions, untyped `responses` arrays mean shape errors (e.g., wrong field name) pass silently to clients.

**Recommendation:** Define typed interfaces for Prisma JSON response payloads (`FormResponse`, `CommentRecord`, etc.). Replace `err: any` with `err: unknown` + type narrowing. The `as any` casts on Prisma JSON fields are acceptable workarounds but should be aliased to a named type (`type JsonValue = ...`).

---

### [Medium] Giant components with no separation of concerns

**Severity:** Medium
**Files:**
- `src/components/canvas/ColumnCanvas.tsx` — **1 451 lines** (renders every element type via switch)
- `src/components/editor/PageEditor.tsx` — **1 277 lines** (all editor state + handlers)
- `src/lib/types/canvas.ts` — **1 030 lines** (types + factory functions + defaults)
- `src/lib/kits/generate.ts` — **959 lines** (AI generation for all kit types)

**Why it matters:** Files this large are hard to review, diff, and test in isolation. A bug in `ColumnCanvas.tsx`'s switch risks regressing unrelated element types.

**Recommendation:** Split `ColumnCanvas` into element-group renderers (e.g., `renderFormElement`, `renderKitElement`) imported from sub-files. Extract `PageEditor` state into a custom hook. Split `canvas.ts` into `types/` + `factories/`.

---

### [Medium] 1 circular dependency: `lib/fonts.ts ↔ lib/google-fonts-data.ts`

**Severity:** Medium
**Evidence:** `npx madge --circular src` reports exactly one cycle.

**Why it matters:** Circular imports cause unpredictable module initialization order — one module may see `undefined` exports depending on bundler evaluation order. Can manifest as subtle runtime errors (especially SSR vs. client hydration mismatches).

**Recommendation:** Move the shared data (font list) into a third file (`lib/font-list.ts`) that neither imports from the other, breaking the cycle.

---

### [Low] `<img>` elements instead of Next.js `<Image>` — 8 locations

**Severity:** Low
**Files:** `SlideshowElement.tsx`, `CatalogHeader.tsx` (×2), `ProfileHeader.tsx` (×2), `ResumeHeader.tsx` (×2), `ImageUploadField.tsx`, `render-elements.tsx`

**Why it matters:** Unoptimized images hurt LCP (Core Web Vitals) on public profile pages, the main user-facing surface.

**Recommendation:** Replace with `next/image` where image dimensions can be known or constrained. Use `fill` layout for variable-size containers.

---

### [Low] `console.log` in application code

**Severity:** Low
**File:** `src/lib/email.ts:9` — intentional dev-mode log (guarded by absence of `RESEND_API_KEY`)
**Also:** 3 occurrences in template strings for code-block elements (literal `console.log(...)` as example code — harmless).

**Why it matters:** The `email.ts` log is intentional and correctly dev-only. No action needed beyond confirming it does not fire in production (it is inside an `else` branch that only runs without `RESEND_API_KEY`).

**Recommendation:** Low priority. Optionally prefix with `[dev]` guard or move to `console.debug`.

---

## tsconfig Strictness

`tsconfig.json` has `"strict": true` which enables `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, etc. This is correct. No weakening flags (`skipLibCheck: true` is present but appropriate for library declaration files only).

---

## Test Coverage Assessment

| Area | Covered | Gap |
|------|---------|-----|
| Auth token generation/expiry | Yes (`auth-tokens.test.ts`) | No HTTP-level login/signup/reset tests |
| Canvas element factory | Yes (`canvas-types.test.ts`) | No render/interaction tests |
| Collaboration access control | Yes (`collab.test.ts`) — pure logic | No API handler tests (403 enforcement) |
| Social graph helpers | Yes (`social.test.ts`) | No API route tests |
| Rate limiter | Yes (`rate-limit.test.ts`) | Not tested under concurrent load |
| Sanitizer | Yes (`sanitize.test.ts`) | No XSS corpus tests |
| API routes (all ~40 routes) | **None** | Entire HTTP surface untested |
| Form submission + dedup | **None** | localStorage dedup logic untested |
| Public page rendering | **None** | No SSR/hydration tests |
| E2E / browser tests | **None** | No Playwright/Cypress |

**Biggest untested risk:** The collaborator permission boundary — `splitUpdate` and `canEdit` are unit-tested in isolation, but the actual PATCH route enforcing the 403 is not tested. A refactor could silently remove the guard.

---

## Launch Blockers

| # | Severity | Issue |
|---|----------|-------|
| 1 | **Critical** | `useStarter` Hook-in-callback violation in `LibraryClient.tsx` — potential runtime crash |
| 2 | **High** | ESLint parse error in `FeaturesPopup.tsx` — breaks lint CI gate (exit code 1) |
| 3 | **High** | Zero API route tests — authorization bugs ship undetected |

Items 1 and 2 are one-line fixes. Item 3 is a process/risk acceptance decision; at minimum add a smoke test for the collaborator 403 boundary before launch.
