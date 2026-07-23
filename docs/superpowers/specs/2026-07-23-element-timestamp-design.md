# Element Timestamp ("stamp") — Design Spec

## Goal

Let a page author stamp an individual element with the current date and time. Stamping is a
deliberate user action; the value always comes from the server clock, never from user input.
A stamp can be removed and re-applied. Stamped elements show a small, muted date line beneath
them on the public page.

## Why

A page is often a record of things that happened — a photo from a game, a note from a call, a
result from a run. Today nothing on a page can say *when*. The only date on a MyGalli page is
the page-level "last updated" badge, which is automatic, page-wide, and answers a different
question.

## Current state (as of `0f420c0`)

- `CanvasElement` (`src/lib/types/canvas.ts:214`) is a flat interface covering ~40 element types.
  Every field on it is type-specific (`kpiLabel`, `buttonUrl`, `quoteAuthor`, …).
  **There is currently no cross-cutting per-element property.** This will be the first.
- `renderElement(element, displayId)` (`src/lib/render-elements.tsx:108`) is a single `switch`
  over element type and the one shared public render path. It is consumed by
  `src/app/[username]/[slug]/page.tsx`, `src/app/s/[code]/page.tsx`,
  `src/components/tabs/PublicTabView.tsx`, `src/components/profile/ProfileCanvas.tsx`, and
  `src/components/elements/PublicAppointmentsElement.tsx`.
- Elements are stored inside `Display.sections`, which is a **`Json` column**. Adding an optional
  field to an element object therefore requires **no migration**.
- The editor renders elements through `ColumnCanvas` (`src/components/canvas/ColumnCanvas.tsx`),
  which already exposes an `onUpdateElement` callback. Per-element settings live in the panel
  inspectors under `src/components/editor/panel/`.

### Relationship to the existing page-level "Last updated"

`Display.showLastUpdated` and `Display.contentUpdatedAt` already exist as real columns, toggled
by `LastUpdatedSettingsBody` and rendered as a `LastUpdatedBadge` in the page footer. That
feature is **automatic, page-scoped provenance**: "this page changed recently."

The element stamp is **manual, element-scoped, and editorial**: "I marked this at this moment."
They answer different questions and must not be conflated:

|  | Page "Last updated" | Element stamp |
|---|---|---|
| Scope | whole page | one element |
| Trigger | automatic on save | explicit user action |
| Meaning | freshness | a recorded moment |
| Storage | `Display` columns | field inside `sections` JSON |

**Naming rule:** never label the element feature "last updated" or "updated". It is a *stamp*.
Two date displays with different meanings will confuse people if the words overlap.

## Decisions (locked in brainstorm)

| Question | Decision |
|---|---|
| Is it an element? | **No.** It decorates an existing element. |
| Who triggers it? | The user, explicitly. Nothing is stamped automatically. |
| Who supplies the value? | **The server.** The user cannot choose or type a date. |
| Editable after the fact? | No. But it can be **removed**, and **re-stamped** (which takes a fresh server time). |
| Scope | **Elements only.** Not sections, not pages. |
| Placement | Beneath the element, caption-style, small and muted. |
| Timezone | Displayed in the **author's** timezone, captured at stamp time, so the value reads identically for every viewer. |

### Why the value must come from the server

The stated requirement is that the system supplies the time. If the browser sent
`new Date().toISOString()`, any user could stamp any element with any date by changing their
system clock or editing the request. That would make this a date picker wearing a disguise and
would silently break the feature's core promise. The server clock is the only implementation
that actually keeps it.

### Why the author's timezone is stored

A stamp records a moment. If only the instant were stored and each viewer rendered it locally,
a 7:30 PM stamp in New York would display as 12:30 AM *the following day* in London — the date
on the page would differ per viewer. Storing the author's IANA zone alongside the instant makes
the stamp say the same thing to everyone, which is what a stamp is for.

## Part A — Data

Two optional fields are added to `CanvasElement` in `src/lib/types/canvas.ts`:

