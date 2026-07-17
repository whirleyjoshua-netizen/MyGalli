# Wait List element — design (MVP)

**Date:** 2026-07-17
**Branch:** `waitlist-element` (off `main` @ `dda8508`)

## Purpose

Let a creator collect interest before something launches — a course, book, album,
beta, drop, community. A visitor sees a title, description, a launch date, a live
count of who's already waiting, and a Join button; they leave an email and get a
confirmation. The owner sees the collected list and can export it.

This is a **data-collection element**, the same family as the existing Form,
Booking, Mailbox, and Jersey-signature elements: a per-element submission table
plus a rate-limited public submit API, and an owner-side view in the Data tab.

## Scope

**In (MVP):**
- New free `waitlist` element.
- Two display styles: **Hero** and **Progress**.
- Email collection (+ optional name), persistent signups, dedup by email.
- Live "N people waiting" count.
- Countdown timer to a launch date.
- Capacity limit → progress bar → auto-close when full (server-enforced).
- Confirmation message after joining.
- Owner view of signups + CSV export (owner-only).

**Deferred to later phases (out of this spec):**
- Compact display style.
- Custom questions.
- "Open the doors" auto-email blast (Resend) when the list opens.
- Waiting Room social-proof profile bubbles.
- Portal integration — **Portal does not exist as an element yet.**

## Decisions (settled with the user)

| Question | Decision |
|---|---|
| Pricing | **Free** (drives adoption; advanced bits can be Pro later) |
| Signup identity | **Anonymous email**, dedup by email; capture `userId` if the visitor is logged in (forward-compat for the Waiting Room, no added friction) |
| Display styles in MVP | **Hero + Progress** |
| First shippable version | Phase 1 + countdown + capacity/progress |

## Data model

One new table:

```prisma
model WaitlistSignup {
  id        String   @id @default(cuid())
  displayId String
  display   Display  @relation(fields: [displayId], references: [id], onDelete: Cascade)
  elementId String   // which waitlist element on the page (a page may have several)
  email     String
  name      String?
  userId    String?  // captured only if the visitor is logged into Galli
  createdAt DateTime @default(now())

  @@unique([displayId, elementId, email]) // one email = one spot; re-submit is idempotent
  @@index([displayId, elementId])
}
```

`Display` gets the back-relation `waitlistSignups WaitlistSignup[]`.

Migration is hand-authored (per repo convention — `migrate diff --from-url` is
contaminated on the shared dev DB). Additive only.

## Element config (`CanvasElement` fields, on `src/lib/types/canvas.ts`)

`ElementType` gains `'waitlist'`. New optional fields (defaults set in
`createElement`):

| Field | Type | Default | Purpose |
|---|---|---|---|
| `waitlistTitle` | string | `'Join the Wait List'` | headline |
| `waitlistDescription` | string | `''` | blurb |
| `waitlistCoverImage` | string \| null | `null` | Hero cover |
| `waitlistStyle` | `'hero' \| 'progress'` | `'hero'` | layout |
| `waitlistButtonLabel` | string | `'Join Wait List'` | CTA text |
| `waitlistCollectName` | boolean | `false` | ask for a name too |
| `waitlistLaunchDate` | string \| null | `null` | ISO date; powers countdown + "Opens …" text |
| `waitlistShowCountdown` | boolean | `true` | show the countdown when a date is set |
| `waitlistCapacity` | number \| null | `null` | when set, enables progress bar + auto-close |
| `waitlistShowCount` | boolean | `true` | show "N waiting" |
| `waitlistConfirmationMessage` | string | `"You're on the list! 🎉"` | post-join message |

All config lives in the element JSON on `Display.sections` — no schema for config.

## Components

- **Editor** — `src/components/elements/WaitlistElement.tsx` (props `{element, onChange, onDelete, isSelected, onSelect}`): edits every config field above (style picker, cover upload via the existing `/api/upload`, launch-date picker, capacity, toggles, copy).
- **Public** — `src/components/elements/PublicWaitlistElement.tsx` (props `{element}`): renders Hero or Progress, the live countdown, the count/progress bar, the join form, and the confirmation / full states. Fetches its own count on mount and after a join (like `live-feed`).

