# RSVP Interactive Element

**Date:** 2026-07-03
**Status:** Foundation built (editor config deferred behind the settings-column redesign)

## Problem

Add a general-purpose, interactive **RSVP** element page owners can drop onto a
page. Guests respond without an account. Owners can optionally run it as a
**public board** ("who's bringing what" for a potluck) or a **private intake**
(data only in the owner's analytics). Examples: a public potluck park party, a
private baby-shower RSVP.

## Approach

Reuse the existing interactive-element architecture end-to-end. Responses store
in the shared `FormResponse` table (JSON keyed by element id) — **no DB
migration**. `wedding-rsvp` is the closest existing element and served as the
blueprint. The one net-new backend piece is a **privacy-gated public board
endpoint**, modeled on the Poll element's public aggregate GET.

## Owner config (flat props on `CanvasElement`)

- `rsvpSubject` — event subject / headline (always shown)
- `rsvpDeadline` — optional RSVP-by date
- `rsvpPlusOne` (toggle) — ask "how many additional guests (+1s)"
- `rsvpAllowNote` (toggle) — respondent can leave a note
- `rsvpItems: string[]` — preset **claimable** list (potluck); empty = none
- `rsvpPublicList` (toggle) — public board vs. private intake

Attendance is core to every RSVP (not configurable): **Going / Maybe / Can't**.

## Respondent submission

Public component collects: name (required), attendance, +1 count (if enabled and
coming), claimed items (if a list exists and coming), note (if enabled). Posts to
the shared `/api/forms/submit` as:

```
{ [elementId]: { type: 'rsvp', question: rsvpSubject,
  answer: { name, attending: 'going'|'maybe'|'cant', guests, items, note } } }
```

One submission per browser (localStorage guard), consistent with other elements.

## Public board (only when `rsvpPublicList`)

New `GET /api/displays/[id]/rsvp?elementId=`. Loads the display, finds the element,
and **returns roster + item board only if the page is published AND the element's
`rsvpPublicList` is true**; otherwise `{ public: false }`. Notes are stripped from
the public payload (owner-only). Counts heads as one per "going" guest plus their
+1s.

## Owner analytics

- `rsvp` added to `INTERACTIVE_TYPES`; `aggregateRSVP` reuses the shared
  `src/lib/rsvp.ts` helpers.
- `RSVPCard` shows Going/Maybe/Can't counts, total heads, the item board, notes,
  and a full guest table. Feeds the dashboard "Widget feedback" count automatically.
- `/responses` list + CSV now render structured (object) answers readably via a
  shared `formatResponseAnswer` helper (also fixes wedding-rsvp/business-review).

## Shared pure logic (unit-tested)

`src/lib/rsvp.ts`: `collectRsvpGuests`, `summarizeRsvp`, `buildItemBoard` — used by
both the public endpoint and the analytics aggregator so they never drift.
Tested in `src/lib/rsvp.test.ts` (normalization, head counting, item board).

## Files

Built now (redesign-independent):
1. `src/lib/types/canvas.ts` — type + config props + `createElement` case
2. `src/lib/rsvp.ts` (+ `.test.ts`) — pure aggregation
3. `src/lib/format-response.ts` — structured-answer formatter
4. `src/components/elements/PublicRSVPElement.tsx` — public form + board
5. `src/lib/render-elements.tsx` — import + case
6. `src/app/api/displays/[id]/rsvp/route.ts` — public board endpoint
7. `src/app/api/analytics/[displayId]/elements/route.ts` — allowlist + aggregateRSVP
8. `src/components/analytics/element-cards/RSVPCard.tsx` + barrel + `ElementsTab`
9. `src/app/(dashboard)/responses/page.tsx` — formatter in list + CSV

**Deferred** until the element settings-column redesign lands (to conform to the
new config UI, and to avoid colliding on those files):
- `src/components/elements/RSVPElement.tsx` — editor config panel
- `src/components/canvas/ColumnCanvas.tsx` — editor render case
- `src/components/canvas/SlashCommandMenu.tsx` — insert-menu entry

Until then the element cannot be inserted/edited via the UI, but the full data,
public-render, board, and analytics paths are live and can be exercised by seeding
an `rsvp` element into a page's `sections` JSON.

## v1 simplifications (approved)

1. Claimable items are **not hard-locked** — multiple guests can sign up for the
   same item; the board shows all names and marks untaken items "open".
2. **No editing an RSVP after submit** (one per browser).

## Verification

- `tsc --noEmit` clean; full suite 103/103 (incl. new `rsvp.test.ts`).
- End-to-end (public render → submit → board → analytics) to be exercised once the
  editor wiring lands, or by seeding an element into a published page's JSON.
