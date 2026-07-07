# Mailbox Element — Design

**Date:** 2026-07-06
**Status:** Approved (brainstorm complete) → ready for implementation plan
**Branch:** `worktree-mailbox` (off `origin/main` @ 66397ff)

## Summary

A `mailbox` page element that lets a visitor leave a **private message** — written
or audio — that goes **straight to the publisher's inbox** and is **never shown
on the page**. New `Message` model, a public capture card, a dedicated
`/messages` inbox in the dashboard, and a bell notification on arrival.

**Free** for now (Pro-label deferred, consistent with the other Batch-2
elements; the planned Pro-gating sweep decides paywalls across all elements at
once). Video is deferred, but the model is **kind-agnostic** so video slots in
later with no rework.

This is a **larger feature than a display element** (Hub tier): it adds a DB
model, four API routes, a new owner surface (the inbox), and a notification type.

### v1 scope

- Message types: **written (text)** and **audio**.
- Audio capture: **record in-browser** (MediaRecorder → `audio/webm`, already an
  accepted upload type) **+ a file-upload fallback**. No new upload infra.
- Owner surface: a **dedicated `/messages` inbox page** (all messages across all
  the owner's pages, unread badges, inline audio playback, mark read, delete).
- Notification on new message via the existing bell.

### v1 explicitly excludes (clean follow-ons)

Video messages; email delivery of messages (bell only); replies/threads;
per-owner-gated media URLs (media is an unguessable public Blob URL for v1, same
stance as Hub); auto-retention/expiry; Pro-gating.

## Data model — new `Message` model

```prisma
model Message {
  id          String   @id @default(cuid())
  displayId   String
  display     Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)
  ownerId     String   // = display.userId, denormalized so /messages queries all pages in one indexed hit
  elementId   String   // which mailbox element it came from
  kind        String   // 'text' | 'audio'  (future: 'video')
  body        String?  // text content / optional caption
  mediaUrl    String?  // audio Blob url
  senderName  String?
  senderEmail String?
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())
  ipHash      String?  // spam-guard, hashed — not raw IP, not tracking (same pattern as FormResponse/Comment)

  @@index([ownerId, read])
  @@index([ownerId, createdAt])
  @@index([displayId])
}
```

`User` gains `messages Message[]` via the `ownerId` relation? — NO: to avoid a
required back-relation churn, `ownerId` is a plain indexed column (not a Prisma
relation). Cascade on user delete is handled by the `displayId → Display →
User onDelete: Cascade` chain (deleting a user deletes their displays, which
cascades their messages). The `ownerId` denormalization is purely a query
optimization for the cross-page inbox.

## Surfaces

### 1. Public element — `MailboxElement` (editor) + `PublicMailboxElement` (public)

Fields added to `CanvasElement` (`src/lib/types/canvas.ts`):
`mailboxTitle?`, `mailboxPrompt?`, `mailboxAllowAudio?` (bool),
`mailboxRequireName?` (bool), `mailboxButtonLabel?`, `mailboxThankYou?`.

- **Editor** (standard props): edit title, prompt, button label, thank-you text;
  toggle "allow audio" and "require name". A live preview of the card.
- **Public card:**
  - A prompt + a **text area**.
  - If `mailboxAllowAudio`: a **tap-to-record** control using the browser
    **MediaRecorder API** (records to `audio/webm`), with playback-before-send
    and a **"or upload a file"** fallback (`<input type=file accept=audio/*>`).
  - Optional **name** + **email** fields (name required iff `mailboxRequireName`).
  - A hidden **honeypot** input (bots fill it → server silently drops).
  - **Submit flow:** if there's audio, the client first uploads the blob to the
    existing `POST /api/upload` → gets a URL; then `POST /api/messages` with
    `{ kind, body, mediaUrl?, senderName?, senderEmail?, hp }`. On success →
    thank-you state. This reuses the upload pipeline (audio already validated at
    25MB) — **no new upload infra**.

### 2. Owner inbox — `/messages` (dashboard, owner-only)

A dashboard-shelled page, `getUser` + auth-gated:
- One list of the owner's messages across **all** their pages, newest first
  (via the `ownerId` index). Filter `all | unread`.
- Each row: sender name/email (or "Anonymous"), a snippet / inline **audio
  player** (reuse the existing audio element/player styling), the **page** it
  came from, and a timestamp. Unread rows are visually emphasized.
- Actions: **mark read** (auto on open) / mark unread, **delete**.
- A **"Messages"** item in `SidebarContent` NAV with an **unread badge**
  (polls `GET /api/messages/unread-count`, same pattern as the notification
  bell).

### 3. Notification

On a successful submit, `createNotification({ userId: ownerId, type: 'message',
… })`. Add a `'message'` case to the db-free `formatNotification`
(`src/lib/notifications-format.ts`) — e.g. "New message on *{page title}*" —
deep-linking to `/messages`. (Never import `notifications.ts` into a client
component — the bell uses `notifications-format.ts`.)

## APIs (all mirror `getUser` → 401 → JSON; ownership-checked where owner-only)

- `POST /api/messages` — **public**, rate-limited (`rateLimit`), honeypot-checked,
  `ipHash`-stamped. Body `{ displayId, elementId, kind, body?, mediaUrl?,
  senderName?, senderEmail?, hp }`. Validates: the display exists **and is
  published** (public visitors only reach the card on a published page — reject
  otherwise); it contains a `mailbox` element with `elementId`; `kind ∈
  {text,audio}`; text or media present; name present if the element requires it.
  Sets `ownerId` from
  `display.userId`; creates the `Message`; fires the notification. Honeypot
  non-empty → return 200 (silent success) without persisting.
- `GET /api/messages` — owner-only; the caller's messages (paginated,
  `?filter=unread`), newest first.
