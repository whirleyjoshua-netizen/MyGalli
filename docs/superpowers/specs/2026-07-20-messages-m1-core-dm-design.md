# Messages M1 — Core DM (design)

**Date:** 2026-07-20
**Status:** approved design, ready for implementation planning
**Scope:** milestone M1 of a 3-milestone Messages redesign

## Problem

`/messages` today is a one-way suggestion box. `MessagesInbox.tsx` renders a flat list of
cards with mark-read and delete. The `Message` model has no `senderId` — a sender is
free-text `senderName`/`senderEmail` captured from an anonymous visitor who filled in a
`mailbox` element. There is no conversation, no reply path, and no link from a message to
a Galli account.

The user's mockup is a two-way DM product: threaded conversations, a chat transcript with
replies, presence, read receipts, reactions, starring, tags, spam, conversation notes,
shared content, and a rich composer. Almost none of it is styling; nearly every element is
net-new backend.

This spec covers **M1 only**: the conversation substrate and a working text messenger.

## Decisions taken (user-approved)

| Question | Decision |
|---|---|
| Who can converse? | **Members only** — DMs between Galli accounts. Anonymous mailbox messages stay a separate read-only "Visitor notes" section. |
| Message delivery | **Adaptive polling.** No WebSockets (not viable in Vercel functions), no vendor. |
| Who may start a conversation? | **Anyone, but strangers land in Requests** (Instagram model): accept / ignore / block. |
| Build shape | **Three vertical slices**, each independently shippable: M1 Core DM → M2 Context & organization → M3 Rich composer. |
| Presence | A `lastSeenAt` heartbeat, not true presence. Green dot under 2 minutes. |

### Milestones (M2/M3 are out of scope here, listed for context)

- **M1 · Core DM** — schema, API, 3-column shell, text messaging, Requests, polling,
  Visitor-notes tab. *This spec.*
- **M2 · Context & organization** — person panel Notes + Shared Content, Starred/Voice/Spam
  filters, search, tags, mute UI, read receipts.
- **M3 · Rich composer** — image/file attach, voice notes, emoji, GIF, reactions.
  GIF requires a vendor decision (Giphy vs Tenor: API key, attribution, CSP image hosts).

## Data model

Four additive changes. No existing model is modified or dropped; no data migrates.

```prisma
model Conversation {
  id            String   @id @default(cuid())
  key           String   @unique          // sorted "userIdA:userIdB"
  lastMessageAt DateTime @default(now())
  createdAt     DateTime @default(now())
  participants  ConversationParticipant[]
  messages      DirectMessage[]
  @@index([lastMessageAt])
}

model ConversationParticipant {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation("UserConversations", fields: [userId], references: [id], onDelete: Cascade)
  state          String       @default("accepted")  // accepted | requested | blocked
  lastReadAt     DateTime?
  starred        Boolean      @default(false)
  muted          Boolean      @default(false)
  createdAt      DateTime     @default(now())
  @@unique([conversationId, userId])
  @@index([userId, state])
}

model DirectMessage {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       String
  sender         User         @relation("UserDirectMessages", fields: [senderId], references: [id], onDelete: Cascade)
  kind           String       @default("text")   // text | image | audio | file (M3)
  body           String?
  mediaUrl       String?
  createdAt      DateTime     @default(now())
  deletedAt      DateTime?
  @@index([conversationId, createdAt])
}
```

Plus one column on `User`:

```prisma
lastSeenAt DateTime?
```

and two back-relations on `User`:

```prisma
conversations  ConversationParticipant[] @relation("UserConversations")
directMessages DirectMessage[]           @relation("UserDirectMessages")
```

### Why each decision

**`DirectMessage`, not `Message`.** `Message` is the existing visitor-mailbox model.
Separate tables and separate names mean zero migration of existing data, no ambiguity in
code review, and visitor notes keep working untouched.

**Per-participant state.** `state`, `lastReadAt`, `starred`, `muted` live on
`ConversationParticipant`, never on `Conversation`. Each side's read position, star, and
mute are private to them, and the same thread can be accepted for one person and a pending
request for the other. Placing any of these on `Conversation` makes M2's filters unfixable.

**Unread as a timestamp.** Unread = messages in the thread with `createdAt > lastReadAt`
and `senderId != me`. One indexed query against one column, instead of a read-receipt row
per message per user.

**`key` for race-safety.** Two people pressing "New Message" simultaneously would otherwise
create two conversations for the same pair and silently split the transcript. Sorted
user-id pair + `@unique` + upsert makes duplicates impossible.

