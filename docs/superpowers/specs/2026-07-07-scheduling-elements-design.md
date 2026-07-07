# Scheduling Elements (Calendar · Appointments · Business-Hours badge)

**Date:** 2026-07-07
**Status:** Design approved — Phase 1 (Google Calendar sync deferred to a follow-up branch)
**Branch:** `worktree-scheduling-elements`

## Problem

Owners want three scheduling capabilities on their pages:

1. **Calendar** — mark/highlight specific days (events, availability notes) that visitors browse.
2. **Appointments** — a Calendly-style booking element: owner presents available times, visitors book a slot for a call/meeting and get a confirmation.
3. **Hours / Days of operation** — already shipped as the `business-hours` element; only enhancement wanted.

## Decisions (from brainstorming)

- **Appointments is stateful/real booking**, DB-backed, **Pro-gated**. Calendar + Business-Hours stay **free**.
- Availability is defined by **weekly recurring rules** ("Mon–Fri 9–5, 30-min slots"), not hand-opened slots.
- **Google Calendar sync is a Phase 2 follow-up branch.** Galli's DB is the source of truth for booking records regardless; Google sync (read busy-times, write-back events) layers on top later. This branch ships the full DB-backed engine so it is usable standalone.

---

## Element 1 — Calendar (`calendar`) · free · no DB

Pure element JSON, like `flowchart` — **no models, no API, no deps**.

**Fields on `CanvasElement`:**
- `calendarTitle?: string`
- `calendarSubtitle?: string`
- `calendarEvents?: CalendarEvent[]` where
  `CalendarEvent = { id: string; date: string /* 'YYYY-MM-DD' */; title: string; note?: string; color?: string }`

**Editor (`CalendarElement.tsx`):** month grid the owner navigates (prev/next month). Click a day → add/edit/remove events on that day (title, optional note, color swatch). A compact list of all events below the grid for quick editing. Marked days show a colored dot.

**Public (`PublicCalendarElement.tsx`):** read-only month grid, colored dots on marked days, click a day → popover listing that day's events (title + note). Below the grid, an "Upcoming" list of the next N future events. "Today" is highlighted using the visitor's local date.

**Category:** new slash-menu category **"Scheduling"** (groups calendar + appointments + business-hours). Must be added to `CATEGORY_ORDER` in `SlashCommandMenu.tsx`.

---

## Element 2 — Appointments (`appointments`) · Pro · DB-backed

### Config lives in element JSON (static, owner-authored — like live-feed config)

Flat props on `CanvasElement`:
- `apptTitle?: string` — meeting title ("30-min intro call")
- `apptDuration?: number` — slot length in minutes (default 30)
- `apptTimezone?: string` — IANA tz, e.g. `America/New_York` (default: owner picks; UI defaults to browser tz at insert)
- `apptWeeklyRules?: ApptRule[]` where `ApptRule = { day: 0..6 /* Sun..Sat */; start: 'HH:MM'; end: 'HH:MM' }` (multiple windows per day allowed)
- `apptBuffer?: number` — minutes of gap forced after each booking (default 0)
- `apptLeadTimeHours?: number` — minimum notice before a slot is bookable (default 12)
- `apptMaxDaysAhead?: number` — how far out visitors can book (default 30)
- `apptLocationType?: 'video' | 'phone' | 'in-person' | 'custom'`
- `apptLocationDetail?: string` — e.g. address, "I'll call you", or a note (the actual meeting link is NOT collected here in v1)
- `apptNoteLabel?: string` — optional prompt for the visitor's message

### Bookings live in the DB (dynamic, visitor-created)

New Prisma model:

```prisma
model Booking {
  id         String   @id @default(cuid())
  displayId  String
  elementId  String   // which appointments element on that page
  start      DateTime // UTC
  end        DateTime // UTC
  name       String
  email      String
  note       String?
  cancelToken String  @unique @default(cuid())
  createdAt  DateTime @default(now())

  display    Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)

  @@unique([elementId, start])   // hard double-booking guard at the DB level
  @@index([displayId])
  @@index([elementId, start])
}
```

Add `bookings Booking[]` back-relation to `Display`.

**Why a table, not `FormResponse` JSON (unlike RSVP):** we need (a) a DB-level uniqueness guard against double-booking, (b) a cancel lifecycle with a per-booking token, (c) time-range queries. JSON blobs can't do any of these safely.

**Cancellation = hard delete** in v1 (frees the slot immediately, which is the desired behavior). No `status` column; a cancelled booking simply ceases to exist. Cancellation history is **deferred**.

**No reconcile-on-save hook needed** (unlike live-feed) — Booking rows are created by visitors via the API, keyed by the `elementId` that already exists in the saved page JSON. The API resolves `elementId → displayId → owner` by loading the Display and finding the element (same technique as the RSVP public-board endpoint).

### Pure slot logic — `src/lib/appointments.ts` (unit-tested)

- `generateSlots(config, fromUTC, toUTC, nowUTC): Slot[]` — expand weekly rules into concrete `{ startUTC, endUTC }` slots within the window, honoring `apptDuration`, `apptBuffer`, `apptLeadTimeHours`, `apptMaxDaysAhead`, and `apptTimezone` (owner-tz wall-clock → UTC via `Intl.DateTimeFormat` offset calc — no heavy dep).
- `isSlotBookable(config, startUTC, nowUTC): boolean` — server-side validation that a requested slot is a real, in-window, lead-time-respecting slot (never trust the client).
- Timezone: v1 generates and **displays all times in the owner's tz** with an explicit label ("All times shown in America/New_York"). Converting to the visitor's tz is **deferred**.

