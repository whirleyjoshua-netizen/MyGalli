# Profile DM + Followers Picker — Design

Date: 2026-07-20
Branch: `feat/profile-dm`

## Problem

Two gaps found by testing the flow with two mutually-following accounts.

### 1. The profile "Message" button never reaches the DM system

A logged-in member who clicks **Message** on another member's profile has their
message stored as an **anonymous visitor note**, surfacing in the "Visitor notes"
tab rather than as a conversation in the regular inbox.

Root cause — the button predates Messages M1 and was never rewired:

- `src/components/profile/ProfileActionCards.tsx:66` — the message card is
  unconditionally `onClick={() => setMailboxOpen(true)}`, opening the legacy
  `ProfileMailboxModal`.
- `ProfileMailboxModal.tsx:16` posts to `POST /api/messages/profile`.
- `src/app/api/messages/profile/route.ts` **never calls `getUser`/`verifyAuth`**
  (it imports `getJwtSecret` only to salt an IP hash; there is no 401 branch).
  - Line 24: `senderName` is free text from an optional form field.
  - Line 47: the notification is hardcoded `actor: { id: null, name: senderName || 'Someone' }`.
- It writes to the legacy `Message` model (`prisma/schema.prisma:417`), which has
  **no sender FK to `User`** — structurally incapable of recording a member sender.
- `Message` rows are read by `GET /api/messages` → the "Visitor notes" tab.

The follow relationship is irrelevant on this path because no code on it reads
the session at all. Nothing on the profile page calls `POST /api/dm/conversations`;
the sole caller in the codebase is `MessagesClient.tsx:204`.

The DM backend already behaves correctly: `initialParticipantState`
(`src/lib/dm.ts:36`) places a conversation as `accepted` when the recipient
follows the sender, else `requested`. The two accounts would have landed in the
regular inbox had the button called it.

### 2. Starting a DM requires typing a username

`MessagesClient.tsx:200` is a native browser prompt:

```ts
const username = window.prompt('Message which member? Enter their username.')?.trim()
```

There is no user picker anywhere in the app.

## Decisions

Confirmed with the user before design:

1. **Auth-aware split** on the profile Message button. Logged-in → real DM.
   Logged-out → today's anonymous visitor-note modal, unchanged. This preserves
   public note capture from non-members while members get threaded DMs.
2. **Followers + following, searchable** for the picker, mutuals surfaced first.

## Behavior

### Profile Message button

| Viewer | Behavior |
| --- | --- |
| Owner | Unchanged — `mailbox` card links to `/messages`. |
| Logged out | Unchanged — `ProfileMailboxModal` → `POST /api/messages/profile` → `Message` row → "Visitor notes" tab. |
| Logged in (not owner) | New `ProfileDmModal`: textarea + Send. Creates the conversation and posts the first message, then navigates to `/messages?c=<id>`. |

The logged-in send is two existing calls, in order:

1. `POST /api/dm/conversations` with `{ username }` → `{ id }` (201 new, 200 if a
   conversation already existed — idempotent via `conversationKey`).
2. `POST /api/dm/conversations/<id>/messages` with `{ body }` → creates a
   `DirectMessage` with `senderId: user.id`.

Sending the first message inline (rather than routing to an empty thread) keeps
the interaction to one step, matching the intent of clicking "Message".

Recipient placement is decided server-side and unchanged: **All** tab if they
follow the sender, **Requests** otherwise.

### Followers picker

A `UserPickerModal` replaces `window.prompt`, opened by the existing "New Message"
button (`MessagesClient.tsx:262`).

- Sources: `GET /api/users/<me>/followers` and `GET /api/users/<me>/following`.
- Merged, deduped by `username`, **mutuals first** (present in both lists), then
  the remainder alphabetically by `name ?? username`.
- Client-side search filters on `name` and `username` — the lists are capped at
  100 each server-side, so ≤200 rows; no server search needed.
- Selecting a row calls `onSelect(username)`, which runs the existing
  `startConversation(username)` path.
- Empty state (no followers or following yet) offers a free-text username input
  so the capability `window.prompt` provided is not lost.

## Non-goals / deliberate non-changes

- **`POST /api/messages/profile` stays unauthenticated.** It is the public
  note-taking path for logged-out visitors, and is already honeypot- and
  IP-rate-limited. Adding auth would break anonymous notes.
- No schema changes. No new API routes. Both DM routes and both follower routes
  already exist and are already tested.
- The legacy `Message` model and the "Visitor notes" tab are untouched.
- No search across all users — only the viewer's social graph, per the decision
  above. The empty-state free-text input covers reaching someone outside it.

## Constraints discovered

- The follower endpoints are `/api/users/[username]/followers|following`, **not**
  `/api/followers`. They are unauthenticated, hard-capped at `take: 100`, have no
  pagination or search, and **strip `id`** from the response — returning only
  `{ username, name, avatar, isFollowing }`. This is sufficient because
  `POST /api/dm/conversations` keys off `username`.
- `MessagesClient` currently receives only `myId`; it needs `myUsername` to fetch
  the viewer's own follower lists. The page has it.
- `ProfileActionCards` receives no session value. `src/app/[username]/page.tsx`
  computes `meId` via a local `getMeId()` helper but never passes it down.
- `src/components/social/FollowListModal.tsx` is the closest existing component —
  same fetch and row markup, but no search input and no `onSelect` (its rows are
  `Link`s to the profile). The new picker follows its markup conventions.

## Test impact

- `src/components/messages/MessagesClient.test.tsx:220` stubs `window.prompt` and
  **will break by design**; it is rewritten against the modal.
- The five existing cases in `src/app/api/messages/profile/route.test.ts` stay
  green — that route is not modified.
- Existing `src/app/api/dm/**` route tests are unaffected — no route changes.
- New: pure merge/dedup/sort logic for the picker (TDD), picker component
  behavior, the profile modal's two-call sequence, and the auth-aware branch.
