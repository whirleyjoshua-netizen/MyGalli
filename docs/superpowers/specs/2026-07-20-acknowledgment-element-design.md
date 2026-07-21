# Acknowledgment Element — Design

**Date:** 2026-07-20
**Status:** Approved, ready for implementation planning

## Summary

A new `acknowledgment` canvas element that lets a page or community owner ask logged-in
visitors to confirm they have read and understood the information presented. The visitor
ticks a confirmation checkbox and presses a button; the system records who acknowledged and
when. The owner sees a count inline and, on Pro, the named roster with timestamps.

## Motivation

Every existing interactive element in Galli (`mcq`, `rating`, `poll`, `rsvp`, `comment`,
`shortanswer`, forms) captures an opinion or a choice. None captures a **receipt** — proof
that a specific person saw specific information at a specific time.

That receipt is what a coach posting new practice rules, a community owner changing an event
time, or a club admin publishing bylaws actually needs. The value is not the button; it is
the owner's roster.

`FormResponse` cannot serve this purpose: it is deliberately anonymous (`sessionId`, hashed
IP, no `userId`). Identity is the entire point of an acknowledgment, so this needs its own
storage.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Audience | Any logged-in Galli user | Works on public pages and Hub posts with no roster setup. Login gives a verified identity and timestamp. Signed-out visitors see a "Sign in to acknowledge" prompt. |
| Interaction | Checkbox + confirm | Must tick "I have read and understood this" before the button enables. One consistent behavior, no strictness setting — every acknowledgment in the system carries the same weight. |
| Surfaces | Canvas element + Hub post | `HubPost.blocks` already carries CanvasElement-shaped configs, so the same element renders in a community announcement with little extra work. |
| Owner visibility | Inline badge + Data tab | Inline count for a glance; Data tab element card for the full roster and export. |
| Who sees the roster | Owner only | Acknowledging is private between the visitor and the owner. No public list, no toggle. |
| Content changes | Owner-triggered reset | The owner judges whether a change is material and presses "Request re-acknowledgment." |
| Pricing | Free element, Pro reporting | Anyone can collect acknowledgments and see the count. Named roster, CSV export, and reset are Pro. |

**Accepted trade-off:** because the audience is "whoever is logged in" rather than a fixed
roster, the owner gets a roll (who acknowledged) but not a gap (who did not). If this later
lands inside a Hub, `HubMember` supplies the denominator — that is an upgrade, not a rewrite.

## Data model

Acknowledgments are never deleted. A reset supersedes prior records rather than erasing
them, preserving the audit trail that makes a receipt worth having.

```prisma
model Acknowledgment {
  id        String   @id @default(cuid())
  elementId String              // the acknowledgment element's id
  displayId String?             // page context; exactly one of displayId/hubPostId is set
  hubPostId String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  round     Int      @default(0)
  createdAt DateTime @default(now())

  @@unique([elementId, userId, round])
  @@index([elementId, round])
  @@index([userId])
}

model AcknowledgmentRound {
  elementId String   @id        // no row means round 0
  round     Int      @default(0)
  resetAt   DateTime @updatedAt
}
```

`round` lives in its own table rather than in the element's JSON config because bumping it
through the `Display.sections` blob would collide with the collaboration `version`/409 logic
for a change that is not really page content.

Migration is additive and hand-authored per the project convention (`migrate diff` against
the shared dev DB is contaminated; never `migrate dev`).

## The element

Added through the standard seven seams: `ElementType` union and `createElement()` defaults in
`src/lib/types/canvas.ts`, the editor/public component pair in `src/components/editor/elements/`,
`SlashCommandMenu.tsx`, `ColumnCanvas.tsx` `renderElement`, `elements/index.ts`, and
`render-elements.tsx`.

**Slash menu category:** Social / Engagement.

**Config fields on `CanvasElement`:**

- `ackStatement` — what the visitor is attesting to
- `ackConfirmLabel` — default "I have read and understood this"
- `ackButtonLabel` — default "Acknowledge"
- `ackDescription` — optional supporting text

**Public component states:**

1. Signed out — "Sign in to acknowledge," linking to login with a return URL
2. Signed in, not acknowledged at the current round — checkbox, button disabled until ticked
3. Acknowledged at the current round — "✓ You acknowledged this on Jul 20, 2026"
4. Acknowledged at an older round — "This was updated — please acknowledge again," form returns

**Owner view:** the owner viewing their own page sees an inline count badge and a
"View roster" link into the Data tab. The badge is owner-only and never renders for visitors.

## API

All routes live under `src/app/api/acknowledgments/`. Per the broken-main lesson, each
`route.ts` exports handlers only — shared helpers go in `src/lib/acknowledgment.ts`.

| Route | Auth | Behavior |
|---|---|---|
| `POST /api/acknowledgments` | Logged-in user | Body `{ elementId, displayId? , hubPostId? }`. Writes at the element's current round. Idempotent via the unique constraint — a repeat submit returns the existing record, not an error. |
| `GET /api/acknowledgments/[elementId]` | Public | Returns `{ count, round, mine }`. Adds the named `roster` only when the caller owns the element **and** is Pro. |
| `POST /api/acknowledgments/[elementId]/reset` | Owner + Pro | Increments the round, upserting `AcknowledgmentRound`. |
| `GET /api/acknowledgments/[elementId]/export` | Owner + Pro | CSV of the roster: name, username, acknowledged-at, round. |

**Ownership** resolves through `displayId` → `Display.userId`, or `hubPostId` → `HubPost.hub.userId`.
Pro is checked with the existing `isPro()` gate in `src/lib/plan.ts`.

**Rate limiting** on `POST /api/acknowledgments` via the existing `src/lib/rate-limit.ts`.

## Reporting and gating

New `AcknowledgmentCard.tsx` in `src/components/analytics/element-cards/`, registered in
that directory's `index.ts` and rendered by `ElementsTab.tsx` alongside the existing cards.

- **Free:** total count and acknowledgments over time, plus a Pro upsell for the roster.
- **Pro:** named roster with timestamps, CSV export, and the "Request re-acknowledgment"
  button. After a reset, the card shows a line such as "Reset on Jul 20 — 4 of 15 have
  re-acknowledged," comparing the current round against the previous one.

## Testing

Pure logic goes in `src/lib/acknowledgment.ts`, written test-first with no database access:

- `ackStatus(records, currentRound, userId)` → `'none' | 'current' | 'stale'`
- roster shaping (sort order, current-round filtering, previous-round comparison)
- CSV serialization, including escaping of names containing commas and quotes

API routes get integration tests covering:

- unauthenticated `POST` is rejected
- double submit is idempotent and does not create a second row
- a non-owner cannot read the roster
- a free owner gets the count but no roster
- reset increments the round and leaves prior records intact
- an acknowledgment made before a reset reports as `stale`

## Out of scope for v1

- Hub **file/item** attachment and the PDF-viewer surface (natural phase 2)
- Roster denominators / "who has not acknowledged"
- Per-acknowledgment notifications (noisy at real volume; a digest would be the better
  phase 2)
- Content snapshots stored per record
- Public or member-visible acknowledger lists
