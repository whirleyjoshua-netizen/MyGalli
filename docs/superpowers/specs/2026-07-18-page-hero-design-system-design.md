# Page Chrome Design System — `PageHero` — Design

**Date:** 2026-07-18
**Status:** Approved (design)
**Base:** `main` @ `1388f8c` (M3a Events + My Pond revamp both live in prod). Branch `feat/page-chrome` (isolated worktree `.claude/worktrees/page-chrome`).

## Context & goal

The dashboard's pages have drifted into **four different header treatments**:

1. **Full-width band below title** — Workspaces (`WorkspacesListClient.tsx`): title row, then a full-width `/workspaces-pond-banner.png` strip, then content.
2. **Compact icon + middle sign** — My Pond (`pond/PondHero.tsx`, merged): `gallio-frog.svg` icon + title, a 300px `/pond/hero-sign.png` floated in the middle, then view-toggle + button.
3. **Big title, no banner** — Gallery (`/my-pages`): `text-3xl` title + subtitle + pill button + tabs, no icon, no banner.
4. **Plain / older** — Home, Data, Library, Settings, Bulletin, Responses, Explore: each hand-rolls a smaller, distinct header.

The user's mockups (ChatGPT-generated targets) show **one** canonical look: an **icon + title + subtitle on the left**, an optional **primary action top-right**, and a **pond banner bleeding into the top-right of the header** behind the action (fading to the page background on the left so text stays readable), with **tabs directly under** the header. The goal is to make that one look real as a **shared, reusable component** and roll every dashboard page onto it, killing the divergence permanently.

### Decisions (confirmed with user)
- **Canonical layout = top-right bleed** (mockup style), not the two already-shipped variants.
- **One banner asset for all pages** — a single wide pond image; no per-page art.
- **Fold in My Pond** — the already-merged My Pond revamp converges onto the shared component (reusing its cards/toolbar); its bespoke `PondHero` is retired.
- **Full scope** — every dashboard page, including the structurally-different Home (feed) and Explore (sticky search + chips), which get careful adaptation rather than a drop-in.

## Architecture

One new component, `PageHero`, is the single source of truth for page chrome. Each page replaces its hand-rolled header markup with a `<PageHero>` element plus its existing content below. The banner lives **inside** `PageHero` (one asset, referenced once), so a future art swap is a single file change with no code edits. The component is presentational and stateless — pages pass their own icon, strings, action button, optional right-hand controls, and optional tabs as props/slots.

### Component: `PageHero`

`src/components/dashboard/PageHero.tsx` (client component — pages that pass interactive buttons are already client components; the hero itself needs no hooks).

```tsx
type PageHeroProps = {
  icon: React.ReactNode          // per-page lucide icon (or <img> mark), ~w-7 h-7
  title: string
  subtitle?: string
  action?: React.ReactNode       // optional primary button, rendered top-right above the banner
  controls?: React.ReactNode      // optional secondary controls left of the action (view toggle, etc.)
  tabs?: React.ReactNode          // optional slot rendered under the header row, above content
  bannerAlt?: string             // decorative by default (''); override only if meaningful
}
```

