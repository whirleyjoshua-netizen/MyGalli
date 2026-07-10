# Data tab consolidation + Profile mailbox button

**Date:** 2026-07-07
**Status:** Design approved
**Branch:** `worktree-data-mailbox` (off `origin/main` @ c484a4d)

## Problem

Two changes:

1. **Rename "Analytics" → "Data"** and fold the standalone **Messages** inbox into it as a
   fourth tab, so the Data section has: **Overview · Elements · Bulletin · Messages**.
2. Add a **built-in "Message" button to every profile's ID card** (`/[username]`) so visitors
   can send the profile owner a private message without the owner having to place the Mailbox
   element on a page. Messages land in the **same inbox** as element messages.

## Decisions (from brainstorming)

- Profile button is **visitor-facing**; clicking opens a **modal** compose form on the profile
  (not a separate page).
- The standalone `/messages` route + its sidebar item are **removed/consolidated**; `/messages`
  becomes a redirect, and the unread badge moves onto the Data nav item.
- The section **URL is renamed** `/analytics` → `/data` (not just the label), with redirects.
- Profile mailbox uses **fixed defaults** (no per-user config in v1).
- The Message button shows to **all viewers** (including the owner on their own profile) in v1.

---

## Part 1 — Analytics → Data, with a Messages tab

### Route rename + redirects
- Move the page folder `src/app/(dashboard)/analytics/` → `src/app/(dashboard)/data/` (route `/data`).
- `src/app/(dashboard)/analytics/page.tsx` becomes a **server-component redirect** that reads the
  `searchParams` prop and calls `redirect('/data?' + new URLSearchParams(searchParams))`, so
  `?displayId=&tab=` is preserved.
- `src/app/(dashboard)/messages/page.tsx` becomes a server-component `redirect('/data?tab=messages')`.
- Update the ~22 internal references to `/analytics` and `/messages` (sidebar, dashboard cards,
  element deep-links, notification `entityUrl`s) to the new paths. The redirects catch anything missed.

### Data page tabs
- In the (renamed) Data page, extend the tab union to
  `'overview' | 'elements' | 'bulletin' | 'messages'` and add a **Messages** tab button
  (icon `Inbox`/`Mail`), initialised from `?tab=messages`.
- The Messages tab renders `<MessagesInbox />` directly (it self-fetches `/api/messages`).
  Overview/Elements are per-display (driven by the header page selector); Bulletin and Messages
  are account-wide and ignore the selector — matching the current Bulletin behavior.
- Header `<h1>` "Analytics" → "Data".

### Sidebar
- `SidebarContent.tsx`: rename the "Analytics" nav item to **"Data"**, `href: '/data'`,
  `match: (p) => p.startsWith('/data')`.
- Remove the standalone **"Messages"** nav item; render `<MessagesNavBadge />` on the **Data**
  item instead (unread count still polls the same endpoint).

---

## Part 2 — Profile mailbox button (visitor-facing modal)

### Schema
- Make `Message.displayId` **nullable**: `displayId String?` and the relation optional
  (`display Display? @relation(...)`). Keep `onDelete: Cascade` for the page case. Profile
  messages store `displayId = null`.
- Migration via `migrate diff` → SQL → `migrate deploy` (never `migrate dev`). Timestamp must
  sort after the latest existing migration.

### API — `POST /api/messages/profile`
New route. Body: `{ username, kind, body?, mediaUrl?, senderName?, senderEmail?, hp }`.
- Rate-limit (reuse `messages-submit` prefix) + honeypot (silently accept if `hp` non-empty).
- Resolve `username` → user (404 if none). Reject empty message (no body and no mediaUrl).
- Create `Message` with `displayId = null`, `elementId = 'profile-mailbox'`, `ownerId = user.id`,
  `kind`, `body`, `mediaUrl`, `senderName`, `senderEmail`, `ipHash` (same hashing as the element route).