- `PATCH /api/messages/[id]` — owner-only (message.ownerId === user.id); `{ read }`.
- `DELETE /api/messages/[id]` — owner-only.
- `GET /api/messages/unread-count` — owner-only; `{ count }` for the nav badge.

## Security / abuse / privacy

- Public submit is the only unauthenticated surface: **rate-limited**,
  **honeypot**, **`ipHash`** (hashed, not raw), audio size cap enforced by the
  existing `validateUpload` at the `/api/upload` step (25MB), and no raw HTML is
  rendered (all message content is text).
- All owner routes + the inbox verify `getUser` and `message.ownerId === user.id`
  (or `display.userId` for the submit's owner resolution).
- **Privacy caveat (documented, v1):** audio is stored in Vercel Blob at an
  unguessable public URL; a leaked URL is viewable. True per-owner-gated media
  access is a Phase 2 (same stance as Hub). Messages themselves are only listed
  to the owner.

## Wiring (standard add-an-element seams)

`ElementType 'mailbox'` + `mailbox*` fields + `createElement` default (canvas.ts)
→ `MailboxElement` + `PublicMailboxElement` (+ index.ts) → `SlashCommandMenu`
entry under **Forms** (`{ id: 'mailbox', label: 'Mailbox', icon: Inbox, description: 'Collect private written/voice messages', category: 'Forms' }`)
→ `ColumnCanvas` case (preview → Public, else editor) → `render-elements.tsx`
case. No `PageEditor` edit (its `default:` handles it).

**Net-new beyond a normal element:** the `Message` model + migration; the four
`/api/messages` routes; the `/messages` inbox page + `SidebarContent` nav item +
unread badge; the `'message'` notification type + formatter.

## Testing

- **Submit API:** honeypot non-empty → 200, nothing persisted; missing
  text+media → 400; valid text → persists with `ownerId` set + notification
  fired (mock); rate limit returns 429; non-existent display / missing mailbox
  element → 404/400.
- **Owner routes:** `GET /api/messages` returns only the caller's messages;
  `PATCH`/`DELETE` reject a non-owner (403); `unread-count` counts unread.
- **`formatNotification('message')`** (pure) → correct text + `/messages` link.
- **Public element (component):** renders prompt + text area; with
  `mailboxAllowAudio` shows the recorder + upload fallback; submit posts and
  shows the thank-you; honeypot present but visually hidden.
- **Inbox (component):** given messages → renders rows, unread emphasis,
  mark-read and delete call the right endpoints.

## Build order (the plan will sequence; ships value progressively)

1. `Message` model + migration.
2. `POST /api/messages` (+ honeypot/rate-limit/ipHash/notification) + tests.
3. Owner routes (`GET`/`PATCH`/`DELETE`/`unread-count`) + tests.
4. `'message'` notification type + `formatNotification` case + test.
5. Public element (`MailboxElement` + `PublicMailboxElement`, recorder + submit) + tests.
6. Element type/fields/default (canvas.ts) + wiring (slash menu, ColumnCanvas, index, render-elements).
7. `/messages` inbox page + `SidebarContent` nav item + unread badge.

## Success criteria

1. Owner adds a Mailbox element, sets the prompt, optionally requires a name and
   allows audio.
2. A visitor leaves a written message and (separately) records + sends an audio
   message; each shows a thank-you and is NOT rendered on the page.
3. The owner sees an unread badge, opens `/messages`, reads the text, plays the
   audio, and deletes one — all scoped to their own messages.
4. A non-owner cannot read, modify, or delete another owner's messages.
5. Bot submissions (honeypot filled) are silently dropped.
