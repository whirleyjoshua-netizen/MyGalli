# Community Hub M3a — Hub Events — Design

**Date:** 2026-07-18
**Status:** Approved (design)
**Base:** `main` @ `7f02118` (M1 + M2 live in prod). Branch `feat/community-m3a` (isolated worktree `.claude/worktrees/community-m3a`).
**Program spec:** `docs/superpowers/specs/2026-07-17-community-hub-builder-design.md` (M1–M4 roadmap). This is the first slice of **M3** (Widgets & Tools); M3a = Events. M3b (Utility Strip: Notes / Kollab-AI-slot / Tools) follows.

## Context & goal
The community page header shows an **Events** stat tile hard-coded to `0`, and the mockup's sidebar has an **Upcoming** events widget — but there is no event data. M3a adds hub-scoped events: owners create them, members are notified, and the public page shows an Upcoming widget + the real Events count. Events are **hub-only** (not a reusable page element) and **display-only** (no RSVP) for this slice.

### Decisions (confirmed with user)
- **Hub-only** `HubEvent` model (queryable; not a canvas element).
- **Display-only** (no RSVP/attendees this slice).
- **Notify members** on new-event create (reuse the existing community notification fan-out).
- "Manage events" is a modal reached from the builder's Layout & Sections (same pattern as Resources' "Manage files & links"); the Upcoming widget shows upcoming only, with past events under "View all".

## Reuse map (confirmed)
- **Notifications:** `notifyHubMembers` + `postNotifyTargets` (`src/lib/community.ts`, `src/lib/notifications.ts`); notification types + formatting in `src/lib/notifications-format.ts`. Existing community types: `hub_post`, `hub_comment`, `hub_member`. Add `hub_event`.
- **Access gates:** `canModerate` (owner||collaborator) for event writes; `collaboratorIds(hubId)` helper (as in posts route).
- **M2 config-driven sidebar:** `src/lib/types/hub-config.ts` (`HUB_SIDEBAR_KEYS = ['video','members','resources']`, `DEFAULT_HUB_CONFIG`), `sanitizeHubConfig` (appends missing widgets), and `src/components/hub/community/CommunitySidebar.tsx` (`widget(key)` switch). Events adds a new key.
- **Public page:** `src/app/[username]/hub/[slug]/page.tsx` community branch already fetches members/resources/counts and passes them to `CommunityHubView`; header stat tiles in `CommunityHeader`.
- **Builder:** `src/components/hub/builder/LayoutSectionsSection.tsx` renders the sidebar-widget list; `HubBuilderPreview` renders `CommunityHubView` with `preview` (no fetch).
- **Date conventions:** existing `CalendarEvent` uses `date: 'YYYY-MM-DD'` strings; `Booking`/`Appointments` use `DateTime`. `HubEvent` uses `DateTime` (`startsAt`) for reliable upcoming-sorting/filtering.

## Requirements

### R1 — `HubEvent` model (one additive migration)
```
model HubEvent {
  id          String   @id @default(cuid())
  hubId       String
  hub         Hub      @relation(fields: [hubId], references: [id], onDelete: Cascade)
  title       String
  startsAt    DateTime
  endsAt      DateTime?
  allDay      Boolean  @default(false)
  isOnline    Boolean  @default(false)
  location    String?          // venue text OR a join URL
  description String?
  createdAt   DateTime @default(now())
  @@index([hubId, startsAt])
}
// Hub: + hubEvents HubEvent[]
```
Additive; no backfill. Prod Neon-safe via `prisma migrate deploy`.

