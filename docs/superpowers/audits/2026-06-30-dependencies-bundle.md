# Dependency & Bundle Audit — 2026-06-30

**Project:** Galli (pages-mvp) — pre-launch at mygalli.com  
**Tools run:** `pnpm audit`, `pnpm outdated`, `npx depcheck@1.4.7`, manual grep  
**Total `pnpm audit` advisories:** 63 (1 critical · 27 high · 27 moderate · 8 low)

---

## Summary

The most urgent issue is `next` at v14 — it has a known High-severity DoS CVE and is two major versions behind (latest 16.x). `vitest` carries a Critical file-read/execute CVE that is trivially patched by bumping to 4.1.x. Several other High advisories are in devDependency transitive chains (`eslint`→`minimatch`, `eslint-config-next`→`glob`) and carry no production runtime risk, but should still be resolved. `@prisma/client` is 2 major versions behind (5.x vs 7.x). The `@anthropic-ai/sdk` production dependency is only used in one API route (`/api/generate`) and is 27 minor versions behind; it should at minimum be updated. Bundle health is good: no `import * as` wildcard imports were found; lucide-react is imported with named destructuring throughout; no dynamic imports exist (opportunity for improvement in the large 1,277-line `PageEditor.tsx`).

---

## Findings

### F-01 — Critical: vitest RCE via UI server
**Severity:** Critical  
**Package:** `vitest` 4.0.18 → fix: 4.1.0+  
**Evidence:** `pnpm audit` — GHSA-5xrq-8626-4rwp: "When Vitest UI server is listening, arbitrary file can be read and executed."  
**Why it matters:** Vitest is a devDependency only, so it cannot be exploited at runtime in production. However it CAN be exploited in CI environments or developer machines running `vitest --ui`. The fix is a single semver-compatible bump.  
**Recommendation:** `pnpm update vitest` (bumps to 4.1.9, within `^4.0.18` range — check lockfile). Update `package.json` lower bound to `^4.1.0`.

---

### F-02 — High: next.js DoS via insecure RSC deserialization
**Severity:** High  
**Package:** `next` 14.2.35; patched in ≥15.0.8; latest: 16.2.9  
**Evidence:** `pnpm audit` — GHSA-h25m-26qc-wcjf: "HTTP request deserialization can lead to DoS when using insecure React Server Components."  
**Why it matters:** This is a production runtime CVE affecting RSC-enabled deployments. The fix requires upgrading to Next 15 (breaking) or 16 (breaking). This IS a launch blocker because Galli uses RSC (App Router).  
**Recommendation:** Plan upgrade to Next 15 before launch. Review Next 14→15 migration guide (async params/cookies, React 19 peer). React 18 is required peer for Next 15 — no peer upgrade needed immediately. This is the single highest-effort fix.

---

### F-03 — High: Prisma 2 major versions behind (5.x vs 7.x)
**Severity:** High  
**Package:** `@prisma/client` 5.22.0 / `prisma` 5.22.0; latest: 7.8.0  
**Evidence:** `pnpm outdated`  
**Why it matters:** Prisma 6 introduced breaking changes to relation filters and typed SQL. Prisma 7 brought further breaking changes. Running 2 majors behind means accumulating breaking change debt and missing security hardening. No specific CVE flagged by audit, but the version gap is a launch-quality risk.  
**Recommendation:** Upgrade to Prisma 6 before launch (then 7 post-launch). Consult Prisma migration guides for 5→6. The custom migration workflow (documented in project memory) must be re-validated after upgrade.

---

### F-04 — High: minimatch ReDoS (transitive via eslint + eslint-config-next)
**Severity:** High (devDependency only — no production runtime exposure)  
**Package:** `minimatch` <3.1.3 (via `eslint`) and `minimatch` <9.0.7 (via `eslint-config-next→glob`)  
**Evidence:** `pnpm audit` — GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj  
**Why it matters:** ReDoS in dev tooling only. Not exploitable in production. Resolved by upgrading ESLint to v10 and `eslint-config-next` to match Next 15/16. Chained with F-02.  
**Recommendation:** Upgrade `eslint` to ^10 and `eslint-config-next` to match the new Next version as part of the Next upgrade (F-02).

---

### F-05 — High: glob CLI command injection (transitive, dev only)
**Severity:** High (devDependency only)  
**Package:** `glob` >=10.2.0 <10.5.0 (via `eslint-config-next→@next/eslint-plugin-next`)  
**Evidence:** `pnpm audit` — GHSA-5j98-mcp5-4vw2  
**Why it matters:** Command injection via `glob` CLI `-c/--cmd` flag. Only exploitable if glob CLI is invoked directly with untrusted input — not via normal eslint usage. Resolved alongside F-04 as part of Next/ESLint upgrade.  
**Recommendation:** Resolved by upgrading `eslint-config-next` (see F-04).

---

