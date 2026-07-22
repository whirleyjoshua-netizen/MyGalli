# Workspaces — Manual Filter Builder (Design)

**Date:** 2026-07-22
**Status:** Approved design, pre-implementation
**Branch:** `feat/workspaces-filter-builder` (off `main`)
**Follows:** E (AI filter), F1 (operate: sort/search/pager) — both live on `main`

## Context

Workspaces can filter records, but only one way: open **Add view**, type a sentence
into "Describe what you want to see", and let `/api/workspaces/[id]/filter-suggest`
turn it into a `FilterSpec` with Claude. The AI filter spec anticipated the
weakness and named the fix:

> "**No manual fallback in v1.** If the model can't express a query, the user has
> no other way to build a filter. Accepted for v1; the manual builder is the first
> follow-up."

In practice the hole is larger than "no fallback", in two ways this design fixes:

1. **Without `ANTHROPIC_API_KEY`, filtering does not exist at all.** The route
   returns `"AI filtering is not configured. Set ANTHROPIC_API_KEY."` before doing
   any work (`filter-suggest/route.ts:46`). An operator who has not set that key —
   which is the current state of this project — has no path to a filtered view.
   A feature that is fully built and shipped is unreachable behind an unset env var.
2. **Filters cannot be edited.** A filter lives in `view.config.filter` and is only
   ever written when the view is *created* (`AddViewModal.tsx:53`). `FilterChips`
   offers an X that removes it, but nothing changes it. Adjusting one condition
   means deleting the view and rebuilding it from scratch.

The building blocks already exist and are good. `filter.ts` exports `allowedCmps`
(which comparators each field type may legally use), `validateFilter` (the trust
boundary that rejects invented fields and bad values), and `describeFilter` (the
plain-language chip rendering). This work is mostly a UI over primitives that are
already correct and already unit-tested.

## Scope

- A **Filter** button in the Workspaces toolbar opening a `FilterBuilder` popover
  that reads and writes the **active view's** filter. This closes both gaps at
  once: building a filter without AI, and editing one that already exists.
- Add the `is_empty` / `is_not_empty` comparators, deferred by E.
- Fix `neq` so it matches records whose field is empty.
- Make `contains` match literally instead of treating `%` and `_` as wildcards.
- Delete `filterToPrismaWhere`, now dead code.

The AI box in **Add view** stays exactly as it is. The two paths produce the same
`FilterSpec` and are complementary: describe it in words, then adjust it by hand.

**Out of scope:** nested boolean logic (`(A and B) or C`), `is any of` / multi-value
conditions, filters on public or shared pages, cross-workspace filters, saved filter
presets, per-column header filter chips.

## Decisions (locked)

- **Flat `and`/`or` only.** `FilterSpec` is `{ op, conditions[] }` with a single
  op across all conditions. The builder exposes exactly that and no more. Nested
  logic was deferred by E and stays deferred — it needs a `FilterSpec` change,
  which would ripple through validation, SQL generation and the AI's schema.
- **Apply persists immediately** to `view.config` via the existing
  `grid.updateView`. This matches the established precedent: the chip's X already
  persists a filter removal the moment it is clicked
  (`WorkspaceViews.tsx:99-102`). A filter is part of what a view *is*, not a
  transient lens over it — search already fills the transient role and is
  deliberately ephemeral.
- **Client-side validation is for feedback only.** `validateFilter` is pure and
  importable, so the builder runs it to show errors as you type. The server
  re-runs it on every read regardless (`query-view.ts`). The client call is never
  a trust boundary.

## The three behaviour fixes

These are not cosmetic. Each is a case where the current behaviour is defensible
while a model writes the filters and indefensible once a person builds them by hand.

### 1. `is_empty` / `is_not_empty` — the blocker has already dissolved

E deferred these for a specific, well-reasoned cause:

> "Emptiness over JSONB means disambiguating Prisma's `JsonNull` / `DbNull` /
> `AnyNull` against a missing key and an empty string. Our Prisma is mocked in unit
> tests, so a wrong `where` shape would pass every test and fail only at runtime —
> the plan would be specifying code it cannot verify."

That reasoning was sound and is now obsolete, because **F1 moved filter execution
off Prisma entirely**. Records are read through one parameterised raw SQL query
built by `buildRecordsQuery` (`records-query.ts`). Prisma's null trichotomy is no
longer in the path. In SQL the three cases collapse into one clause, because
`data->>'key'` yields SQL `NULL` for both a missing key and a JSON null:

