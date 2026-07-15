# Workspaces — Sub-project B: Field-Type System (Design)

**Date:** 2026-07-14
**Status:** Approved design (lead-authored), pre-implementation
**Depends on:** A (foundation, live) + D (live KPI, live)

## Context
A shipped with Core-5 field types (text/number/date/choice/checkbox). B broadens the palette so a Workspace can model real data richly, which also feeds C (views) and D (KPIs aggregate the new numeric types).

## Scope (lead call)
Add **5 new field types**: `currency`, `percent`, `rating`, `url`, `email`. Deferred (their own later slice): tags/multi-select (array values), relationship/person (cross-record linking), formula, file.

| Type | Stored value | Config | Grid edit | Grid display | Aggregatable? |
|---|---|---|---|---|---|
| `currency` | number | `{ symbol?: string }` (default `$`) | number input | `$1,234.5` (symbol + thousands) | yes (sum/avg/min/max) |
| `percent` | number | — | number input | `95%` | yes |
| `rating` | number (0..max) | `{ max?: number }` (default 5) | interactive stars | filled/empty stars | yes |
| `url` | string | — | text input | clickable link (new tab, `safeHref`) | count only |
| `email` | string | — | text input | `mailto:` link | count only |

## Architecture

### Validator (`src/lib/workspace-validator.ts`)
Add 5 `switch` cases:
- `currency` / `percent`: coerce `Number(rawValue)`, throw "Must be a number" on NaN (same as `number`).
- `rating`: `Number(rawValue)`; NaN → throw; clamp to `0..max` (max from `config.max ?? 5`); round to integer.
- `url` / `email`: `String(rawValue)` (lenient — store as typed; no hard format rejection, so a work-in-progress value never blocks a save, consistent with soft-required). Display-side decides link safety.

### Pure formatter (`src/lib/workspaces/format-value.ts`, TDD)
`formatFieldValue(type: string, value: any, config?: any): string` — the single source of truth for grid display (and reusable by C later):
- `number` → `String(value)`; `currency` → `${symbol}${value.toLocaleString()}`; `percent` → `${value}%`; `rating` → e.g. `'★★★☆☆'` (or return the number for the cell to render stars — see cell note); `date` → locale date; `url`/`email`/`text`/`choice` → `String(value)`. Null/empty → `''`.
- Rating is special: the cell renders interactive stars, so `formatFieldValue` returns the numeric string for non-rating display contexts; the **cell** owns the star rendering.

### GridCell (`src/components/workspaces/cells/GridCell.tsx`)
Extend the existing dispatch:
- **Display mode** uses `formatFieldValue` for currency/percent, renders `url`/`email` as an anchor (`safeHref`, `target=_blank rel=noopener`; email → `mailto:`), and renders `rating` as star glyphs.
- **Edit mode**: `currency`/`percent` → `type=number` input (same path as number); `url`/`email` → `type=url`/`type=email` text input; `rating` → an inline row of clickable stars (click star N → commit N; click the current value → clear to null). Rating commits immediately on click (like checkbox — no separate edit mode).
- Reuse the existing commit/blur/Enter/Escape flow for the input-based types.

### ColumnEditorPopover (`src/components/workspaces/ColumnEditorPopover.tsx`)
- Add the 5 types to the `TYPES` list with friendly labels ("Currency", "Percent", "Rating", "Link", "Email").
- Config inputs: `currency` → a symbol text input (default `$`); `rating` → a max-stars number input (default 5, 1–10). Pack into `config`.

### D interop (`src/components/elements/WorkspaceKpiElement.tsx`)
The KPI field picker currently filters `f.type === 'number'`. Broaden to include the new numeric types: `['number','currency','percent','rating'].includes(f.type)`. `computeAggregate` already operates on numeric `data` values regardless of field type, and the aggregate endpoint only checks the field exists — so no backend change needed; KPIs immediately work over currency/percent/rating.

## Testing
- **Pure (Vitest):** validator — currency/percent coerce, rating clamp+round+NaN, url/email string passthrough. `formatFieldValue` — every type incl. currency symbol/thousands, percent, empty→''.
- **Component:** GridCell — rating stars commit on click, url/email render as safe anchors, currency/percent display formatted.
- **Verify:** tsc/lint/tests green; a workspace with one column of each new type edits + persists (DB smoke over the aggregate path for currency/rating optional).

## Out of scope
tags/multi-select, relationship/person, formula, file/media, AI. Per-type advanced formatting (currency decimals/locale, negative-number styling), and validation-hard-fail for url/email.

## Success criteria
In the grid: add a Currency, Percent, Rating, Link, and Email column; enter values; see them formatted (`$`, `%`, stars, clickable links); a KPI element can bind avg/sum to a currency/percent/rating field. tsc/lint/tests green.
