# Checklist Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An owner-managed checklist element whose checked state publishes with the page, plus an "X of Y" progress bar.

**Architecture:** A pure-JSON element, identical in shape to `color-palette`/`playlist`. Completion is a `done` boolean per item stored in element JSON and saved through the existing element-edit path — no DB, no API, no migration. One shared pure helper computes progress.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind, Vitest + Testing Library (`fireEvent` only — `@testing-library/user-event` is NOT installed).

**Spec:** `docs/superpowers/specs/2026-07-25-checklist-element-design.md`. Read it first.

## Global Constraints

- **Pure-JSON element only.** No new DB table, API route, or migration. `done` booleans live in the element JSON; flipping one is an ordinary `onChange`.
- **Progress math lives in one place** (`src/lib/checklist.ts`) and is used by both components — never inline the count.
- **Registration must be complete.** A new element type wired into some but not all of the switch statements renders as a blank or crashes on one surface. Task 6 greps to prove all sites are covered.
- Item ids use the repo convention: `` `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` ``.
- Tests: `JWT_SECRET` set, `--maxWorkers=2`, `fireEvent` not `user-event`.
- Browser smoke needs `next build && next start` (this worktree's symlinked `node_modules` breaks some client bundles under `next dev`).

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/checklist.ts` (create) | `checklistProgress` — pure, DB-free. |
| `src/lib/types/canvas.ts` (modify) | `'checklist'` in the union; three fields; the default case. |
| `src/components/elements/ChecklistElement.tsx` (create) | Editor component (live checkboxes). |
| `src/components/elements/PublicChecklistElement.tsx` (create) | Read-only public render. |
| `src/components/elements/index.ts` (modify) | Export both. |
| `src/components/canvas/SlashCommandMenu.tsx` (modify) | Slash entry. |
| `src/components/canvas/ColumnCanvas.tsx` (modify) | Editor/preview render case. |
| `src/lib/render-elements.tsx` (modify) | Public render case. |
| `src/lib/ai/validate.ts` (modify) | Allow the type in AI output. |

---

### Task 1: Progress helper

**Files:**
- Create: `src/lib/checklist.ts`
- Test: `src/lib/checklist.test.ts`

**Interfaces:**
- Produces: `export function checklistProgress(items: { done: boolean }[]): { done: number; total: number; pct: number }`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/checklist.test.ts
import { describe, it, expect } from 'vitest'
import { checklistProgress } from './checklist'

describe('checklistProgress', () => {
  it('counts done and total and rounds the percentage', () => {
    expect(checklistProgress([{ done: true }, { done: false }, { done: true }, { done: false }]))
      .toEqual({ done: 2, total: 4, pct: 50 })
  })

  it('returns zeros for an empty list without dividing by zero', () => {
    expect(checklistProgress([])).toEqual({ done: 0, total: 0, pct: 0 })
  })

  it('is 100 when everything is done', () => {
    expect(checklistProgress([{ done: true }, { done: true }])).toEqual({ done: 2, total: 2, pct: 100 })
  })

  it('is 0 when nothing is done', () => {
    expect(checklistProgress([{ done: false }, { done: false }])).toEqual({ done: 0, total: 2, pct: 0 })
  })

  it('rounds to the nearest whole percent', () => {
    // 1/3 = 33.33 → 33
    expect(checklistProgress([{ done: true }, { done: false }, { done: false }]).pct).toBe(33)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/checklist.test.ts`
Expected: FAIL — cannot resolve `./checklist`

- [ ] **Step 3: Implement**

```ts
// src/lib/checklist.ts
export function checklistProgress(items: { done: boolean }[]): { done: number; total: number; pct: number } {
  const total = items.length
  const done = items.filter((i) => i.done).length
  // 0 items ⇒ pct 0, never NaN.
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return { done, total, pct }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/checklist.test.ts`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/lib/checklist.ts src/lib/checklist.test.ts
git commit -m "feat(elements): checklist progress helper"
```

---

### Task 2: Type, fields, and default

**Files:**
- Modify: `src/lib/types/canvas.ts`
- Test: `src/lib/types/canvas.test.ts` (append; create if absent — check first with `ls`)

**Interfaces:**
- Produces: `'checklist'` in `ElementType`; `checklistTitle`, `checklistItems`, `checklistShowProgress` on `CanvasElement`; a `case 'checklist'` in the defaults factory.

- [ ] **Step 1: Write the failing test**

The defaults factory is `createElement(type: ElementType): CanvasElement` in `src/lib/types/canvas.ts` (verified). `canvas.test.ts` does not exist yet — create it.

```ts
// append to (or create) src/lib/types/canvas.test.ts
import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe('checklist default', () => {
  it('creates a checklist with one unchecked item and progress on', () => {
    const el = createElement('checklist')
    expect(el.type).toBe('checklist')
    expect(el.checklistTitle).toBe('Checklist')
    expect(el.checklistItems).toHaveLength(1)
    expect(el.checklistItems![0].done).toBe(false)
    expect(el.checklistItems![0].text.length).toBeGreaterThan(0)
    expect(el.checklistItems![0].id).toBeTruthy()
    expect(el.checklistShowProgress).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/types/canvas.test.ts`
Expected: FAIL — `'checklist'` not assignable / no such case.

- [ ] **Step 3: Add the union member**

In the `ElementType` union (near `| 'color-palette'`), add:

```ts
  | 'checklist'            // Owner-managed checkable list with progress
```

- [ ] **Step 4: Add the fields**

On `CanvasElement` (near `playlistItems`):

```ts
  checklistTitle?: string
  checklistItems?: { id: string; text: string; done: boolean }[]
  checklistShowProgress?: boolean
```

- [ ] **Step 5: Add the default case**

In the defaults factory switch (beside `case 'color-palette':`):

```ts
    case 'checklist':
      return {
        ...base,
        checklistTitle: 'Checklist',
        checklistItems: [
          { id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: 'First item', done: false },
        ],
        checklistShowProgress: true,
      }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/lib/types/canvas.test.ts && npx tsc --noEmit -p tsconfig.json`
Expected: PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/canvas.ts src/lib/types/canvas.test.ts
git commit -m "feat(elements): checklist type, fields, and default"
```

---

### Task 3: Public component

**Files:**
- Create: `src/components/elements/PublicChecklistElement.tsx`
- Test: `src/components/elements/PublicChecklistElement.test.tsx`

**Interfaces:**
- Consumes: `checklistProgress` (Task 1); `CanvasElement`.
- Produces: `export function PublicChecklistElement({ element }: { element: CanvasElement })`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/elements/PublicChecklistElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicChecklistElement } from './PublicChecklistElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'checklist',
  checklistTitle: 'Launch',
  checklistItems: [
    { id: 'a', text: 'Domain', done: true },
    { id: 'b', text: 'Copy', done: false },
  ],
  checklistShowProgress: true,
  ...over,
} as CanvasElement)

describe('PublicChecklistElement', () => {
  it('shows the title and every item', () => {
    render(<PublicChecklistElement element={el()} />)
    expect(screen.getByText('Launch')).toBeInTheDocument()
    expect(screen.getByText('Domain')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
  })

  it('marks done and not-done items differently', () => {
    render(<PublicChecklistElement element={el()} />)
    // done item carries a data flag the not-done one does not
    expect(screen.getByText('Domain').closest('[data-done]')).toHaveAttribute('data-done', 'true')
    expect(screen.getByText('Copy').closest('[data-done]')).toHaveAttribute('data-done', 'false')
  })

  it('shows the X of Y count when progress is on', () => {
    render(<PublicChecklistElement element={el()} />)
    expect(screen.getByText(/1 of 2/i)).toBeInTheDocument()
  })

  it('hides the progress bar when checklistShowProgress is false', () => {
    render(<PublicChecklistElement element={el({ checklistShowProgress: false })} />)
    expect(screen.queryByText(/of 2/i)).not.toBeInTheDocument()
  })

  it('renders an empty state, not a broken bar, when there are no items', () => {
    render(<PublicChecklistElement element={el({ checklistItems: [] })} />)
    expect(screen.getByText(/no items yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/of 0/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/elements/PublicChecklistElement.test.tsx`
Expected: FAIL — cannot resolve `./PublicChecklistElement`

- [ ] **Step 3: Implement**

```tsx
// src/components/elements/PublicChecklistElement.tsx
'use client'

import { Check } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { checklistProgress } from '@/lib/checklist'

export function PublicChecklistElement({ element }: { element: CanvasElement }) {
  const items = element.checklistItems ?? []
  const showProgress = element.checklistShowProgress !== false
  const { done, total, pct } = checklistProgress(items)

  return (
    <div className="w-full">
      {element.checklistTitle && (
        <h3 className="text-base font-semibold text-foreground mb-2">{element.checklistTitle}</h3>
      )}

      {showProgress && total > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>{done} of {total}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No items yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it) => (
            <li key={it.id} data-done={it.done} className="flex items-start gap-2.5 text-sm">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                it.done ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
              }`}>
                {it.done && <Check className="h-3 w-3" />}
              </span>
              <span className={it.done ? 'text-muted-foreground line-through' : 'text-foreground'}>{it.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/elements/PublicChecklistElement.test.tsx`
Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/PublicChecklistElement.tsx src/components/elements/PublicChecklistElement.test.tsx
git commit -m "feat(elements): public checklist render"
```

---

### Task 4: Editor component

**Files:**
- Create: `src/components/elements/ChecklistElement.tsx`
- Test: `src/components/elements/ChecklistElement.test.tsx`

**Interfaces:**
- Consumes: `CanvasElement`.
- Produces: `export function ChecklistElement({ element, onChange, onDelete, isSelected, onSelect }: Props)` — the same prop contract as `ColorPaletteElement` (`onChange: (updates: Partial<CanvasElement>) => void`).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/elements/ChecklistElement.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChecklistElement } from './ChecklistElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'e1', type: 'checklist',
  checklistTitle: 'Launch',
  checklistItems: [
    { id: 'a', text: 'Domain', done: false },
    { id: 'b', text: 'Copy', done: false },
  ],
  checklistShowProgress: true,
  ...over,
} as CanvasElement)

const props = (over: Partial<CanvasElement> = {}) => ({
  element: el(over), onChange: vi.fn(), onDelete: vi.fn(), isSelected: true, onSelect: vi.fn(),
})

describe('ChecklistElement', () => {
  it('toggles an item done when its checkbox is clicked', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /domain/i }))
    expect(p.onChange).toHaveBeenCalledWith({
      checklistItems: [
        { id: 'a', text: 'Domain', done: true },
        { id: 'b', text: 'Copy', done: false },
      ],
    })
  })

  it('adds an item', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getByRole('button', { name: /add item/i }))
    const arg = p.onChange.mock.calls[0][0].checklistItems
    expect(arg).toHaveLength(3)
    expect(arg[2]).toMatchObject({ done: false })
    expect(arg[2].id).toBeTruthy()
  })

  it('removes an item', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getAllByRole('button', { name: /remove item/i })[0])
    expect(p.onChange).toHaveBeenCalledWith({
      checklistItems: [{ id: 'b', text: 'Copy', done: false }],
    })
  })

  it('flips the show-progress toggle', () => {
    const p = props()
    render(<ChecklistElement {...p} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /show progress/i }))
    expect(p.onChange).toHaveBeenCalledWith({ checklistShowProgress: false })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/elements/ChecklistElement.test.tsx`
Expected: FAIL — cannot resolve `./ChecklistElement`

- [ ] **Step 3: Implement**

```tsx
// src/components/elements/ChecklistElement.tsx
'use client'

import { Plus, X, Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { checklistProgress } from '@/lib/checklist'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

type Item = { id: string; text: string; done: boolean }

export function ChecklistElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items: Item[] = element.checklistItems ?? []
  const showProgress = element.checklistShowProgress !== false
  const { done, total, pct } = checklistProgress(items)

  const setItems = (next: Item[]) => onChange({ checklistItems: next })
  const toggle = (i: number) => setItems(items.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it)))
  const setText = (i: number, text: string) => setItems(items.map((it, idx) => (idx === i ? { ...it, text } : it)))
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i))
  const add = () =>
    setItems([...items, { id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: '', done: false }])

  return (
    <div
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 ${isSelected ? 'border-primary/40 bg-muted/30' : 'border-border'}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <input
          aria-label="Checklist title"
          value={element.checklistTitle ?? ''}
          onChange={(e) => onChange({ checklistTitle: e.target.value })}
          placeholder="Checklist title"
          className="flex-1 bg-transparent text-base font-semibold outline-none"
        />
        <button onClick={onDelete} aria-label="Delete element" className="p-1.5 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {showProgress && total > 0 && (
        <div className="mb-2 text-xs text-muted-foreground">{done} of {total} · {pct}%</div>
      )}

      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={it.text || `item ${i + 1}`}
              checked={it.done}
              onChange={() => toggle(i)}
              className="h-4 w-4 accent-primary"
            />
            <input
              value={it.text}
              onChange={(e) => setText(i, e.target.value)}
              placeholder="Item text"
              className="flex-1 bg-transparent text-sm outline-none"
            />
            <button onClick={() => remove(i)} aria-label="Remove item" className="p-1 text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <button onClick={add} className="mt-2 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
        <Plus className="h-3.5 w-3.5" /> Add item
      </button>

      <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          aria-label="Show progress bar"
          checked={showProgress}
          onChange={(e) => onChange({ checklistShowProgress: e.target.checked })}
          className="h-3.5 w-3.5 accent-primary"
        />
        Show progress bar
      </label>
    </div>
  )
}
```

Note the test's checkbox `aria-label` for a row is the item text (`/domain/i`); the "Show progress" checkbox and the title input carry their own labels, so `getByRole('checkbox', { name: … })` is unambiguous.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && JWT_SECRET=test-secret npx vitest run src/components/elements/ChecklistElement.test.tsx`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/ChecklistElement.tsx src/components/elements/ChecklistElement.test.tsx
git commit -m "feat(elements): checklist editor with live checkboxes"
```

---

### Task 5: Register everywhere

**Files:**
- Modify: `src/components/elements/index.ts`
- Modify: `src/components/canvas/SlashCommandMenu.tsx`
- Modify: `src/components/canvas/ColumnCanvas.tsx`
- Modify: `src/lib/render-elements.tsx`
- Modify: `src/lib/ai/validate.ts`

**Interfaces:** none new — wiring only.

- [ ] **Step 1: Export from the barrel**

In `src/components/elements/index.ts`, beside the color-palette exports:

```ts
export { ChecklistElement } from './ChecklistElement'
export { PublicChecklistElement } from './PublicChecklistElement'
```

(Match the file's existing export style — if it re-exports differently, follow that.)

- [ ] **Step 2: Slash menu**

In `src/components/canvas/SlashCommandMenu.tsx`, import `ListChecks` from `lucide-react` and add near the `list` entry:

```ts
  { id: 'checklist', label: 'Checklist', icon: ListChecks, description: 'Checkable to-do list with progress', category: 'Data & Visuals' },
```

- [ ] **Step 3: Canvas render case**

In `src/components/canvas/ColumnCanvas.tsx`, import both components, then add beside `case 'color-palette':`:

```tsx
      case 'checklist':
        if (isPreviewMode) {
          return <PublicChecklistElement element={element} />
        }
        return (
          <ChecklistElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 4: Public render switch**

In `src/lib/render-elements.tsx`, import `PublicChecklistElement` and add:

```tsx
    case 'checklist':
      return <PublicChecklistElement element={element} />
```

- [ ] **Step 5: AI validator**

In `src/lib/ai/validate.ts`, add `'checklist'` to the `VALID_ELEMENT_TYPES` array.

- [ ] **Step 6: Verify wiring compiles**

Run: `cd /Users/jenniferjordan/joshwhirley/mg-hub-unified && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx src/lib/ai/validate.ts
git commit -m "feat(elements): register the checklist element"
```

---

### Task 6: Whole-feature verification

- [ ] **Step 1: Prove registration is complete**

```bash
cd /Users/jenniferjordan/joshwhirley/mg-hub-unified
# Every site that switches on element type must mention checklist. Compare
# the checklist hit-count against color-palette in the same files.
for f in src/lib/types/canvas.ts src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx src/components/canvas/SlashCommandMenu.tsx src/lib/ai/validate.ts src/components/elements/index.ts; do
  echo "$f: checklist=$(grep -c checklist "$f")  color-palette=$(grep -c 'color-palette\|ColorPalette' "$f")"
done
```
Expected: `checklist` ≥ 1 in every file. A 0 anywhere is a missed registration site.

- [ ] **Step 2: Static gates**

```bash
npx tsc --noEmit -p tsconfig.json                 # exit 0
npx next lint --dir src                            # 0 errors
JWT_SECRET=test-secret npx vitest run --maxWorkers=2
npx next build                                     # Compiled successfully
```

Note: `src/app/api/messages/upload/route.test.ts` fails on `main` already and is unrelated. Confirm it is the only failure; do not fix it here.

- [ ] **Step 3: Browser smoke** (production build — `next build && next start`)

- In the editor, open the slash menu, insert **Checklist**.
- Add a few items; check some boxes in the builder; confirm the in-builder count updates live.
- Publish (or preview); the public page shows checked items de-emphasised, correct "X of Y", progress bar filled to the right percent.
- Toggle "Show progress bar" off; the bar disappears on the published page.

- [ ] **Step 4: Ship**

Push the branch and open a PR against `main` for review — do **not** merge to `main` directly (harness/workflow constraint). Report the PR URL.