**Layout & responsiveness:**
- Outer: `relative overflow-hidden` header block, `px-6 lg:px-8 py-7`, `rounded-b-* / border-b` consistent with current pages.
- Banner: a single `<Image src="/page-banner.png" fill priority className="object-cover object-right" />` positioned absolute, **right-anchored**, occupying roughly the right 40–55% of the header, `hidden md:block` (mobile hides it entirely — same trick the merged `PondHero` uses). A left→right gradient overlay (`bg-gradient-to-r from-background via-background/90 to-transparent`) sits above the image so the title/subtitle read cleanly and the action button stays legible. `aria-hidden` / `alt=""` — decorative.
- Foreground row: `relative z-10 flex items-start justify-between gap-6`. Left = `<h1>` (`flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight`) with `icon` + `title`, then `subtitle` (`text-muted-foreground mt-1`). Right = `controls` + `action` (`shrink-0`, wrapped so it floats above the banner).
- `tabs` slot: rendered after the row, `relative z-10`, matching the existing `border-b border-border` tab style used by Gallery/My Pond so no page reinvents tabs.
- Theme-aware: uses semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`) already defined in `globals.css`; no hard-coded colors.

### The one banner asset

`public/page-banner.png` — a single wide pond image (~1600×420, subject offset right so the left half is calm water/sky that fades under the gradient). **Placeholder to start:** reuse the existing clean pond-landscape art so no page is blocked; the final art is a one-file swap. (Existing `workspaces-pond-banner.png` / `pond/*` assets are left in place during migration and removed once no page references them.)

## Rollout — waves (each wave = one shippable deploy)

Ordered so each wave stands alone, is independently testable, and de-risks the next. Every wave: build/change → tsc + lint + scoped tests → merge to main → push → verify deploy.

### Wave 1 — Pilot: `PageHero` + Gallery + My Pond
- Build `PageHero` + add `public/page-banner.png`.
- **Gallery** (`/my-pages`): replace the hand-rolled header (`page.tsx:146-167`) with `<PageHero icon={<ImageIcon/>} title="Gallery" subtitle="Your pages and boards — live and in progress." action={<NewPage/>} tabs={<PagesBoardsTabs/>} />`. Content grids unchanged.
- **My Pond** (`/shared`): replace `PondHero` with `PageHero`, moving the view-toggle into `controls` and "New community" into `action`; keep `PondToolbar`, `CommunityCard`, `CollabCard`, `GetMoreCard`, `NewCommunityModal` as-is. Delete `pond/PondHero.tsx` (+ its usage). `PondWelcomeBanner` retired if now redundant (confirm at implementation).
- **Verify:** `PageHero` renders on both; tabs work; mobile hides banner; no visual regression in the card grids.

### Wave 2 — Converge Workspaces
- **Workspaces** (`/workspaces`, `WorkspacesListClient.tsx`): remove the full-width-below banner block (`:60-65`) and the plain title row; render `<PageHero icon={<LayoutGrid/>} title="Workspaces" subtitle="Your data, organized." action={<NewWorkspace/>} controls={<GridListToggle/>} />`. Keeps search/sort/pager below.
- Now all three previously-styled pages share one header. Retire `workspaces-pond-banner.png` if unreferenced.

### Wave 3 — Plain pages (batchable into 1–2 deploys)
Mechanical header swaps, each: drop `<PageHero>` in, move any existing action into `action`, existing tabs into `tabs`.
- **Library** (`LibraryClient.tsx`) — icon `Library`, existing Apps/Templates/Kits tabs → `tabs`.
- **Data** (`/data`) — icon `BarChart3`, existing page-selector → `controls`, tab row → `tabs`.
- **Settings** (`/settings`) — icon `Settings`, no tabs; keep the `max-w-xl` body under a full-width hero.
- **Bulletin** (`/bulletin`) — icon `Megaphone`.
- **Responses** (`/responses`) — icon `FileText`.

### Wave 4 — Special: Home + Explore
Real adaptation, not a drop-in; each gets its own care so existing behavior survives.
- **Home** (`/dashboard`): `<PageHero icon={<Home/>} title="Your Personal Gallery" controls={<SearchBox/>} action={<NotificationBell/>} />` above the existing `ScrollRow` feed + `AnalyticsPanel`. Search + bell move into the hero's right slot; feed unchanged.
- **Explore** (`/explore`, `ExploreClient.tsx`): the sticky frosted `GalliTopBar` (search + category chips) is load-bearing. Option A: render `PageHero` above it (hero scrolls away, top-bar stays sticky). Option B: feed the category chips into the hero's `tabs` slot and keep search in `controls`. Chosen at implementation after a quick behavior check; **must not break** the sticky scroll or search. The faint `gallio-frog.svg` watermark is left as-is.

## Components (new / changed)
- **New:** `src/components/dashboard/PageHero.tsx` (+ test); `public/page-banner.png`.
- **Changed (by wave):** W1 — `app/(dashboard)/my-pages/page.tsx`, `app/(dashboard)/shared/page.tsx`, delete `components/pond/PondHero.tsx`. W2 — `components/workspaces/WorkspacesListClient.tsx`. W3 — `LibraryClient.tsx`, `app/(dashboard)/data/page.tsx`, `app/(dashboard)/settings/page.tsx`, `app/(dashboard)/bulletin/page.tsx`, `app/(dashboard)/responses/page.tsx`. W4 — `app/(dashboard)/dashboard/page.tsx`, `components/explore/ExploreClient.tsx`.
- **No schema, no API, no new dependency.** Pure presentational refactor.

## Verification
- **Unit:** `PageHero` renders title/subtitle/icon; renders `action`/`controls`/`tabs` slots when passed and omits them when not; banner img present with empty `alt`. (Vitest + Testing Library, matching existing component tests like `PondToolbar.test.tsx`.)
- **Per-page:** each migrated page still renders its content + interactions (tabs switch, buttons fire) — existing page tests stay green; add a smoke assertion that `PageHero` is present.
- **Static:** `tsc --noEmit`, `pnpm exec next lint` (lint gates the prod build — escape entities, use `<Link>`), scoped `pnpm test`.
- **Visual (per wave):** browser click-through on the migrated pages (real Chrome) confirming the banner bleeds top-right, fades left, hides on mobile, and no header overlaps the action. (Chrome MCP tooling permitting; otherwise manual on dev.)

## Non-goals (later)
- Redesigning the sidebar, `ProfileCard`, or `MobileNav`.
- Changing card components (`PageCard`, `WorkspaceCard`, `CommunityCard`) beyond what a header swap requires.
- New page content, data, or routes. Notifications still has no page (bell only) — unchanged.
- Final banner artwork (placeholder ships; art is a one-file swap).
- Dark-mode-specific banner variants.
