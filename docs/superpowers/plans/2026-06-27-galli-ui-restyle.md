# Galli UI Restyle Implementation Plan (Sub-project 2)

> Executed inline with visual verification. Each task ends with `pnpm build` clean + a screenshot checked against the mockup (`Images/`-style reference). Steps use `- [ ]`.

**Goal:** Restyle the dashboard to match the provided light-theme mockup — left sidebar, center feed, right analytics panel — on a reusable light design-token system, then propagate to the rest of the app.

**Architecture:** A new shared `(dashboard)/layout.tsx` renders the persistent sidebar; the dashboard page provides the center column + right analytics panel. A light-theme token layer in `globals.css` + Tailwind semantic aliases drives the whole app. Green stays primary.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind, lucide-react, Plus Jakarta Sans (next/font).

## Global Constraints

- **Light theme only.** No dark mode. Brand name **Galli** (wordmark component already exists at `src/components/brand/Wordmark.tsx`).
- **Palette:** primary green `#39D98A` (token `galli` / `bg-primary`), accents aqua `#1FB6FF`, violet `#6C63FF`. Positive deltas in green. Surfaces white on a soft neutral page bg.
- **Layout from mockup:** sidebar (left) + center + right analytics panel. **No bottom dock.**
- **Cards:** `rounded-2xl`, subtle border (`border-gray-200/70`), soft shadow.
- **Typography:** Plus Jakarta Sans.
- **Accessibility:** cursor-pointer on clickables, visible focus rings, 4.5:1 text contrast, `prefers-reduced-motion` respected, icon-only buttons get `aria-label`.
- Run commands with DB URL inline: `$env:DATABASE_URL='postgresql://pages:pages@localhost:5434/pages?schema=public'; <cmd>`.
- The "Public feed" data source for now is `/api/explore` (published public displays). It rewires to the follow-feed in sub-project 4.

---

### Task A: Light theme tokens + Plus Jakarta Sans

**Files:** `src/app/globals.css`, `tailwind.config.ts`, `src/app/layout.tsx`

- Refine light `:root` tokens: `--background` soft neutral (~`220 20% 97%`), `--foreground` slate-900 (`222 47% 11%`), `--muted`/`--muted-foreground` (slate-100 / slate-600), `--border` (`220 13% 91%`), keep `--primary` green. Add `--surface` (white), `--sidebar` (white/`#FBFCFD`), `--ring` (green).
- Tailwind: add semantic colors `surface`, `sidebar` mapped to the vars; add `boxShadow.soft = 0 1px 2px rgba(16,24,40,.04), 0 4px 16px rgba(16,24,40,.06)`.
- `layout.tsx`: replace `Inter` with `Plus_Jakarta_Sans` (next/font/google, weights 300–700), set as body font.
- **Verify:** build clean; dashboard still renders (will look transitional until B/C/D).

### Task B: App shell sidebar layout

**Files:** Create `src/app/(dashboard)/layout.tsx`, `src/components/dashboard/Sidebar.tsx`; modify `src/app/(dashboard)/dashboard/page.tsx` (remove its own top `<nav>`/hero, content moves into center column in Task C).

- `Sidebar.tsx` (client): `<Wordmark/>` + collapse chevron; green pill **Create New** button (`/editor`); nav list with `lucide` icons + active state via `usePathname()`:
  - Home → `/dashboard`, My Pages → `/dashboard?view=mine`, Discover → `/explore` (wired); Shared with me / Templates / Integrations → render with a "Soon" pill, non-navigating.
  - Bottom: "Your universe is wide open" usage card (`{count}/20 pages` progress bar) + user menu (avatar, name, role chip, dropdown: Analytics, Explore, Log out — reuse existing logout from store).
- `(dashboard)/layout.tsx`: flex row — `<Sidebar/>` (fixed ~256px) + `<main className="flex-1 min-w-0">{children}</main>` on `bg-background`.
- **Verify:** sidebar appears on `/dashboard`, `/analytics`, `/responses`; active item highlights; logout works; build clean; screenshot vs mockup sidebar.

### Task C: Dashboard center column

**Files:** `src/app/(dashboard)/dashboard/page.tsx`, Create `src/components/dashboard/FeedRow.tsx`, `src/components/dashboard/PageCard.tsx`.

- Header: "Welcome back, {name} 👋" (text, no emoji-as-icon — use a waving-hand inline SVG or omit), subtitle, a **Search anything** input (non-functional placeholder ok for now) + notification bell (`aria-label`).
- **Public feed** `FeedRow`: horizontal scroll (`overflow-x-auto snap-x`) of cards from `GET /api/explore` (cover image, title, "by {author}", menu dots). Left/right chevron paging buttons. Empty/loading skeletons.
- **My pages** row: horizontal scroll of `PageCard` (cover or gradient, title, visibility globe + label, `...` menu with pin/cover/delete reused from current logic) + a dashed **Create new page** tile.
- Drop the DnD grid in favor of the horizontal rows shown in the mockup (keep pin/delete/cover handlers).
- **Verify:** matches mockup center column; horizontal scroll works; create/delete/cover still work; build clean; screenshot.

### Task D: Right analytics panel

**Files:** Create `src/components/dashboard/AnalyticsPanel.tsx`, `src/components/dashboard/StatTile.tsx`; modify dashboard page to render it as the right column.

- Selected page = first pinned/most-recent display (clicking a `PageCard` updates selection). Panel shows: cover thumb, title, "Public page" + page URL with external-link, then:
  - **Audience at a glance:** 3 `StatTile`s (Views / Visitors / Engagement) with value, green delta, and a tiny inline SVG sparkline. Data from `GET /api/analytics/[displayId]` (verify shape during impl; fall back to display.views + empty states).
  - **Widget feedback:** top responses from form/analytics-elements (reuse `/api/analytics/[displayId]/elements`); each as a labeled bar or rating. Empty state if none.
  - **View full analytics** CTA → `/analytics`.
- Layout: dashboard becomes 3-col on `xl` (sidebar handled by layout): center `flex-1` + right panel `w-[360px]` sticky; collapses below `xl` (panel moves below or hides).
- **Verify:** real numbers for a page with data; clean empty states for a fresh page; build clean; screenshot vs mockup right panel.

### Task E: Propagate light theme (follow-on)

**Files:** auth pages, editor chrome, public display/share pages.

- Apply tokens/typography + card styling for visual consistency. Scope/iterate after A–D land and you've reviewed the dashboard. Detailed steps authored once A–D are approved.

---

## Notes / Risks
- The `(dashboard)/layout.tsx` wraps analytics/responses/new-kit/card-studio too; those pages keep their content but gain the sidebar — check none double-render a nav. Remove redundant top-nav from dashboard page (Task C).
- Analytics API response shapes are verified during Task D before wiring (no assumed fields).
- Horizontal scroll rows must not cause page-level horizontal overflow (`min-w-0` on flex children).