### F-06 — Medium: @anthropic-ai/sdk is a production dep used in one route only
**Severity:** Medium  
**Package:** `@anthropic-ai/sdk` 0.80.0; latest: 0.107.0 (27 minor versions behind)  
**Evidence:** `pnpm outdated` + grep — used only in `src/app/api/generate/route.ts`  
**Why it matters:** This is a production dependency adding non-trivial bundle weight for a single optional API route. At 27 minor versions behind there may be breaking API changes and bug fixes missed. If the `/api/generate` feature is not yet user-facing, consider moving it to a separate edge function or removing it from the main bundle.  
**Recommendation:** `pnpm update @anthropic-ai/sdk`. If `/api/generate` is internal/optional at launch, consider gating it behind a feature flag.

---

### F-07 — Medium: lucide-react 171 files, 0.400.0 vs 1.22.0
**Severity:** Medium  
**Package:** `lucide-react` 0.400.0; latest: 1.22.0  
**Evidence:** `pnpm outdated` + grep (171 files importing named icons)  
**Why it matters:** Major version gap (0.x → 1.x). Some icon names were renamed between versions. Named imports are used correctly throughout (no wildcard `import * as`), so tree-shaking works. However the old version may include removed or renamed icons that break on upgrade.  
**Recommendation:** Upgrade to 1.x, audit any renamed icons (`Image`, `Share2`, etc. — check lucide changelog). No bundle risk as-is (named imports only).

---

### F-08 — Medium: No dynamic imports / code-splitting for heavy components
**Severity:** Medium  
**Package:** n/a  
**Evidence:** Grep for `next/dynamic` and `React.lazy` returned 0 results. `PageEditor.tsx` is 1,277 lines and is `'use client'`. `ColumnCanvas.tsx` (element renderer) and `SlashCommandMenu.tsx` are also large `'use client'` components.  
**Why it matters:** The entire editor, canvas, and all ~150+ element components are shipped in a single client bundle. Public page visitors who never visit the editor still download editor code if Next's route segmentation doesn't isolate it. Dynamic imports for heavy element editors (`ChartElement`, `CodeElement`, `PlaylistElement`, etc.) would reduce initial load.  
**Recommendation:** After Next upgrade: wrap `PageEditor` with `next/dynamic({ ssr: false })` in the editor route. Consider lazy-loading heavy individual element editors. This is a P2 performance improvement, not a launch blocker.

---

### F-09 — Medium: zustand 4.x, tailwindcss 3.x, typescript 5.x — all one major behind
**Severity:** Medium  
**Packages:** `zustand` 4.5.7 (latest 5.0.14), `tailwindcss` 3.4.19 (latest 4.3.2), `typescript` 5.9.3 (latest 6.0.3)  
**Evidence:** `pnpm outdated`  
**Why it matters:** No CVEs, but all three have breaking changes in the next major. Tailwind 4 is a particularly large rewrite (drops `tailwind.config.js` for CSS-based config). Accumulating major-version debt before launch makes post-launch upgrades harder.  
**Recommendation:** Defer to post-launch unless there are known bugs. Tailwind 4 migration would be the highest effort.

---

### F-10 — Low: depcheck — 4 unused devDependencies
**Severity:** Low  
**Packages:** `@testing-library/react`, `@types/react-dom`, `autoprefixer`, `postcss`  
**Evidence:** `npx depcheck` output  
**Why it matters:** `@testing-library/react` appears installed but no test files import it (tests use vitest directly). `autoprefixer`/`postcss` are used by Tailwind's build pipeline — depcheck false-positives here. `@types/react-dom` is needed by TypeScript for JSX. These are low-risk false positives from depcheck's static analysis.  
**Recommendation:** Verify `@testing-library/react` — if no `render()`/`screen` usage exists in tests, remove it. Leave `autoprefixer`, `postcss`, `@types/react-dom` in place.

---

### F-11 — Low: undici Set-Cookie SameSite downgrade (transitive, @vercel/blob)
**Severity:** Low  
**Package:** `undici` <6.27.0 via `@vercel/blob`  
**Evidence:** `pnpm audit` — GHSA-g8m3-5g58-fq7m  
**Why it matters:** Cookie SameSite attribute can be silently downgraded when using undici as HTTP client. Affects file upload flows. Resolved by updating `@vercel/blob` to 2.5.0.  
**Recommendation:** `pnpm update @vercel/blob` (within `^2.3.0` range → 2.5.0 available).

---

## Launch Blockers

| # | Severity | Package | Action |
|---|----------|---------|--------|
| F-02 | **High** | `next` 14 → CVE DoS in RSC | Upgrade to Next 15 before go-live |
| F-01 | **Critical** | `vitest` 4.0.18 → RCE via UI | `pnpm update vitest` (trivial patch) |

F-01 is a 1-line lockfile fix. F-02 requires a planned Next 15 migration and is the true gating item for launch.

All other findings are post-launch improvements or dev-only advisories with no production exposure.
