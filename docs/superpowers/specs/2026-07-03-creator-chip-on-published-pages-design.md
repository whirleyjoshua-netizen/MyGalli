# Sticky Creator Chip on Published Pages

**Date:** 2026-07-03
**Status:** Approved, implementing

## Problem

When viewing someone else's published page (`/[username]/[slug]`), there is no
reliable way to reach the creator's profile or follow them:

- **Header card enabled** (the usual case for a polished page): the default text
  header is suppressed, and `HeaderCard` renders the creator's *free-text* "name"
  (not their username, not a link). No author link, no follow affordance.
- **Tabs enabled**: the whole page is `PublicTabView` — no attribution or follow at all.
- **No header card**: there is a subtle "by {name}" link + inline `FollowButton`,
  but only for logged-in non-owners, at 50% opacity, easy to miss.

We want an always-present affordance, tied to the real `User` account, that lets a
viewer jump to the creator's profile and follow them — independent of the page's
custom header/tabs.

## Approach

A **sticky creator chip**: a small floating pill fixed in the bottom-left corner,
always visible while scrolling. Chosen over a top bar or header/footer edits because
it works identically across header-card, tabs, and plain pages without altering the
creator's custom design.

## Component: `CreatorChip`

`src/components/social/CreatorChip.tsx` (client component).

Props:

```ts
{
  username: string
  name: string | null
  avatar: string | null
  slug: string                // for the logged-out login redirect
  isAuthed: boolean           // viewer is logged in
  viewerIsFollowing: boolean
  viewerIsFriend: boolean
}
```

Layout: `fixed bottom-4 left-4 z-40`, rounded-full pill, `bg-surface` with
backdrop blur, subtle `border-border`, `shadow-soft-lg`.

- **Left (attribution):** avatar (or initial fallback) + display name + `@username`,
  the whole cluster wrapped in a link to `/${username}` (profile). Name truncates.
- **Right (follow):**
  - `isAuthed` → reuse existing `<FollowButton username size="sm"
    initialIsFollowing initialIsFriend />`.
  - not `isAuthed` → a "Follow" button styled like the primary button that links to
    `/login?next=/${username}/${slug}` (returns the viewer to the page after login).

## Wiring: `src/app/[username]/[slug]/page.tsx`

- The page already computes `user`, `meId`, `isOwner`, `viewerIsFollowing`,
  `viewerIsFriend` before the tabs-vs-normal branch (lines ~99–114). Reuse them.
- Render `<CreatorChip>` when **`!isOwner`** (shown to logged-out visitors and
  logged-in non-owners; hidden for the owner — no self-follow).
- Render it in **both** return branches — the tabs early-return and the normal
  layout — so every published page gets it.
- **Cleanup:** in the no-header default header, remove the inline `<FollowButton>`
  (keep the "by {name}" text link) so a plain page does not show two follow buttons
  at once. The chip is the canonical follow affordance.

## Out of scope (YAGNI)

Dismiss/minimize-on-scroll, a share button in the chip, hover profile-preview cards.

## Verification

- `tsc --noEmit` clean.
- Manual render on prod after deploy: view another user's published page while
  logged in (chip + working follow), logged out (chip + login redirect), and as the
  owner (no chip). Check header-card, tabs, and plain page variants.
