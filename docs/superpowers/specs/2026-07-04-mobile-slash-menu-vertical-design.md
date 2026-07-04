# Mobile slash/element menu — vertical list — design

Date: 2026-07-04
Status: approved

## Problem

`SlashCommandMenu` (the "Add element" / slash menu) lays each category out as a
fixed-width column (`w-[210px]`) inside a horizontal-scroll row. On mobile that
horizontal, multi-column layout is awkward — you scroll sideways through columns.

## Goal

On mobile (`< md`) the menu should be a single **vertical list**: categories
stacked top-to-bottom, each with its header followed by its items, in one
vertical scroll. **Desktop (`md+`) is unchanged** — side-by-side columns.

## Approach

Keep the **same DOM**; switch layout with responsive Tailwind classes only. This
guarantees desktop is byte-identical (every desktop style is restated under a
`md:` prefix) and avoids rendering two copies of the list (which would duplicate
every element in the accessibility tree and break existing text-based tests).

Class changes (desktop behaviour restored via `md:`):

- Scroll container: base `overflow-y-auto overflow-x-hidden`, desktop
  `md:overflow-x-auto md:overflow-y-hidden`.
- Column row: base `flex flex-col divide-y`, desktop `md:flex-row md:h-full
  md:divide-x md:divide-y-0`.
- Each column: base `w-full`, desktop `md:w-[210px] md:flex-shrink-0 md:h-full`.

Category headers stay `sticky top-0` — on mobile that gives a pleasant sticky
category label while scrolling.

The footer keyboard hint (`↑↓←→ navigate…`) is hidden on mobile (`hidden
md:flex`) since touch has no arrow keys.

A `data-testid="element-grid"` is added to the column-row container so a test
can assert the responsive intent (mobile `flex-col`, desktop `md:flex-row`).

## Non-goals

- No change to commands, filtering, gating, keyboard nav, or desktop layout.
- Not converting to a bottom sheet — the existing positioned panel is kept.

## Testing

- Existing gating tests (App Card shown / hidden) continue to pass unchanged.
- New: the `element-grid` container carries `flex-col` (mobile) and
  `md:flex-row` (desktop) classes.

## Files touched

- `src/components/canvas/SlashCommandMenu.tsx` (layout classes + testid)
- `src/components/canvas/SlashCommandMenu.test.tsx` (+1 assertion)
