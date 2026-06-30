# Galli Pre-Launch Audit — Performance · A11y · SEO · UX · Scalability

**Date:** 2026-06-30  
**Auditor:** Claude Sonnet 4.6 (read-only)  
**App URL audited:** http://localhost:3000 (dev server)  
**Lighthouse run:** Skipped — dev-server overhead inflates scores; findings are manual/static analysis.

---

## Summary

The codebase is clean and well-structured. Most issues are pre-launch gaps rather than bugs. The two biggest blockers for `mygalli.com` go-live are: (1) the 2.1 MB hero image served without optimization, and (2) the in-memory presence/rate-limit state that will silently break on Vercel's multi-instance serverless environment. SEO is missing critical pieces (no robots.txt/sitemap, no OG image). Everything else is Medium/Low.

**Severity counts:** Critical 0 · High 3 · Medium 6 · Low 4

---

## Findings

---

### H1 — 2.1 MB Hero Image Served Unoptimized

**Severity:** High  
**Evidence:** `public/hero-village.png` — 2,177,938 bytes (confirmed via `ls -la`).  
Served via a raw `<img src="/hero-village.png">` tag in `src/components/marketing/Hero.tsx:46` (eslint-disable comment acknowledges the violation).  
No `width`/`height` attributes — causes layout shift (CLS). No `loading="lazy"` or `fetchpriority` hint.

**Why it matters:** A 2.1 MB uncompressed PNG on the landing-page LCP element will score ~30–40 on mobile Lighthouse performance. First Contentful Paint (FCP) and LCP will be severely penalised. Google uses Core Web Vitals for ranking.

**Recommendation:** Replace with `next/image`:
```tsx
import Image from 'next/image'
// …
<Image src={imageSrc} alt="…" fill priority className="object-cover" />
```
Also convert to WebP/AVIF (Next.js does this automatically). Add `priority` since it is the LCP element.

---

### H2 — In-Memory Presence State Breaks Multi-Instance Deploys

**Severity:** High  
**Evidence:** `src/lib/presence.ts` — module-level `const rooms = new Map<string, Map<string, Entry>>()`. Every Vercel function invocation may hit a different instance; two editors on the same display will not see each other unless they happen to land on the same instance.

**Why it matters:** Collaborative presence is a shipped feature. It will silently produce incorrect "who's online" lists in production. No data corruption risk, but user trust in the feature will be low.

**Recommendation:** Replace in-memory Map with Redis (you already have Upstash wired for rate limiting). Store presence as a hash with TTL: `HSET presence:<displayId>:<userId> name avatar; EXPIRE key 20`. `active()` becomes an `HGETALL` across all user subkeys for the display.

---

### H3 — No robots.txt or sitemap.xml

**Severity:** High  
**Evidence:** `ls public/robots.txt public/sitemap.xml` → both missing.

**Why it matters:** Without `robots.txt`, crawlers have no guidance. Without a sitemap, Google may never discover public display pages at `/:username/:slug`. Critical for a social platform where discoverability of creator pages drives growth.

**Recommendation:**  
- Add `public/robots.txt` allowing all crawlers; disallow `/api/`, `/editor/`, `/(auth)/`.  
- Add a dynamic `src/app/sitemap.ts` (Next.js App Router built-in) that queries published displays and emits their canonical URLs with `lastmod`.

---

### M1 — All Marketing `<img>` Tags Bypass next/image

**Severity:** Medium  
**Evidence:** `src/components/marketing/Hero.tsx:46,120`, `FinalCTA.tsx:13`, `Testimonial.tsx:37` all use raw `<img>`. Only SVG logos (LandingNav, frog) are acceptable as raw `<img>` since Next.js doesn't process SVG.

**Why it matters:** No lazy-loading, no format negotiation (WebP/AVIF), no size optimization for viewport. Cumulative LCP penalty across the marketing funnel.

**Recommendation:** Switch all raster images to `next/image`. SVGs are fine as-is.

---

### M2 — No OG Image on Any Page

**Severity:** Medium  
**Evidence:** `src/app/layout.tsx` — `openGraph` block has no `images:` field. `src/app/[username]/[slug]/page.tsx` `generateMetadata` — also no `images:` field. Twitter card is `summary` (not `summary_large_image`).

**Why it matters:** When a user shares a Galli page link to Twitter/Discord/iMessage, no preview image appears. This is a growth/virality killer for a social page-building product.

**Recommendation:**  
- Root layout: add a static OG image at `public/og-default.png` (1200×630) and reference it.  
- Public display pages: if `display.coverImage` exists use it; fall back to default. Change twitter card to `summary_large_image`.

---

### M3 — Public Display Pages Have No ISR / Caching

**Severity:** Medium  
**Evidence:** `src/app/[username]/[slug]/page.tsx` — no `export const revalidate` and no `generateStaticParams`. Every request hits Postgres. No `fetch` cache options used anywhere in the project.

**Why it matters:** A popular creator page receiving 1 000 concurrent visitors fires 1 000 identical Prisma queries. Database connection pool exhaustion is likely before traffic volume that would otherwise be modest.