```ts
  // Timestamp ("stamp") — set by the server when the author stamps this element.
  // Absent means unstamped. Never written from client-supplied time.
  stampedAt?: string   // ISO-8601 instant, UTC
  stampedTz?: string   // IANA zone of the author at stamp time, e.g. 'America/New_York'
```

Both live inside the existing `Display.sections` JSON. **No Prisma migration.**

Absence is the unstamped state — there is no separate boolean. Remove deletes both fields;
re-stamp overwrites both. A single nullable value cannot drift out of sync with a flag.

`stampedTz` is a display hint only. `stampedAt` remains the authoritative instant, so a missing
or unrecognised zone degrades to rendering in UTC rather than failing.

## Part B — Stamping endpoint

`POST /api/displays/[id]/elements/[elementId]/stamp` — applies a stamp
`DELETE /api/displays/[id]/elements/[elementId]/stamp` — removes it

Both authorise with the existing `canEdit(userId, ownerId, collaboratorIds)` helper from
`src/lib/collab.ts` — the same gate `PATCH /api/displays/[id]` uses for element content. **Not
owner-only:** a collaborator who can already edit an element's content must be able to stamp it,
or the feature is arbitrarily inconsistent with every other content action on the page. Stamping
is a content action, not a settings change, so it does not belong in the PATCH route's
owner-only field list.

Both mutate `Display.sections` server-side: locate the element by id across all sections and
columns, then set or delete its two fields.

`POST` accepts an optional body `{ tz }` carrying the author's IANA zone from
`Intl.DateTimeFormat().resolvedOptions().timeZone`. **`tz` is a display hint and is the only
client-supplied input.** It is validated against the runtime's known zones and ignored if
unrecognised. The instant itself is always `new Date()` on the server.

`POST` on an already-stamped element is a re-stamp: it overwrites with a fresh server time.
That is the intended path, not an error.

Responses: `200 { stampedAt, stampedTz }` on success, `401` unauthenticated, `404` when the
Display does not exist, when `canEdit` is false, or when the element id is not found.

**A failed `canEdit` returns `404`, not `403`** — matching `PATCH /api/displays/[id]`, which
answers `{ error: 'Display not found' }` for non-editors so that a stranger cannot use the
status code to confirm a display exists. Diverging here would make these endpoints an existence
oracle for every other display on the platform.

**The editor must save before stamping.** An element that exists only in unsaved editor state
has no server-side representation to stamp. The editor already autosaves, so in practice this
means the Stamp action awaits the pending save; if none is pending it acts immediately.

## Part C — Render

`renderElement` currently returns the result of a `switch` directly. Refactor:

- The existing switch body moves verbatim into a private `renderElementBody(element, displayId)`.
- `renderElement` becomes a thin wrapper: call `renderElementBody`, and when `element.stampedAt`
  is set, render an `<ElementStamp>` after it.

This is the whole reason not to make it an element: one wrapper covers all ~40 types with no
per-type work and no change to any element component.

`ElementStamp` (`src/components/elements/ElementStamp.tsx`) is presentational — it takes
`stampedAt` and `stampedTz` and renders one muted line, e.g. `March 3, 2026 · 7:30 PM`, in a
`<time dateTime={stampedAt}>` for machine readability. It performs no fetching and holds no
state.

Formatting uses `Intl.DateTimeFormat` with `timeZone: stampedTz`. It must produce identical
output on server and client — a mismatch is a React hydration error, and this component renders
inside server-rendered public pages.

## Part D — Editor

**Where the control lives: `src/components/editor/panel/ElementRow.tsx`, beside the
`<Inspector>` — not inside it.**

`ElementRow` is the collapsible per-element row in the editor panel. Its header carries the
element label and Delete; when expanded it renders the per-type inspector chosen by
`getInspector(element.type)`. The stamp control goes in that expanded area, **after** the
inspector, separated by a divider, so the row reads as "settings for this element type" followed
by "settings any element can have".

