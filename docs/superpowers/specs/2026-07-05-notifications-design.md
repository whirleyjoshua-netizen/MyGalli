# In-app Notifications — v1 — design

Date: 2026-07-05
Status: draft (awaiting user review)

## Problem

The dashboard header has a Bell icon with a decorative unread dot
(`src/app/(dashboard)/dashboard/page.tsx:178-184`) but nothing behind it — no
notification model, API, or events. Users get no signal when someone follows
them, posts a bulletin, publishes a page, or comments on their page.

## Goal

Wire in-app notifications: a `Notification` model, server-side creation at four
event points, three API routes, and a working bell (badge + dropdown, polled).

## Scope

**In v1:** in-app only; four events (new follower, new bulletin, page published,
comment on your page); audience for fan-out events = the actor's followers.

**Out of v1 (deliberate):** email/push delivery, per-event preferences/mute,
real-time transport (polling is sufficient), and placing the bell anywhere beyond
the existing dashboard-home header stub.

## Data model

One additive Prisma model — no changes to existing tables, so the migration is a
single new table (safe on the live Neon DB).

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String   // recipient
  user        User     @relation("UserNotifications", fields: [userId], references: [id], onDelete: Cascade)
  type        String   // 'follow' | 'bulletin' | 'page_published' | 'comment'
  actorId     String?  // the causing user; null for anonymous commenters
  actorName   String   // denormalized display name (renders w/o a join; supports anonymous)
  actorAvatar String?  // denormalized avatar url
  entityUrl   String?  // click target: '/username', '/username/slug', '/bulletin'
  contextText String?  // optional secondary text (page title, etc.)
  read        Boolean  @default(false)
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([userId, read])
}
```

Add the back-relation `notifications Notification[] @relation("UserNotifications")`
to the `User` model. `actorId` intentionally has **no** relation/FK constraint to
keep deletes simple and because anonymous actors have no user row; the actor's
identity for display is fully denormalized (`actorName`/`actorAvatar`).

Message text is NOT stored — it is derived on render (see `formatNotification`),
so wording can change without a migration.

## Creation helper — `src/lib/notifications.ts`

```ts
type NotifyActor = { id: string | null; name: string; avatar?: string | null }

// Single insert (used by follow + comment).
createNotification(input: {
  userId: string; type: NotificationType; actor: NotifyActor;
  entityUrl?: string; contextText?: string;
}): Promise<void>

