# Sidebar profile consolidation + Settings page — design

Date: 2026-07-05
Status: draft (awaiting user review)

## Problem

The dashboard left rail (`SidebarContent`) shows identity twice at the bottom:
the `ProfileCard` (avatar / name / @handle / bio / follower+view stats) and,
directly below it, a separate user-menu button repeating the avatar + name +
@handle with a dropdown (View profile, Log out). Redundant.

Also there is no account **Settings** page anywhere in the app.

## Goal

1. Remove the redundant bottom user-menu bar and fold its dropdown into the
   `ProfileCard` (adding a **Settings** item), so identity + menu are one unit.
2. Add a small `/settings` page (edit display name, bio, avatar) that the new
   Settings menu item links to.

## Part 1 — Consolidated `ProfileCard`

`ProfileCard` becomes the single identity + menu unit and takes a `collapsed`
prop (the rail collapses via `Sidebar`, w-64 ↔ 76px).

- **Expanded:** the current card (avatar, name, @handle, bio, stats grid) but it
  is **no longer a whole-card `<Link>`**. A **⋮ (kebab) button** in the top-right
  corner opens a dropdown. (Avatar/name are plain, not links.)
- **Collapsed:** renders as just the avatar as a button (no name/bio/stats) that
  opens the same dropdown.
- **Dropdown items** (same in both states):
  - **View profile** → `/{username}`
  - **Settings** → `/settings`
  - **Log out** → `logout()` from `useAuthStore`, then `router.push('/login')`
- Dropdown pattern mirrors the existing user-menu: a fixed full-screen
  click-catcher `div` + an absolutely-positioned panel; opens upward
  (`bottom-full`) since the card sits at the rail bottom. Closes on outside
  click / item click.
- `ProfileCard` gains `useRouter` + the store's `logout` (it already uses
  `useAuthStore`). Stats fetch is unchanged and only runs in the expanded state.

`SidebarContent`:
- Delete the entire bottom user-menu `<div className="relative">…</div>` block
  (the button + its dropdown).
- Replace `{!collapsed && <ProfileCard />}` with `<ProfileCard collapsed={collapsed} />`
  (render in both states), keeping it after the `flex-1` spacer.
- Remove now-unused imports (`ChevronDown`, `LogOut`, `UserCircle`, and
  `useRouter`/`useState`/`logout` usage if no longer referenced in that file).

## Part 2 — `/settings` page

New `src/app/(dashboard)/settings/page.tsx` (client), rendered inside the
dashboard shell so the rail is present.

- **Form fields:** Display name (`input`), Bio (`textarea`), Avatar
  (current avatar preview + an upload control). Email is shown **read-only**
  (changing email needs the existing verify flow — out of scope).
- **Avatar upload:** `POST /api/upload` (FormData `file` → `{ url }`), then the
  new url is set as the pending avatar (persisted on Save).
- **Save:** `PATCH /api/profile` (existing — already accepts `name`, `bio`,
  `avatar`) with the edited values; on success, merge the returned user into the
  auth store via `setAuth({ ...user, ...updated })` so the sidebar card and
  elsewhere reflect the change immediately. Show a saved confirmation; disable
  Save while in-flight.
- No new API route and no schema change — reuses `PATCH /api/profile` +
  `/api/upload`.

## Non-goals

- Email/password change, notification preferences, account deletion, plan/billing
  — not in this Settings v1.
- No redesign of the profile page or the stats.

## Testing

- `ProfileCard`: dropdown opens from the kebab and contains **View profile**,
  **Settings** (→ `/settings`), **Log out**; Log out calls the store's `logout`;
  the collapsed variant renders the avatar button + the same menu and omits the
  name/stats.
- `SidebarContent`: no second `@username` menu button remains (the bottom bar is
  gone) and `ProfileCard` is rendered.
- `/settings`: renders the form pre-filled from the store user; editing name/bio
  and Saving issues `PATCH /api/profile` with the new values (mock `fetch`).

## Files touched

New: `src/app/(dashboard)/settings/page.tsx` (+ test).
Modified: `src/components/dashboard/ProfileCard.tsx` (+ test),
`src/components/dashboard/SidebarContent.tsx`.