This placement is load-bearing, not cosmetic. Only four types have a custom inspector today
(`image`, `kpi`, `button`, `slideshow`); every other type falls back to `DefaultInspector`.
Putting the stamp control inside the inspectors would mean five copies immediately and an
unwritten rule that every future inspector must re-implement it — reintroducing exactly the
per-type duplication that Part C's single `renderElement` wrapper exists to avoid. `ElementRow`
wraps the type-specific inspector the same way `renderElement` wraps the type-specific switch.
One shared seam at each end.

**Behaviour.** Unstamped: a single **Stamp** button. Stamped: the formatted value rendered by
the same `ElementStamp` component used publicly, plus **Re-stamp** and **Remove**.

**Wiring.** `ElementRow` currently receives `onChange(updates: Partial<CanvasElement>)`, which
mutates local editor state. Stamping cannot go through `onChange` alone, because the value must
come from the server. `ElementRow` gains a `displayId` prop and calls the Part B endpoint, then
feeds the response into the existing `onChange`:

```ts
const res = await fetch(`/api/displays/${displayId}/elements/${element.id}/stamp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone }),
})
if (res.ok) onChange(await res.json())   // { stampedAt, stampedTz } straight from the server
```

Applying the server's response rather than a locally-guessed value keeps the editor's state
exactly equal to what was persisted — the client never invents a timestamp, even optimistically.
Remove calls `DELETE` and then `onChange({ stampedAt: undefined, stampedTz: undefined })`.

The stamp also renders on the canvas itself via the same `ElementStamp`, so the author sees what
a visitor sees.

Wording is "Stamp", never "Last updated" — see the naming rule above.

## Security invariants

1. The stamp instant is generated server-side. No code path writes a client-supplied time.
2. Only a caller for whom `canEdit` returns true — the owner or a collaborator — may stamp,
   re-stamp, or remove.
3. `tz` is the only client-supplied value; it is validated against known IANA zones and affects
   display only. It can never change the recorded instant.
4. The stamp endpoints modify only the two stamp fields of the addressed element. They must not
   rewrite unrelated element content — a stamp request is not a page save.

## Testing

Endpoint tests (mirroring the existing route-test pattern under `src/app/api/`):
- stamp by the owner writes `stampedAt`/`stampedTz` and returns them
- the written instant comes from server time, not from the request body
- an unknown or malformed `tz` is ignored, and the stamp still succeeds
- `POST` on an already-stamped element overwrites with a newer instant
- `DELETE` removes both fields
- a collaborator (not the owner) CAN stamp — this is the case most likely to be got wrong
- an unrelated signed-in user → `404` (not `403`); unauthenticated → `401`; unknown element
  id → `404`
- stamping does not alter any other element or any other field of the target element

Render tests:
- an element with `stampedAt` renders the stamp; one without renders nothing extra
- the same `stampedAt` with different `stampedTz` values renders different local times
- an unrecognised `stampedTz` falls back to UTC instead of throwing
- a stamped element of several different `type`s all render the stamp — proving the wrapper is
  genuinely type-independent

Component tests for the editor control, in `ElementRow`:
- Stamp appears when unstamped; Re-stamp and Remove appear when stamped
- the control renders for an element type that has NO custom inspector (falls back to
  `DefaultInspector`) and for one that HAS a custom inspector — proving it is genuinely
  independent of the inspector registry
- Stamp applies the server's returned `stampedAt`/`stampedTz` via `onChange`, and applies
  nothing when the request fails

## Out of scope

- Stamping sections or whole pages.
- Author-chosen or backdated timestamps. Deliberately excluded — it would defeat the feature.
- Relative display ("2 days ago"). The stamp shows an absolute date and time.
- Per-element display format options (12h/24h, date-only). One format to start.
- A left-gutter timeline layout. Revisit only if pages routinely carry many stamps; it wastes
  horizontal space when few do and needs a separate mobile layout.
- Any change to the existing page-level "Last updated" feature.

## Related

- `src/lib/render-elements.tsx` — the single shared render path this hooks into
- `src/components/editor/panel/LastUpdatedSettings.tsx` — the page-level feature this must not
  be confused with
- `src/lib/types/canvas.ts` — `CanvasElement`