**`deletedAt` from day one.** Soft delete is already an open backlog item elsewhere in the
codebase; a sender unsending a message should not vaporise the row.

### Migration

Additive-only, **hand-authored** `prisma/migrations/<ts>_messages_m1_core_dm/migration.sql`
containing only these tables/columns — `migrate diff --from-url` is contaminated on the
shared dev DB and emits spurious `DROP TABLE`s for concurrent branches. Apply with
`migrate deploy`. Prisma commands need `DATABASE_URL_UNPOOLED` set alongside
`DATABASE_URL`, and `DATABASE_URL` must be set inline (machine-level value points at a
different database).

## API

New routes under `src/app/api/dm/*`. `/api/messages/*` (public visitor mailbox) is not
touched.

| Route | Behaviour |
|---|---|
| `GET /api/dm/conversations?filter=all\|unread\|requests&cursor=` | List, `lastMessageAt` desc. Row: other participant (id, username, name, avatar, `lastSeenAt`), last-message preview, `unreadCount`, `starred`, `state`. Side effect: stamps caller's `lastSeenAt` (heartbeat rides along — no separate endpoint). |
| `POST /api/dm/conversations` `{ username }` | Find-or-create by `key` via upsert. Returns the conversation, existing or new. |
| `GET /api/dm/conversations/[id]/messages?after=&cursor=&limit=30` | `after` = poll for new messages only; `cursor` = page backwards through history. Excludes `deletedAt != null`. |
| `POST /api/dm/conversations/[id]/messages` `{ body }` | Create message, bump `lastMessageAt`, notify recipient per the first-unread rule below (never when muted, never for `requested` threads). |
| `POST /api/dm/conversations/[id]/read` | Set caller's `lastReadAt = now()`. |
| `PATCH /api/dm/conversations/[id]` `{ state?, starred?, muted? }` | Accept / ignore / block; star; mute. **M1 UI exercises `state` only** — `starred`/`muted` are accepted by the API so M2 needs no route change, but nothing in the M1 interface sets them. |
| `GET /api/dm/unread-count` | Nav badge count. |

### Requests gate

On `POST /api/dm/conversations`, two participant rows are created:

- **Sender:** always `accepted`.
- **Recipient:** `accepted` if the recipient already follows the sender, or an accepted
  conversation already exists between the pair; otherwise `requested`.

The recipient's inbox shows `requested` threads under the Requests filter only. Accepting
sets `accepted`; ignoring sets `blocked`, which hides the thread from the blocker's list
and makes the other party's subsequent sends fail with 403. The follow check reuses the
existing `Follow` model.

### Authorization

Every `/[id]` route re-verifies from the database that the caller holds a
`ConversationParticipant` row for that conversation, **before** any read or write. A
non-participant receives **404, not 403**, so conversation ids cannot be probed for
existence. This is the same bug class as the previously-fixed comment IDOR; private
messages are a worse place to repeat it.

Sends are rate-limited via the existing `rateLimit` helper (30/min per user, prefix
`dm-send`). Message bodies are rendered through `sanitize.ts`, matching bulletin posts.
Empty/whitespace-only bodies are rejected 400. Bodies are capped at 4000 characters.

## UI

`/messages` keeps `PageHero`. Below it: a filter bar, then a 3-column grid, edge-to-edge
with `px-6 lg:px-8` (no `max-w-*` wrapper).

```
┌──────────────────────────────────────────────────────────────┐
│ PageHero — Messages                                          │
├──────────────────────────────────────────────────────────────┤
│ [ All | Unread ² | Requests | Visitor notes ]        [New]   │
├───────────────┬──────────────────────────┬───────────────────┤
│ Conversation  │ Thread                   │ Person            │
│ list          │  header + bubbles        │  avatar, @handle  │
│ (scrolls)     │  ───────────────         │  Follows you      │
│               │  composer                │  [Profile]        │
└───────────────┴──────────────────────────┴───────────────────┘
```

New components in `src/components/messages/`:

- **`MessagesClient.tsx`** — the only stateful component: selection, polling, optimistic
  sends. Selection lives in the URL as `?c=<conversationId>`, so threads are linkable,
  survive refresh, work with Back, and notifications can deep-link to a conversation.
- **`ConversationList.tsx` / `ConversationRow.tsx`** — avatar with initials fallback, name,
  one-line preview, relative time, unread pill, presence dot.
- **`MessageThread.tsx`** — header (avatar, name, presence); day separators; auto-scroll to
  bottom on new messages *unless* the user has scrolled up into history.