### R2 — Events API (`src/app/api/hubs/[id]/events/**`)
- `GET /api/hubs/[id]/events` — public. Default returns **upcoming** (`startsAt >= now`, asc); `?scope=all` returns all (past + upcoming) for the View-all modal / owner manager. Read-gated like the feed (community + `canViewCommunityHub(published, isPrivileged)`; drafts owner/collab-only). Returns serializable DTOs (`startsAt`/`endsAt` as ISO strings).
- `POST /api/hubs/[id]/events` — `canModerate` (owner/collaborator). Validates: `title` (required, ≤200), `startsAt` (valid ISO), optional `endsAt` (≥ startsAt), `isOnline`/`allDay` booleans, `location` (≤500), `description` (≤2000). Rate-limited. On success **notifies members** (`notifyHubMembers`, type `hub_event`, `entityUrl` = the hub's public URL, `contextText` = the hub title). Returns `{ id }` 201.
- `PATCH /api/hubs/[id]/events/[eventId]` — `canModerate`, IDOR-scoped (event must belong to the hub). Validates the same fields.
- `DELETE /api/hubs/[id]/events/[eventId]` — `canModerate`, IDOR-scoped.
- A pure helper `src/lib/hub-events.ts`: `validateEventInput(raw)` (coerce/validate → normalized fields or error) and `toEventDTO(row)` — unit-tested.

### R3 — Notifications
Add `hub_event` to the notification type union + `notifications-format.ts` (e.g. "posted a new event in {hub}"). Wire `notifyHubMembers` in the events POST (broadcast to members like an owner post; never self).

### R4 — Config: new `'events'` sidebar widget
- `HUB_SIDEBAR_KEYS` → `['video','members','events','resources']`; `DEFAULT_HUB_CONFIG.sidebar` → same order, all enabled (matches the mockup: Video, Members, Upcoming, Resources).
- `sanitizeHubConfig` already appends missing widgets enabled, so existing saved configs gain `'events'` automatically. **Update `hub-config.test.ts`** for the new key (default has 4 widgets; append-order assertions include `'events'`).
- No other config shape change.

### R5 — Public Upcoming widget + stat tile
- `CommunitySidebar.widget('events')`: an **"Upcoming"** section — the next N (e.g. 3) upcoming events, each: a date chip (month + day), title, time (or "All day"), and an **Online**/location badge; "View all" opens a modal listing all events (upcoming + past). **The widget hides entirely when there are no upcoming events** — consistent with how the Resources widget hides when empty. (Owners add events via the builder's Manage-events modal, not via the public widget, so hiding the empty public widget strands no one.)
- Server page (community branch): fetch `upcomingEvents` (top N) + `eventsCount` (upcoming count) and pass to `CommunityHubView` → `CommunitySidebar`; set `counts.events = eventsCount` (replaces the hard-coded `0`). In `preview` mode, pass empty events (no fetch), like members/resources.

### R6 — Builder: manage events
- `LayoutSectionsSection`: on the `'events'` widget row, add a small **"Manage"** action that opens `HubEventsModal`.
- `HubEventsModal` (`src/components/hub/builder/HubEventsModal.tsx`): lists the hub's events (via `GET ?scope=all`), an add/edit form (title, date, start time or all-day, optional end, Online toggle, location/URL, description), and delete — calling the events API. Owner-only surface (builder is owner-gated).

## Components (new / changed)
- **New:** `prisma` `HubEvent`; `src/lib/hub-events.ts` (+ test); `src/app/api/hubs/[id]/events/route.ts` (+ test) and `.../events/[eventId]/route.ts` (+ test); `src/components/hub/builder/HubEventsModal.tsx`.
- **Changed:** `prisma/schema.prisma`; `src/lib/types/hub-config.ts` + `src/lib/hub-config.ts` tests; `src/lib/notifications-format.ts` (+ type union wherever it lives); `src/components/hub/community/CommunitySidebar.tsx` (events widget) + `CommunityHubView.tsx`/`CommunityFeed`? (thread events props) ; `src/app/[username]/hub/[slug]/page.tsx` (fetch events + count); `src/components/hub/builder/LayoutSectionsSection.tsx` ("Manage" action).

## Verification
- **Unit:** `validateEventInput` (required/optional/bounds, endsAt≥startsAt, bad ISO → error); events `GET` (upcoming vs `scope=all`, read gate), `POST` (canModerate 403 for member, 201 + notify for owner), `PATCH`/`DELETE` (IDOR scope); `hub-config` tests updated for `'events'`.
- **E2E** (real login + fresh DB): owner creates an event → 201 + member notification row; `GET` upcoming returns it; public page Upcoming widget shows it + Events stat = 1; member `POST` event → 403; delete removes it.
- **Static:** `tsc --noEmit`, `next lint`, `pnpm test`.

## Non-goals (later)
RSVP/attendees, recurring events, calendar-grid view, event cover images, event reminders/ICS export, Kollab AI + Tools + Notes strip (M3b).
