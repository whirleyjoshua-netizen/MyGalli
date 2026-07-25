# Checklist Element — Design

**Date:** 2026-07-25
**Status:** Approved for planning

## Goal

A new page-builder element: an owner-managed checklist whose checked state is part of the published page. The owner adds items and ticks them off in the builder; visitors see the current state and a progress indicator (e.g. "7 of 10"). Think launch checklist, project roadmap, syllabus progress, wedding to-do.

## Why this shape (decision B of three)

Three checklist products were considered:

- **A. Static / viewer-local** — visitors tick boxes for themselves; nothing persists beyond their browser. Low value on a *publishing* platform: invisible to everyone else, gone on refresh.
- **B. Owner's live checklist** — the owner checks items; the checked state publishes. **Chosen.**
- **C. Collaborative** — every visitor's checks persist and aggregate. Most useful for group coordination, but needs a new DB table, a response API, and visitor-identity handling like `poll`/`mcq`.

B wins because it fits the publishing model (the page shows real status) at **zero backend cost**: completion is a boolean on each item, stored in the element JSON and saved through the same path every other element edit already uses. No migration, no API route, no response store. It is also the smallest of the three, and its data model already supports adding the A behaviour (visitor-local checks) later without change.

This is a **pure-JSON element**, exactly like `list`, `color-palette`, and `playlist`.

## Data shape

Added to `CanvasElement` in `src/lib/types/canvas.ts`, following the `playlistItems` array-of-objects precedent:

```ts
checklistTitle?: string
checklistItems?: { id: string; text: string; done: boolean }[]
checklistShowProgress?: boolean   // show the "X of Y" progress bar; default true
```

Item `id` is generated with the repo's existing convention (`Date.now().toString() + Math.random()...`), matching how other array-item elements mint ids. `done` is the entire persistence mechanism — flipping it in the builder is an ordinary element update.

Default (new `case 'checklist'` in the defaults switch):

```ts
case 'checklist':
  return {
    ...base,
    checklistTitle: 'Checklist',
    checklistItems: [
      { id: <genId>, text: 'First item', done: false },
    ],
    checklistShowProgress: true,
  }
```

## Progress math — pure helper

A DB-free, unit-tested helper so the count logic is testable without React:

```ts
// src/lib/checklist.ts
export function checklistProgress(items: { done: boolean }[]): { done: number; total: number; pct: number } {
  const total = items.length
  const done = items.filter((i) => i.done).length
  // 0 items ⇒ pct 0, never NaN. pct is 0–100, rounded.
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, pct }
}
```

Both the editor and the public component use this — one source of truth for "7 of 10 / 70%".

## Editor component — `ChecklistElement.tsx`

Models `ListElement`'s interaction, adapted for checkable rows:

- Editable **title** input.
- A column of rows; each row is `[checkbox] [text input] [✕ remove]`.
- **The checkbox is live in the builder** — clicking it flips `done` and the progress updates immediately. This is the core of decision B: the owner sees exactly what publishes.
- **Enter** in a text input appends a new empty item and focuses it (as `ListElement` does); **✕** removes the row.
- A **"+ Add item"** button.
- A toggle for **"Show progress bar"** (`checklistShowProgress`).
- Standard element chrome (selected state, delete) via the same props as `ColorPaletteElement`: `element`, `onChange`, `onDelete`, `isSelected`, `onSelect`.

All edits call `onChange` with the updated `checklistItems` / `checklistTitle` / `checklistShowProgress`, which persists through the existing element-save path. No new state store.

## Public component — `PublicChecklistElement.tsx`

Read-only status display:

- Title.
- If `checklistShowProgress` is not `false`, a progress bar with "X of Y" above the list, using `checklistProgress`.
- Each item: a ✓ (done) or ☐ (not done) marker and the text. Done items are visually de-emphasised (muted + strikethrough); not-done items are normal weight.
- No visitor interactivity in v1 — it is a published status, not a form. (Adding visitor-local checks later is a separate, additive change.)
- Empty list (`checklistItems` absent or `[]`) renders the title and a "No items yet" muted line, never a broken bar.

## Registration (the pure-JSON element footprint)

Mirrors `color-palette` exactly:

| File | Change |
|---|---|
| `src/lib/types/canvas.ts` | Add `'checklist'` to the `ElementType` union; add the three fields; add the `case 'checklist'` default. |
| `src/components/elements/ChecklistElement.tsx` | New editor component. |
| `src/components/elements/PublicChecklistElement.tsx` | New public component. |
| `src/components/elements/index.ts` | Export both. |
| `src/lib/checklist.ts` | New `checklistProgress` helper. |
| `src/components/canvas/SlashCommandMenu.tsx` | Add `{ id: 'checklist', label: 'Checklist', icon: ListChecks, description: 'Checkable to-do list with progress', category: 'Data & Visuals' }` (same category as `list`). |
| `src/components/canvas/ColumnCanvas.tsx` | Add `case 'checklist'`: `PublicChecklistElement` in `isPreviewMode`, else `ChecklistElement`. Import both. |
| `src/lib/render-elements.tsx` | Add `case 'checklist': return <PublicChecklistElement element={element} />`. Import it. |
| `src/lib/ai/validate.ts` | Add `'checklist'` to `VALID_ELEMENT_TYPES` so AI-generated pages may use it. |

Icon: `ListChecks` (lucide).

## Testing

**Unit**
- `checklistProgress`: `{done,total,pct}` correct for a mix; 0 items → `{0,0,0}` (no NaN); all done → 100; none done → 0.
- `canvas.ts` default for `checklist` produces a valid element with one item, `done: false`, `checklistShowProgress: true`.
- `PublicChecklistElement`: renders a distinct marker/'done' styling for done vs not-done items; shows "X of Y" when progress on; hides the bar when `checklistShowProgress === false`; empty items → "No items yet", no bar.
- `ChecklistElement`: clicking a checkbox calls `onChange` flipping that item's `done`; "+ Add item" appends; ✕ removes; the "Show progress bar" toggle flips `checklistShowProgress`.

**Browser smoke** (production build)
- Insert Checklist via the slash menu; add items; check some in the builder; the in-builder progress updates live.
- Publish; the public page shows the checked state, correct "X of Y", and de-emphasised done items.
- Toggling "Show progress bar" off hides the bar on the published page.

## Out of scope

- Visitor-side checking / persisted visitor state (decision A/C).
- Due dates, assignees, nested sub-items, reordering by drag.
- Per-item colours or icons.