- `createNotification({ userId: user.id, type: 'message', actor: { name: senderName || 'Someone' },
  entityUrl: '/data?tab=messages', contextText: 'Profile mailbox' })`.
- Return 201 `{ ok: true }`.
- The existing element route keeps updating its own `entityUrl` to `/data?tab=messages` too.

### Shared composer (DRY)
- Extract the compose form (textarea, audio record/upload, name/email, honeypot, submit + sent
  state) from `PublicMailboxElement.tsx` into a new **`MailboxComposer`** component that takes:
  - `onSubmit(payload): Promise<{ ok: boolean; error?: string }>` (or a `target` describing where to POST),
  - display config props (`title?`, `prompt?`, `requireName`, `allowAudio`, `buttonLabel?`, `thankYou?`).
- `PublicMailboxElement` becomes a thin wrapper that maps its `element` fields to `MailboxComposer`
  props and POSTs to `/api/messages` (element-scoped). Behavior must be unchanged — guarded by the
  existing `PublicMailboxElement.test.tsx`.
- The audio upload still goes to `/api/messages/upload` (shared by both paths).

### Profile modal + button
- `ProfileMailboxModal.tsx`: a modal (existing overlay pattern — fixed overlay + centered dialog +
  close) wrapping `MailboxComposer` with profile defaults (title "Send me a message", `allowAudio: true`,
  `requireName: false`), submitting to `POST /api/messages/profile` with the profile `username`.
- `ProfileIdCard.tsx`: add a **Message** button (mail icon). Clicking sets modal-open state. Visible
  to all viewers. Label "Message".

### Inbox rendering
- `MessagesInbox`: where it shows the source page title (`message.display.title`), handle a **null
  display** → show **"Profile"** (and no page link). The GET already `include`s `display`; with a
  nullable relation it returns `null` for profile messages — render accordingly.

---

## Files

**Part 1**
- Move: `src/app/(dashboard)/analytics/page.tsx` → `src/app/(dashboard)/data/page.tsx` (add Messages tab, rename title)
- Create: `src/app/(dashboard)/analytics/page.tsx` (redirect → `/data`)
- Modify: `src/app/(dashboard)/messages/page.tsx` (redirect → `/data?tab=messages`)
- Modify: `src/components/dashboard/SidebarContent.tsx` (rename item, move badge, drop Messages item)
- Modify: ~22 files referencing `/analytics` or `/messages` (paths + notification entityUrls)

**Part 2**
- Modify: `prisma/schema.prisma` (+ migration) — nullable `Message.displayId`
- Create: `src/app/api/messages/profile/route.ts`
- Create: `src/components/elements/MailboxComposer.tsx`
- Modify: `src/components/elements/PublicMailboxElement.tsx` (use `MailboxComposer`)
- Create: `src/components/profile/ProfileMailboxModal.tsx`
- Modify: `src/components/profile/ProfileIdCard.tsx` (Message button)
- Modify: `src/components/dashboard/MessagesInbox.tsx` (null-display → "Profile")
- Modify: `src/app/api/messages/route.ts` (notification entityUrl → `/data?tab=messages`)

## Testing / verification

- `tsc --noEmit` clean; `PublicMailboxElement.test.tsx` stays green after the composer extraction
  (proves behavior preserved). Add a focused test for the profile route's happy path + honeypot +
  unknown-username 404 if a route test harness exists for the messages API (mirror any existing
  `messages/route.test.ts`).
- Manual smoke: rename shows "Data" with 4 tabs; `/analytics` and `/messages` redirect correctly;
  send a message from a profile ID card → appears in the Data ▸ Messages inbox labeled "Profile";
  element messages still work and show their page title; unread badge on the Data nav item updates.

## Deferred (YAGNI)
- Per-user profile-mailbox config (title/prompt/require-name/allow-audio).
- Hiding the Message button from the owner viewing their own profile.
- Video messages.
