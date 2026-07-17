# Public Profile Header Bar — Design

**Date:** 2026-07-14
**Branch:** `profile-header-bar` (off `main` @ `dd0a5c2`)
**Status:** Approved

## Problem

`src/app/[username]/page.tsx` — the public profile — renders no header bar at all. It opens
straight into `ProfileCover`. A visitor arriving from a shared link gets no brand, no
navigation, and no route back into the app. The profile reads as an orphaned page.

The Explore page has a header we want to be consistent with: a sticky gradient bar
(`galli → aqua → violet`) with a Home button, the frog + "My Galli" wordmark, a search box,
and an avatar/login control, over a category-chips sub-bar.

That header is **inlined inside `ExploreClient.tsx`** and shared by nothing. So "make the
profile consistent with Explore" is really a question about extraction, not just markup.

## Scope

**In scope:** the public profile page (`[username]/page.tsx`) and the Explore page refactor.

**Out of scope:** public display pages (`[username]/[slug]`) and hub pages. These
deliberately carry almost no Galli chrome — only a `<BackButton />` plus the creator's own
configured header card. They are creator-branded canvases; stamping Galli nav on them would
compete with the creator's design. The consistency argument applies to the profile because
the profile is Galli's own layout (cover → header card → bio → projects), not a creator canvas.

## Design

### 1. `src/components/nav/GalliTopBar.tsx` (new, client component)

Owns everything visual and auth-related that both pages share:

- Sticky gradient bar: `sticky top-0 z-20`, `bg-gradient-to-r from-galli via-galli-aqua to-galli-violet`, `shadow-soft-lg`
- **Left:** Home button — `/dashboard` when logged in, `/` when logged out
- **Center:** frog (`/gallio-frog.svg`) + "My Galli" wordmark, then a `search` slot
- **Right:** avatar from `useAuthStore`, or a login icon when logged out
- **Sub-bar:** optional `children`, rendered beneath the gradient bar

```ts
interface GalliTopBarProps {
  search?: React.ReactNode
  children?: React.ReactNode   // sub-bar
}
```

Behavior lives with the caller. The component never learns who its consumers are — no
`variant` prop, no branching on page identity. A third page can adopt it without editing it.

**Auth:** reads `useAuthStore` directly, exactly as `ExploreClient` does today. The store is
zustand + `persist` (localStorage), so it hydrates client-side with no network fetch. The
server-rendered profile page renders `GalliTopBar` as a client island — no auth prop-threading.

There is a brief SSR→hydration flash (server renders logged-out → login icon; localStorage
hydrates → avatar). Explore already behaves identically, so this is consistent with the
existing app rather than a new defect. Accepted, not worked around.

### 2. `ExploreClient` — refactored to consume it

Passes its existing controlled/debounced input as `search`, and `<ExploreCategoryChips>` as
`children`. Its local filtering state, debounce, and grid logic are **untouched** — only the
wrapper markup moves out.

### 3. `[username]/page.tsx` — adopts it

Renders `<GalliTopBar search={<ProfileSearchInput />} />` with no sub-bar, above `ProfileCover`.

`ProfileSearchInput` (new, small client component): on submit, routes to
`/explore?search=<query>`. The profile has no grid to filter, so its search is a discovery
hook into Explore rather than a local filter.

### 4. Supporting change — Explore reads `?search=`

`ExploreClient` currently seeds `search` from `useState('')` and never reads the URL. It gains
`useSearchParams()` so `?search=` prefills the box — otherwise the profile's search box would
navigate somewhere that ignores it.

This needs a `<Suspense>` boundary, which `src/app/explore/page.tsx` already has. Side benefit:
Explore search becomes deep-linkable.

This is the one place the work changes another page's *behavior* rather than moving its markup,
so it carries the most regression risk and gets explicit test coverage.

## Testing

- **Unit (`GalliTopBar`):** renders logged-in (avatar, Home → `/dashboard`) and logged-out
  (login icon, Home → `/`); renders with and without the `search` and `children` slots.
- **Unit (`ProfileSearchInput`):** submit routes to `/explore?search=…`; empty submit is a no-op.
- **Regression (Explore):** `src/components/explore/` currently has **no tests** — the refactor
  is therefore unguarded and must bring its own. Add `ExploreClient.test.tsx` covering: the bar
  still renders inside the page, category chips still render in the sub-bar, typing in search
  still drives the `/api/explore` fetch, `?search=foo` seeds the input, and absent `?search=`
  starts empty.
- **Browser:** via the `browsing` skill — a logged-out visitor on a public profile sees the bar,
  and the search box lands on Explore with the query applied.

## Risks

- **Explore regression.** Explore is live and stable on main but has **zero test coverage**, so
  the refactor starts unguarded. Mitigated by writing characterization tests against the current
  behavior *before* moving any markup, keeping filtering logic untouched, and the browser check.
- **Lint before deploy.** Per project history, `tsc` does not run ESLint and prod builds have
  failed on it. `pnpm exec next lint` must pass — this work adds `<img>` usage (needs the
  existing eslint-disable pattern) and `<Link>` for static routes.
