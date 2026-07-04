# Mobile bulletin access + dashboard header condense — design

Date: 2026-07-04
Status: approved

## Problem

1. **Bulletin unreachable on mobile.** The bulletin lives only inside the dashboard
   right-hand `AnalyticsPanel`, whose root is `hidden xl:flex`. Below 1280px the
   panel — and with it the only entry point to `BulletinTab` — disappears. On phones
   there is no way to reach the bulletin at all.
2. **Dashboard header is too wordy.** The header reads "Welcome back, Joshua" +
   "Everything you create lives in your universe.", and the public-feed row is titled
   "Discover". Too much text up top.

## Goals

- Give mobile users a way to open the bulletin.
- **Do not change desktop** — the desktop sidebar rail and the right-panel Bulletin
  tab stay exactly as they are today.
- Condense the dashboard header copy (applies to both mobile and desktop since the
  header is shared).

## Non-goals

- No change to bulletin data/logic, the composer, or the `AnalyticsPanel` Bulletin tab.
- No redesign of `BulletinTab` internals.
- No new mobile bottom-tab-bar pattern.

## Design

### 1. Bulletin route (destination)

New page `src/app/(dashboard)/bulletin/page.tsx`. It renders the existing
`BulletinTab` component inside the dashboard route-group shell, in a centered
full-width container (not the 360px rail). No bulletin logic is duplicated — the
page is a thin wrapper. A short page heading ("Bulletin") orients the user.

Desktop users are not linked here (nav entry is mobile-only), but the route
existing does not change desktop behavior.

### 2. Mobile-only nav entry

`SidebarContent` is shared by the desktop `Sidebar` rail and the `MobileNav`
drawer. Add an optional prop:

```
SidebarContent({ collapsed?, onNavigate?, mobile? })
```

When `mobile` is true, a `Bulletin` nav item (Megaphone icon, `href='/bulletin'`,
matching `p.startsWith('/bulletin')`) is included in the nav list. The item is
placed after "Explore" and before "Analytics". When `mobile` is falsy (the desktop
rail — which passes nothing), the item is omitted, so the **desktop rail is
byte-for-byte unchanged**.

`MobileNav` passes `mobile` when it renders `SidebarContent` in the drawer.

### 3. Header condense (shared header in `dashboard/page.tsx`)

- `h1`: `Welcome back{, name}` → `Your Personal Gallery`
- Remove the subtitle paragraph `Everything you create lives in your universe.`
- Public-feed `ScrollRow` title: the non-follow label `Discover` → `Explore`
  (the follow label `Public feed` and both subtitles are unchanged).

## Testing

- `SidebarContent`: renders the Bulletin nav item (link to `/bulletin`) when
  `mobile` is true; does NOT render it when `mobile` is falsy (guards the
  "desktop unchanged" invariant).
- `/bulletin` page: smoke test that it renders `BulletinTab` (mock as needed).
- Header: assert `Your Personal Gallery` present, `Welcome back` and
  `Everything you create lives in your universe.` absent, and the feed row shows
  `Explore` not `Discover` in the non-follow state.

## Files touched

- add `src/app/(dashboard)/bulletin/page.tsx`
- `src/components/dashboard/SidebarContent.tsx` (add `mobile` prop + item)
- `src/components/dashboard/MobileNav.tsx` (pass `mobile`)
- `src/app/(dashboard)/dashboard/page.tsx` (header copy)
- tests alongside the above