Pure, testable helpers in `src/lib/waitlist.ts`:
- `spotsRemaining(count, capacity): number | null`
- `isFull(count, capacity): boolean`
- `progressPercent(count, capacity): number` (0–100, clamped)
- `waitlistCountdownParts(launchDate: string, now: Date)` → `{ days, hours,
  minutes, isPast }`. A **new local pure helper** — not a refactor of the existing
  `countdown` element (avoids coupling two elements' rendering; `now` is injected
  for deterministic tests).

## API

- **`POST /api/waitlist/join`** — body `{ displayId, elementId, email, name? }`.
  - Rate-limited (`prefix: 'waitlist-join'`), validates email shape.
  - Confirms the element exists on the display and is a `waitlist` (reads
    `Display.sections`), and reads its `capacity`.
  - **Capacity gate is server-enforced:** if `count >= capacity`, return
    `409 { error: 'Wait list full' }` — the client's disabled button is UX, this is
    the truth.
  - **Dedup:** `upsert` / catch the unique violation on `(displayId, elementId,
    email)` → existing signup returns `200` with the unchanged count, no new row.
  - Captures `userId` from the auth cookie if present (best-effort; anonymous is
    fine).
  - Returns `{ count }`.
- **`GET /api/waitlist/[displayId]/[elementId]/count`** — public; returns
  `{ count }`. Used for the live count on mount + after join.
- **`GET /api/waitlist/[displayId]/[elementId]/export`** — **owner-only** (the
  requester must own the display); returns the signups as CSV
  (`email,name,joinedAt`), `Content-Disposition: attachment`.

## Owner view

A `WaitlistCard.tsx` in `src/components/analytics/element-cards/` (registered in that
directory's `index.ts`), matching the existing card pattern (RSVPCard, PollCard, …):
shows the count, a table of signups (email / name / joined date), and a
"Download CSV" button hitting the export endpoint. The Data tab already renders a
card per collecting element; this adds the waitlist case.

## Capacity / auto-close semantics

- No capacity set → unlimited; no progress bar; button always enabled.
- Capacity set → Progress style shows `count / capacity` + bar. Hero shows the same
  slim bar under its count only when capacity is set. When `count >= capacity`:
  button disabled, label "Wait list full",
  and the API rejects further joins (`409`). A visitor already on the list still
  sees their confirmation.

## Countdown

Driven by `waitlistLaunchDate`. Shows days/hours/minutes remaining while future;
once past, shows the launch date as "Launched" / the date text rather than negative
values. Reuse the existing `countdown` element's date logic if cleanly extractable;
otherwise a small local pure helper with injected `now` for deterministic tests.

## The 7 element seams (integration checklist)

1. `ElementType` union + `CanvasElement` fields — `src/lib/types/canvas.ts`.
2. `createElement()` default case `'waitlist'` — same file (single source; no
   PageEditor edit).
3. `WaitlistElement.tsx` (editor) + `PublicWaitlistElement.tsx` (public).
4. `SlashCommandMenu.tsx` — add under the **Commerce** category.
5. `ColumnCanvas.tsx` `renderElement` — preview → Public, else editor.
6. `elements/index.ts` — export both.
7. `render-elements.tsx` — public render path (used by `[slug]`, share, hub).

## Testing

- **Pure** (`src/lib/waitlist.test.ts`): `spotsRemaining`, `isFull`,
  `progressPercent` (including clamp at/over capacity and null-capacity), countdown
  parts with injected `now` (future, at-zero, past).
- **API** (`src/app/api/waitlist/join/route.test.ts`):
  - a first signup persists and returns `count: 1`;
  - the **same email again** returns `200` with the same count and creates **no**
    second row (dedup — the load-bearing test);
  - at capacity, a new email returns `409` and does not insert;
  - `userId` is captured when an auth cookie is present, `null` when anonymous;
  - export endpoint returns `403` for a non-owner.
- **Public component** (`PublicWaitlistElement.test.tsx`): Hero vs Progress render;
  after a successful join the confirmation message shows and the form is gone; the
  full state disables the button.

## Out of scope / non-goals

- No email verification of signups (an email is collected as text; deliverability is
  a later concern with the auto-email phase).
- No editing/deleting individual signups from the UI in MVP (export + the unique
  constraint cover the need; owner can manage in a later phase).
- No per-signup notifications to the owner in MVP.
