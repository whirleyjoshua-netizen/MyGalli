# Library Content Redesign — Design

**Date:** 2026-07-19
**Status:** Approved (design; mockup + user decisions)
**Base:** `main` @ `0a6dc8a` (PageHero Waves 1–3 live). Branch `feat/library-redesign` (worktree `.claude/worktrees/page-chrome`).
**Program:** first of three page content-redesigns toward user mockups (Library → Data → Explore), building on the `PageHero` design system.

## Goal
Redesign the Library page body (primarily the **Apps** tab) to match the mockup: a header with a functional **search** box, an Apps tab with a **Featured** section (large Vouch + KollabShare feature cards with spot illustrations), a static **"More coming soon!"** panel, and a **"Request an App"** developer-portal CTA shown as coming-soon. Templates/Kits tabs keep their grids (now search-filterable). Reuse the existing registry, Pro-gating, and `/api/card-library` add/remove flow.

### Decisions (confirmed with user)
- **Search only** in the header `controls` slot — functional, filters the active tab by name/description. **No Categories dropdown** (data is inconsistent across apps/templates/kits).
- **"Request an App"** → a **coming-soon placeholder** for a future developer portal. No backend, no mailto — a disabled/"coming soon" CTA. Do not spend effort here.
- **Illustrations** → net-new inline SVG spot art (no reusable illustration exists); moderate fidelity, brand/pond-themed.
- **Vouch = Pro**, chips (Trusted/Secure/Easy-to-use) = hardcoded in the new UI (registry has no per-app Pro/chip data).

## Architecture
Two files do the work; no schema/API changes.
- **`LibraryClient.tsx`** — lift a `query` search state; pass it into `PageHero`'s `controls` slot (a search `<input>`) and down to `LibraryAppsTab` + the Templates/Kits grids as a filter. Everything else (tabs, Pro-gating, `handleStarterClick`) unchanged.
- **`LibraryAppsTab.tsx`** — rewrite the body into: **Featured** (2 large feature cards) → any remaining listed apps in the existing small-card grid (currently none, kept for future) → **"More coming soon!"** panel → **"Request an App"** coming-soon CTA. Reuse `add()`/`remove()`/`use()` + registry data + `ProBadge`/`UpgradePrompt`.
- **New:** `src/components/library/AppIllustration.tsx` — small inline-SVG spot illustrations keyed by app (`vouch` → a credibility card w/ stars; `kollabshare` → overlapping avatars + share glyph), pond-tinted, decorative (`aria-hidden`).

### Components (new / changed)
- **New:** `src/components/library/AppIllustration.tsx` (+ optional test).
- **Changed:** `src/components/library/LibraryClient.tsx` (search state + `controls` + pass `query` down), `src/components/library/LibraryAppsTab.tsx` (Featured layout + coming-soon panels + `query` filter).
- **Unchanged:** registry (`src/lib/cards/registry.ts`), `ProBadge`, `UpgradePrompt`, `PageHero`, `/api/card-library`.

## Requirements

### R1 — Header search (functional)
- `LibraryClient` holds `query` state. Rendered as a search `<input>` (magnifier icon, `Search library…` placeholder) in `PageHero`'s `controls` slot.
- Filters the ACTIVE tab: Apps → filter listed apps by `name`/`description`; Templates/Kits → filter `TEMPLATE_STARTERS`/`KIT_STARTERS` by `name`/`description`. Case-insensitive substring. Empty query → show all.
- When a filtered tab has no matches → a small "No matches for '…'" empty line.

### R2 — Apps tab: Featured section
- Section heading **"Featured"** + subtext ("Curated tools and integrations to enhance your workspace.").
- **Two large cards** (2-col on lg, stacked on mobile), each: left column = icon + name + (Pro badge for Vouch) + description + feature chips + primary action; right column = `AppIllustration`.
  - **Vouch:** `ProBadge`, chips **Trusted / Secure / Easy-to-use** (hardcoded, check-style), primary = the existing add/added/use flow ("Add to Library" → "In Library" + "Use on a page"). Pro-gated via existing `add()` logic.
  - **KollabShare:** `status: 'coming-soon'` → a **"Coming soon"** pill instead of a button.
- Data comes from the registry (`listedApps()`); the two featured ids are `vouch` + `kollabshare`. Any additional listed apps (none today) render below in the existing small-card grid.

### R3 — "More coming soon!" panel
- A soft-surface panel: title "More coming soon!" + copy, and 4 mini-features with small icons — **Powerful Tools** / **Seamless Integrations** / **Built for Creators** / **Always Growing** (static copy + lucide icons: `Puzzle`/`Link2`/`Users`/`Sprout` or similar).

### R4 — "Request an App" CTA (coming-soon)
- A single row/card: "Can't find what you're looking for?" + copy referencing a **developer portal**, with a **disabled/"Coming soon"** button (no onClick, no endpoint). Visually matches the mockup's row; functionally inert.

### R5 — Illustrations
- `AppIllustration` renders inline SVG per `variant`. Decorative (`aria-hidden`, no alt). Self-contained (no external assets), theme-safe (semantic/brand tokens or currentColor). Keep each < ~1KB of markup.

## Verification
- **Unit:** `LibraryAppsTab` renders the two featured cards (Vouch w/ Pro badge + chips, KollabShare w/ Coming-soon pill), the "More coming soon" panel, and the coming-soon Request-an-App button (assert disabled / no handler). Search filter: querying a non-matching string hides cards. `AppIllustration` renders an `<svg aria-hidden>` for each variant. (Vitest + Testing Library; mock `/api/card-library` fetch as existing tests do.)
- **Static:** `tsc --noEmit`; authoritative `eslint` (root:true worktree workaround) 0 errors; existing library tests green.
- **Visual:** browser check the Apps tab vs the mockup (featured cards, illustrations, panels), search filtering, and mobile stacking.

## Non-goals (later)
- Real Request-an-App backend / developer portal (coming-soon only now).
- Categories filtering; per-app Pro/category/chip data in the registry (chips hardcoded now).
- Redesigning the Templates/Kits tab card layout (only add search filtering).
- High-fidelity/production illustration art (moderate inline SVG now).
- Data + Explore redesigns (separate specs, next).