```sql
-- is_empty:     missing key OR JSON null OR empty string
(data->>$1) IS NULL OR (data->>$1) = ''
-- is_not_empty: the exact negation
(data->>$1) IS NOT NULL AND (data->>$1) <> ''
```

`allowedCmps` grants these two to **every** field type — emptiness is meaningful
for text, numbers, dates, choices and checkboxes alike. `validateFilter` must skip
its value requirement for them, which is the one type change that ripples: the
`Condition.value` field becomes optional.

### 2. `neq` silently drops empty records

`conditionSql` currently emits (`records-query.ts:69`):

```sql
NOT ((data->>$1) = $2)
```

When the field is empty, `data->>$1` is `NULL`, so `NULL = 'Done'` is `NULL`,
`NOT NULL` is `NULL`, and Postgres excludes the row. **"Status is not Done" today
hides every record with no Status.** That is three-valued logic behaving exactly
as specified and not at all as anyone expects.

It becomes:

```sql
((data->>$1) IS NULL OR NOT ((data->>$1) = $2))
```

This matches Airtable and Notion, and matches what "is not Done" means in English:
a record with no status is certainly not Done. It **changes the results of existing
saved filters** that use `neq` — deliberately, because those results are currently
wrong. The numeric variant gets the same treatment around its `::numeric` cast.

### 3. `contains` leaks SQL wildcards into a text box

`contains` deliberately does not escape `%` or `_` (`records-query.ts:70-72`), to
mirror Prisma's `string_contains` from E. Harmless when a model writes the value;
actively wrong when a person types `50%` into a text input and silently gets
"starts with 50" instead of a literal match. `escapeLike` already exists in the
module for exactly this purpose and is already applied to the search term
(`records-query.ts:42`); `contains` is the one place it was left off.

`contains` will use it. Anyone relying on wildcard `contains` loses that; the
feature is days old and undocumented, so the realistic blast radius is zero.

## Architecture

### `src/lib/workspaces/filter.ts`

- `Cmp` gains `'is_empty' | 'is_not_empty'`.
- `Condition.value` becomes optional (`value?: string | number | boolean`).
- `allowedCmps` appends both to every type's list, including types that currently
  return `[]`.
- `validateFilter` skips `coerce` for the two value-less comparators and strips any
  value the caller sent, so a stray value can never reach the SQL builder.
- `CMP_WORDS` gains `is_empty: 'is empty'`, `is_not_empty: 'is not empty'`, so
  `describeFilter` renders "Due date is empty" with no trailing value.
- `filterToPrismaWhere` and `conditionToPrisma` are **deleted** along with their
  tests. Nothing imports them since F1; keeping a second, subtly different
  translation of the same spec is a correctness trap.

### `src/lib/workspaces/records-query.ts`

`conditionSql` gains the two cases above and the `neq` and `contains` fixes.
Everything stays parameterised — field keys and values continue to go through the
`p()` binder, preserving the injection guarantee that `records-query.test.ts`
already asserts.

### `src/lib/workspaces/filter-schema.ts`

`ALL_CMPS` gains both comparators so the AI can emit them too. The manual builder
and the model then share one comparator vocabulary rather than drifting apart, and
"show me records missing a due date" starts working on the AI path as a side effect.

### `src/components/workspaces/FilterBuilder.tsx` (new)

A popover anchored to the toolbar button. Props:

```ts
{
  fields: GridField[]
  value: FilterSpec | null
  onApply: (next: FilterSpec | null) => void
  onClose: () => void
}
```

It holds a **draft** spec in local state; nothing escapes until Apply. Each row is
`[field ▾] [comparator ▾] [value]`:

- The comparator dropdown is populated from `allowedCmps(field.type)`, so an
  illegal field/comparator pair is unrepresentable in the UI rather than merely
  rejected after the fact.
- Changing the field resets the comparator if the old one is not legal for the new
  type, and clears the value.
- The value control is typed by field: `choice` renders a `<select>` of its
  configured options, `checkbox` a true/false select, `date` a `type=date` input
  (which yields the `YYYY-MM-DD` form `coerce` demands), numerics a `type=number`,
  everything else a text input.