// Fan-out to the actor's followers (used by bulletin + page_published).
notifyFollowers(actorId: string, input: {
  type: NotificationType; actor: NotifyActor;
  entityUrl?: string; contextText?: string;
}): Promise<void>
```

`notifyFollowers` queries `db.follow.findMany({ where: { followingId: actorId },
select: { followerId: true } })` (the reverse of the bulletin-feed query at
`src/app/api/bulletin/feed/route.ts:18-23`), then `db.notification.createMany`
with one row per follower. No-op when there are zero followers. It never notifies
`actorId` itself (followers never include self). All creation calls are wrapped so
a notification failure never breaks the primary action (try/catch, log — the
comment/follow/publish still succeeds).

**Fan-out cost:** one `createMany` of N rows per event. Fine at current scale;
flagged as a future caveat (batch/queue) for high-follower accounts.

## Event hook points (all after the primary write)

| Event | File | Trigger | Recipient(s) | entityUrl / context |
|---|---|---|---|---|
| `follow` | `src/app/api/users/[username]/follow/route.ts` | after follow is **newly** created (pre-check `findUnique` so re-follows don't re-notify) | the followed user | `/{me.username}` |
| `bulletin` | `src/app/api/bulletin/route.ts` | after `bulletinPost.create` | author's followers | `/bulletin` |
| `page_published` | `src/app/api/displays/[id]/route.ts` (PATCH) | when `published` flips **false→true** | owner's followers | `/{owner.username}/{slug}`, contextText = title |
| `comment` | `src/app/api/displays/[id]/comments/route.ts` (POST) | after `comment.create` | display **owner** | `/{owner.username}/{slug}`, contextText = title; actor = `{ id: null, name: comment.authorName }` |

Notes:
- Follow route currently `upsert`s; add a `findUnique` before it and only notify
  when the follow did not already exist.
- Publish PATCH must read the prior `published` value (it already loads the
  display) to detect the false→true transition; only owner can publish.
- Comment POST currently loads the display; extend its select to include
  `slug` + `user.username` + `title` to build `entityUrl`/`contextText`, and
  notify the owner (even for moderation-pending comments).

## API routes (mirror `getUser` → 401 → JSON)

- `GET /api/notifications/unread-count` → `{ count: number }`. Lightweight; the
  poll target. `db.notification.count({ where: { userId: me.id, read: false } })`.
- `GET /api/notifications` → `{ notifications: Notification[] }`, newest first,
  `take: 30`.
- `POST /api/notifications/read` → marks all unread read for the user
  (`updateMany({ where: { userId: me.id, read: false }, data: { read: true } })`),
  returns `{ ok: true }`.

## Pure formatter — `formatNotification(n)` (testable, in `notifications.ts` or a sibling)

```
follow          → `${actorName} started following you`
bulletin        → `${actorName} posted a bulletin`
page_published  → `${actorName} published ${contextText ? '“'+contextText+'”' : 'a new page'}`
comment         → `${actorName} commented on ${contextText ? '“'+contextText+'”' : 'your page'}`
```

## UI — `src/components/dashboard/NotificationBell.tsx` (client)

Replaces the static Bell button in `dashboard/page.tsx`. Behavior:
- On mount, polls `GET /api/notifications/unread-count` every 45s (mirroring
  `PresenceBar`'s `setInterval`/cleanup at `src/components/editor/PresenceBar.tsx:12-32`),
  keeping an `unread` count; renders the existing violet dot + a numeric badge
  when `unread > 0`.
- On click: opens a dropdown, `GET /api/notifications`, renders rows (avatar or
  initial + `formatNotification` text + relative time, linking to `entityUrl`),
  and fires `POST /api/notifications/read` so the badge clears. Reuse an existing
  relative-time formatter if one exists (e.g. in the bulletin post card);
  otherwise a tiny local `timeAgo` helper.
- Empty state ("You're all caught up") when the list is empty.
- Backdrop-click / outside-click closes the dropdown (same pattern as the
  `SidebarContent` user menu).

The bell renders on the dashboard-home header, which is present on mobile too, so
mobile-home users see it as well.

## Testing

- `notifyFollowers`: fans out one row per follower, no-op on zero followers,
  correct `type`/`entityUrl`/denormalized actor (mock `db`).
- `formatNotification`: one assertion per `type`, including the contextText
  present/absent branches.
- Migration is additive (new table only); verify `prisma migrate diff
  --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma`
  is empty after adding the migration.

## Migration workflow

Follow the project convention (never `prisma migrate dev`): add the model to
`schema.prisma`, generate SQL via `prisma migrate diff --from-migrations
prisma/migrations --to-schema-datamodel prisma/schema.prisma --script` into a new
`prisma/migrations/<timestamp>_add_notifications/migration.sql`, then
`prisma generate`. The Vercel build runs `prisma migrate deploy`. (Set
`DATABASE_URL` inline for any command that needs the DB — machine env override
gotcha.)

## Files touched

New: `prisma/migrations/<ts>_add_notifications/migration.sql`,
`src/lib/notifications.ts` (+ test), 3 route files under `src/app/api/notifications/`,
`src/components/dashboard/NotificationBell.tsx` (+ maybe test).
Modified: `prisma/schema.prisma` (Notification model + User back-relation), the
four hook routes, `dashboard/page.tsx` (swap Bell stub for `NotificationBell`).