### API (all under `src/app/api/appointments/`)

- `GET /api/appointments/[displayId]?elementId=&from=&to=` — **public**. Returns bookable slots for the window with each marked free/taken (taken = a confirmed Booking exists at that start). **No PII** — times only. Requires the display be published and the element be an `appointments` element. Rate-limited.
- `POST /api/appointments/[displayId]` — **public**. Body `{ elementId, startUTC, name, email, note? }`. Validates via `isSlotBookable`, then **transaction**: re-check no Booking at `(elementId, start)` and create (the `@@unique` is the final backstop → catch P2002 → 409 "slot just taken"). Sends two Resend emails (owner "New booking", visitor "Confirmed" with cancel link). Rate-limited hard (anti-spam).
- `POST /api/appointments/cancel/[token]` — **public via unguessable token**. Deletes the Booking, emails both parties the cancellation. Backed by a page `/appointments/cancel/[token]` for a friendly confirm UI.
- `GET /api/appointments/[displayId]/bookings?elementId=` — **owner-only** (`getUser` + `display.userId` check). Returns full upcoming bookings (with PII) so the editor can show an "Upcoming bookings" list.

Add `/appointments` to middleware `PROTECTED_PATHS`? **No** — the cancel page and API are intentionally public (token-gated). Nothing under `/appointments` needs auth-cookie protection; the owner-only route self-checks.

### Emails — `src/lib/email.ts`

Reuse the existing Resend + dev-console-fallback helper. Three new templated sends: booking-confirmed (visitor), booking-received (owner), booking-cancelled (both). Cancel link = `${APP_URL}/appointments/cancel/${cancelToken}`.

### Editor (`AppointmentsElement.tsx`) — Pro-gated

Owner configures: meeting title, duration, timezone, weekly rules (per-day windows), buffer, lead time, booking window, location type/detail, note label. Below config, an **"Upcoming bookings"** panel fetched from the owner-only bookings endpoint (only meaningful after the page is saved — show a "save your page to enable booking" hint like live-feed). Wrap the whole element in the `isPro` gate with an `UpgradePrompt` for free users (pattern from existing Pro elements).

### Public (`PublicAppointmentsElement.tsx`)

Two-step flow: (1) pick a day (month/week mini-calendar with available days enabled) → pick a time slot (fetched from the public GET, taken slots disabled); (2) enter name + email + optional note → submit to POST → success state with "You're booked for … — a confirmation was sent to your email" and the cancel link. Timezone label always visible. `localStorage` isn't used to block re-booking (a visitor may legitimately book multiple slots).

**Pro enforcement on the published page:** booking POST must verify the **owner** is Pro (`isPro(display.user)`) server-side — a free user who somehow has an appointments element in JSON cannot take live bookings. Public render shows a graceful "booking unavailable" if owner isn't Pro.

---

## Element 3 — Business-Hours "Open now" badge · free (enhancement)

- New pure helper `src/lib/business-hours.ts`: `isOpenNow(schedule, now): { open: boolean; nextChange?: string }`. Parses the existing `'9:00 AM'` strings against `now`. v1 uses the **visitor's local time** (documented limitation — a tz field is deferred).
- `PublicBusinessHoursElement.tsx` renders a green **"Open now"** / grey **"Closed"** pill next to the title, with a subtle "Opens 9:00 AM" / "Closes 5:00 PM" hint.
- Unit-tested (`business-hours.test.ts`): open mid-window, closed before/after, closed-all-day, boundary equality.

---

## Registration checklist (per element, from CLAUDE.md "Add an element type")

For `calendar` and `appointments`:
1. `src/lib/types/canvas.ts` — `ElementType` union + fields + `createElement()` defaults (single source).
2. `src/components/elements/{Calendar,Appointments}Element.tsx` (editor) + `Public*.tsx` (public).
3. `src/components/canvas/SlashCommandMenu.tsx` — insert entry + new **"Scheduling"** category in `CATEGORY_ORDER`.
4. `src/components/canvas/ColumnCanvas.tsx` — `renderElement` case (preview → Public, else editor).
5. `src/components/elements/index.ts` — barrel export.
6. `src/lib/render-elements.tsx` — case for the published page.

Plus for `appointments`: Prisma model + migration (via `migrate diff` → SQL → `migrate deploy`, never `migrate dev`), the API routes, `src/lib/appointments.ts` (+test), email templates, cancel page.

## Explicitly deferred

- **Google Calendar OAuth sync** (busy-time blocking + write-back) — Phase 2 branch.
- Visitor-timezone conversion (v1 shows owner tz).
- Cancellation history / reschedule (v1 cancel = delete).
- Recurring/blocked-date overrides (holidays), multiple appointment types per element, group bookings, payments/deposits.
- Calendar element: multi-day event spans, iCal export, recurring events.

## Risks

- **Timezone math** is the sharpest edge — owner-tz wall-clock → UTC without a heavy dep, using `Intl.DateTimeFormat` offset resolution. Fully covered by `appointments.test.ts` (DST boundary cases included).
- **Double-booking race** — mitigated by the `@@unique([elementId, start])` constraint as the authoritative backstop (transaction re-check is best-effort UX, the constraint is truth).

## Verification

- `tsc --noEmit` clean; full test suite green incl. new `appointments.test.ts` + `business-hours.test.ts`.
- End-to-end manual smoke: insert each element, publish, book a slot as a visitor (confirmation email in dev console), owner sees it in the editor list, cancel via token frees the slot.