- Picking `is_empty` / `is_not_empty` **hides the value control** entirely.
- A single `and`/`or` toggle sits above the rows, shown only when there are ≥2.
- Removing the last row and applying clears the filter.

The component is presentational — it fetches nothing and knows nothing about views
or the grid. That keeps it directly testable and lets `AddViewModal` adopt it later
without change.

### `src/components/workspaces/WorkspaceViews.tsx`

A **Filter** button beside the search box, showing the active condition count when
non-zero. Apply writes through the existing view-update path:

```
grid.updateView(active.id, { ...active.config, filter })   // or omit `filter` to clear
```

which already triggers the refetch, so `FilterChips` and the "N matching" count
update with no new plumbing. This mirrors the removal path already in the file.

## Data flow

```
FilterBuilder (draft state)
   │  Apply
   ▼
validateFilter(draft, fields)      ← pure; throws FilterError with a human message
   │  ok
   ▼
grid.updateView(viewId, config)    ← persists to WorkspaceView.config
   │
   ▼
GET records → query-view.ts → validateFilter (again, authoritative)
                            → buildRecordsQuery → parameterised SQL
   │
   ▼
FilterChips (describeFilter) + total count
```

## Error handling

`validateFilter` already throws `FilterError` with messages written for humans —
`"Due date needs a date in YYYY-MM-DD form, got: 07/01/2026"`, `"\"x\" is not an
option for \"Status\""`. The builder catches it and renders the message inline
beneath the offending row, with Apply disabled while the draft is invalid. Reusing
those strings means the manual and AI paths report identical problems in identical
words.

The stale-filter warning already in `WorkspaceViews` (shown when a saved filter
references a deleted column) is unchanged; opening the builder on such a view shows
the rows it can still resolve and flags the rest.

## Testing

**Pure unit — `filter.ts`:** `allowedCmps` includes the new pair for every type;
`validateFilter` accepts a value-less `is_empty`, strips a supplied value, and still
rejects unknown fields and illegal comparators; `describeFilter` renders "is empty"
with no trailing value.

**Pure unit — `records-query.ts`:** emitted SQL for `is_empty`/`is_not_empty`; `neq`
includes the `IS NULL` disjunct; `contains` escapes `%` and `_`; the existing
injection assertions still hold with the new branches.

**Component — `FilterBuilder`:** the comparator list narrows by field type; the
value control disappears for the empty comparators; changing field resets an
now-illegal comparator; Apply emits the expected `FilterSpec`; clearing all rows
emits `null`.

**Live-DB verification (required, not deferred).** This is the assertion E was
waiting on, so it must actually be run rather than reasoned about. Against the local
Postgres, seed one workspace with four records covering all four states — key
absent, JSON `null`, empty string `""`, and populated — then record real row counts
for `is_empty`, `is_not_empty`, and `neq`. This follows F1's own precedent, where
`ORDER BY (data->>'gpa')::numeric DESC` was verified empirically against the dev DB
rather than assumed. Findings get written into the implementation plan.

**Browser smoke:** on a workspace with data — open Filter, build "Status is Done",
Apply, confirm chip + count; add a second condition and toggle and/or; switch to
`is_empty` and confirm the value box disappears and results are right; reload and
confirm the filter persisted to the view; remove all rows and confirm the view
returns to unfiltered.

## Verification

`pnpm exec tsc --noEmit`, `pnpm exec next lint`, and `pnpm exec vitest run` all
green; the live-DB numbers recorded; the browser smoke checklist passed. Note the
suite has one pre-existing unrelated failure on Node 24
(`api/messages/upload` — `request.formData()` throws on a File under undici), so the
baseline is "1 failed, rest passing".

## Out of scope (follow-ups)

- Nested boolean logic `(A and B) or C` — needs a `FilterSpec` shape change.
- `is any of` for choice fields — same.
- Reusing `FilterBuilder` inside `AddViewModal` beside the AI box. Deliberately
  deferred: the component is built context-free so this is a later drop-in, and
  keeping the create-view flow untouched keeps this slice reviewable.
- Filters on public/shared pages; cross-workspace filters; saved filter presets.
- `/api/generate` is pinned to the stale model `claude-sonnet-4-20250514` while
  `filter-suggest` uses a current one. Unrelated to filtering, still worth its own
  cleanup.