- **`MessageBubble.tsx`** — own messages right-aligned in `galli/15`, others left in
  `muted`; timestamp; `pending` / `failed` states.
- **`MessageComposer.tsx`** — auto-growing textarea; Enter sends, Shift+Enter newline.
- **`RequestBanner.tsx`** — for `requested` threads, replaces the composer with
  "<name> wants to message you" + Accept / Ignore.
- **`PersonPanel.tsx`** — avatar, name, `@handle`, follow relationship, Profile link.

### Deliberate deviations from the mockup in M1

- **Composer `+` / image / GIF / emoji / mic render disabled**, with "Coming soon"
  tooltips (same honest-placeholder pattern as the Library CTA). The composer is the most
  layout-sensitive element on the page; building its final shape once avoids re-flowing it
  in M3.
- **Starred / Voice / Spam filters do not ship.** A dead tab returning nothing reads as
  broken; a greyed-out button reads as forthcoming. M1 ships All / Unread / Requests, all
  backed by real queries.
- **Visitor notes** get their own tab rendering today's anonymous mailbox messages
  read-only through the existing component, restyled. Nothing currently received moves or
  disappears.
- **Notes and Shared Content cards** in the person panel are M2. M1 ships the column so the
  layout is final.
- **The search box does not ship.** Search is M2, and unlike the composer icons a search
  field cannot be convincingly disabled — an input that ignores typing reads as broken. The
  filter bar has room reserved for it.

### Responsive

Below `lg`, one column at a time: the list, and selecting a conversation swaps to the
thread with a back arrow — driven by the same `?c=` param, so there is no separate mobile
code path. The person panel is hidden below `xl`.

### Empty states

Illustrated in the existing `DataIllustration`/`AppIllustration` style, not bare text:
empty inbox, no thread selected, no results.

## State, polling, error handling

One hook, `useInboxPolling`, is the single place any cadence is defined:

- Open thread: **5s**, `?after=<lastMessageId>` — appends only new messages.
- Conversation list: **20s** (doubles as the presence heartbeat).
- Both stop when `document.hidden`; refetch immediately on refocus.
- After 3 consecutive failures, back off to 30s and show a quiet "Reconnecting…" line.

**Optimistic send:** append with a client-generated id and `pending` flag; replace with the
server row on success. On failure mark `failed` with Retry **and leave the text in the
composer**. Poll responses dedupe by server id so a just-sent message cannot double.

**Errors:** 404 on a conversation → "This conversation isn't available", clear `?c=`.
403 on send (blocked) → inline notice, composer disabled. Poll failures are silent by
design.

## Testing

Db-free logic in `src/lib/dm.ts`, following the `notifications-format.ts` /
`hub-access.ts` pattern, developed TDD:

- `conversationKey(a, b)` — stable regardless of argument order
- `unreadCount(messages, lastReadAt, myId)` — excludes own messages, handles null
  `lastReadAt`
- `initialParticipantState(followState)` — the accepted/requested gate
- `groupByDay(messages)` — midnight boundaries
- `isOnline(lastSeenAt, now)` — the 2-minute threshold, null handling

Route tests (`route.test.ts` convention), covering the security-critical paths explicitly:

- non-participant gets **404** on both read and send
- blocked sender gets 403
- concurrent `POST /conversations` for the same pair yields exactly one conversation
- a stranger's first message creates the recipient row as `requested`
- a followed sender's first message creates it as `accepted`

Component tests: list render + unread pill, thread day-grouping, optimistic send against a
failing fetch (text preserved, Retry offered), request banner replacing the composer.

## Out of scope for M1

Group threads, conversation notes, tags, spam filter, search, read receipts, reactions,
attachments, images, voice notes, emoji picker, GIF, true presence, typing indicators,
message editing, email notifications for new DMs.

## Risks

- **Polling load.** 5s/20s with hidden-tab suspension is modest, but conversation-list
  queries must stay indexed (`@@index([userId, state])`, `@@index([lastMessageAt])`) and
  the list endpoint must not N+1 on participants. Verify the query plan before M2 adds
  filters.
- **Notification volume.** Every DM firing a `Notification` row could swamp the bell. M1
  notifies only on the first unread message in a thread (subsequent messages in an already
  unread thread do not add rows).
- **Blocked semantics are one-directional** in M1: blocking hides the thread and rejects
  sends, but does not prevent the blocked user creating a *new* conversation. A proper
  user-level block list is M2.