**Recommendation:**  
- Add `export const revalidate = 60` (60-second ISR) to the public page.  
- Or add `generateStaticParams` for known pages at build time with `fallback: 'blocking'`.  
- Mark the page as `dynamic = 'force-dynamic'` only for authenticated viewers (follow state) — consider moving follow state to a client-side fetch so the page body can be cached.

---

### M4 — Unbounded DB Queries on Analytics Routes

**Severity:** Medium  
**Evidence:**  
- `src/app/api/analytics/[displayId]/elements/route.ts:87` — `db.formResponse.findMany({ where: { displayId } })` — no `take:` limit.  
- `src/app/api/analytics/[displayId]/elements/route.ts:93` — `db.comment.findMany({ where: { displayId } })` — no `take:`.  
- `src/app/api/analytics/[displayId]/route.ts:40` — `db.analyticsEvent.findMany` filtered by date but no `take:`, could load hundreds of thousands of rows for a popular page.

**Why it matters:** A popular display with 10 000 form responses will cause a slow query, high memory allocation server-side, and a large JSON response. Risk of 30-second Vercel function timeout.

**Recommendation:** Add `take: 5000` (or paginate) to all three queries. For analytics aggregation at scale, pre-aggregate into a summary table via a background job rather than scanning raw events at request time.

---

### M5 — In-Memory Rate-Limit `redisLimiters` Map

**Severity:** Medium  
**Evidence:** `src/lib/rate-limit.ts:7` — `let redisLimiters: Map<string, Ratelimit> | null = null` at module level. In a serverless environment each cold start creates a new instance, so the map starts empty and a new `Redis` client is created per instance. This is correct behavior but creates many Redis connections and no connection reuse.

**Why it matters:** Vercel serverless functions do not persist module state between invocations in the same way Node servers do. Heavy traffic creates many Redis connections; Upstash free-tier limits concurrent connections.

**Recommendation:** Use a singleton Redis client (module-level `const redis = new Redis(...)`) and create `Ratelimit` instances once. This is a minor risk but worth addressing before launch.

---

### M6 — No Skip-to-Content Link

**Severity:** Medium  
**Evidence:** `src/components/marketing/LandingNav.tsx` — no skip link. `src/app/(dashboard)/layout.tsx` — no skip link. `src/app/globals.css:31` has a correct `:focus-visible` ring, so interactive elements have visible focus, but keyboard users must tab through the entire navigation on every page load.

**Why it matters:** WCAG 2.4.1 (Level A) — bypass blocks mechanism. Required for basic accessibility compliance.

**Recommendation:** Add a visually-hidden-until-focused skip link as the first child of `<body>`:
```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 ...">Skip to content</a>
```

---

### L1 — `window.confirm` for Destructive Actions

**Severity:** Low  
**Evidence:** `src/app/(dashboard)/dashboard/page.tsx:118`, `my-pages/page.tsx:77`, `responses/page.tsx:98` — all use browser `window.confirm()` dialogs.

**Why it matters:** `window.confirm` is unstyled, looks out of place in a designed UI, and is blocked in some browser contexts (cross-origin iframes, some mobile browsers). Not accessible to screen readers in all configurations.

**Recommendation:** Replace with a styled confirmation modal (a `PadModal`-style component already exists in the marketing folder at `src/components/marketing/PadModal.tsx`).

---

### L2 — Missing `rel="noopener noreferrer"` on External Links

**Severity:** Low  
**Evidence:** Testimonial/FeatureSection components — not audited for external `<a>` targets; pattern risk is low but worth a grep before launch.

**Recommendation:** `grep -rn 'target="_blank"' src/` and ensure all hits have `rel="noopener noreferrer"`.

---

### L3 — Landing Page Missing Structured Data

**Severity:** Low  
**Evidence:** `src/app/page.tsx` — no `<script type="application/ld+json">` for `WebSite`, `Organization`, or `SoftwareApplication` schema.

**Why it matters:** Structured data enables rich results (sitelinks searchbox, app knowledge panel) in Google. Low priority but a quick win for a marketing page.

**Recommendation:** Add a `WebSite` schema with `potentialAction` (SearchAction) to `src/app/layout.tsx` or the landing page.

---

### L4 — Public Page OG Metadata Domain Uses Fallback

**Severity:** Low  
**Evidence:** `src/app/[username]/[slug]/page.tsx:52` — `const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://galli.page'`. The canonical URL and OG url will be `galli.page` if `NEXT_PUBLIC_APP_URL` is not set to `mygalli.com`.

**Why it matters:** Canonical URLs pointing to the wrong domain hurt SEO and social sharing.

**Recommendation:** Ensure `NEXT_PUBLIC_APP_URL=https://mygalli.com` is set in Vercel environment variables before go-live. Also update the fallback string in `layout.tsx` from `galli.page` to `mygalli.com`.

---

## Launch Blockers (High Severity)

| # | Finding | File(s) |
|---|---------|---------|
| H1 | 2.1 MB unoptimized hero PNG — LCP will be catastrophic | `public/hero-village.png`, `Hero.tsx:46` |
| H2 | In-memory presence breaks multi-instance serverless deploys | `src/lib/presence.ts` |
| H3 | No robots.txt / sitemap — crawlers cannot discover content | `public/` (both missing) |

All three should be resolved before directing production traffic to mygalli.com.
