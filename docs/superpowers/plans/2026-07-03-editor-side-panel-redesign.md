# Editor Side-Panel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's modal-heavy chrome with a persistent, collapsible right-docked control panel (Figma/Framer-style) that hosts element settings, page settings, and all future advanced/Pro depth.

**Architecture:** Lift element selection out of `ColumnCanvas` into `PageEditor` so the canvas and a new `ControlPanel` stay in sync. The panel has two tabs — **Elements** (a section-grouped layers list with single-open accordion inspectors) and **Page** (background/spacing/tabs/header, moved out of the top toolbar). Per-element settings are looked up through an **inspector registry** so elements migrate one at a time; a `DefaultInspector` keeps every un-migrated type functional. The canvas keeps its inline content editing unchanged — only *where configuration lives* moves.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind · lucide-react · @dnd-kit · Vitest 4 + @testing-library/react + jsdom.

## Global Constraints

- Package manager is **pnpm**. Tests run with `pnpm test` (`vitest run`); a single file with `pnpm test -- src/path/to/file.test.tsx`.
- Test files live beside source or under `src/__tests__/`; config `vitest.config.ts` includes `src/**/*.test.{ts,tsx}`, env `jsdom`, globals on, setup `src/__tests__/setup.ts`, alias `@` → `src`.
- Windows gotcha: never run `pnpm build` while `pnpm dev` is running (races `.next`). Verify with `pnpm test` and `npx tsc --noEmit`, not `build`.
- Brand green primary is `#39D98A`; use existing semantic Tailwind tokens (`bg-background`, `border-border`, `text-muted-foreground`, `bg-muted`, `text-primary`, etc.) — do **not** hardcode theme colors.
- Pro gating uses `isPro(user)` from `src/lib/plan.ts` and `UpgradePrompt` from `src/components/pro/UpgradePrompt.tsx`.
- Preserve all existing behavior: inline content editing, slash-menu adding, dnd reordering, 5s autosave, collaboration/presence, publish, preview.
- Commit after every task with the message shown in its final step.

---

## File Structure

**New files**
- `src/lib/editor/selection.ts` — `EditorSelection` type + helpers.
- `src/lib/editor/element-list.ts` — `buildElementList()` + label/type helpers (pure, unit-tested).
- `src/components/editor/panel/ControlPanel.tsx` — panel shell: collapse state + Elements/Page tabs.
- `src/components/editor/panel/ElementsTab.tsx` — section-grouped list + accordion + "+ Add element".
- `src/components/editor/panel/PageTab.tsx` — hosts background/spacing/tabs/header inline.
- `src/components/editor/panel/SectionRow.tsx` — section group header (label + ⚙) + its element rows.
- `src/components/editor/panel/ElementRow.tsx` — one list row; expands to its inspector (accordion).
- `src/components/editor/panel/inspectors/registry.tsx` — `ELEMENT_INSPECTORS` map + `getInspector()`.
- `src/components/editor/panel/inspectors/DefaultInspector.tsx` — fallback inspector.
- `src/components/editor/panel/inspectors/ImageInspector.tsx`, `KPIInspector.tsx`, `ButtonInspector.tsx`, `SlideshowInspector.tsx` — starter inspectors.
- `*.test.tsx`/`*.test.ts` beside each new unit.

**Modified files**
- `src/components/canvas/ColumnCanvas.tsx` — selection becomes props (lifted).
- `src/components/editor/PageEditor.tsx` — owns selection, renders `ControlPanel`, flex reflow layout, slimmed top bar.
- `src/components/canvas/BackgroundSettings.tsx`, `SpacingSettings.tsx`, `ColumnStyleSettings.tsx`, `src/components/header/HeaderCardEditor.tsx`, `src/components/tabs/TabEditor.tsx` — extract inline `*Body` components.

---

## Task 1: Selection model + helpers

**Files:**
- Create: `src/lib/editor/selection.ts`
- Test: `src/lib/editor/selection.test.ts`

**Interfaces:**
- Produces: `type EditorSelection`, `isElementSelected(sel, elementId): boolean`, `selectedElementId(sel): string | null`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/editor/selection.test.ts
import { describe, it, expect } from 'vitest'
import { isElementSelected, selectedElementId, type EditorSelection } from './selection'

describe('selection helpers', () => {
  const elSel: EditorSelection = { kind: 'element', sectionId: 's1', columnId: 'c1', elementId: 'e1' }

  it('selectedElementId returns the id for an element selection', () => {
    expect(selectedElementId(elSel)).toBe('e1')
  })
  it('selectedElementId returns null for a section or empty selection', () => {
    expect(selectedElementId({ kind: 'section', sectionId: 's1' })).toBeNull()
    expect(selectedElementId(null)).toBeNull()
  })
  it('isElementSelected matches only the selected element id', () => {
    expect(isElementSelected(elSel, 'e1')).toBe(true)
    expect(isElementSelected(elSel, 'e2')).toBe(false)
    expect(isElementSelected(null, 'e1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/editor/selection.test.ts`
Expected: FAIL — cannot resolve `./selection`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/editor/selection.ts
export type EditorSelection =
  | { kind: 'element'; sectionId: string; columnId: string; elementId: string }
  | { kind: 'section'; sectionId: string }
  | null

export function selectedElementId(sel: EditorSelection): string | null {
  return sel && sel.kind === 'element' ? sel.elementId : null
}

export function isElementSelected(sel: EditorSelection, elementId: string): boolean {
  return selectedElementId(sel) === elementId
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/editor/selection.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/selection.ts src/lib/editor/selection.test.ts
git commit -m "feat(editor): add EditorSelection model + helpers"
```

---

## Task 2: Element-list builder (section-grouped rows)

**Files:**
- Create: `src/lib/editor/element-list.ts`
- Test: `src/lib/editor/element-list.test.ts`

**Interfaces:**
- Consumes: `Section`, `CanvasElement`, `LayoutMode` from `@/lib/types/canvas`.
- Produces:
  - `interface ElementListRow { sectionId: string; columnId: string; element: CanvasElement }`
  - `interface ElementListGroup { sectionId: string; layout: LayoutMode; index: number; rows: ElementListRow[] }`
  - `buildElementList(sections: Section[]): ElementListGroup[]`
  - `elementTypeLabel(type: ElementType): string`
  - `elementRowLabel(element: CanvasElement): string`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/editor/element-list.test.ts
import { describe, it, expect } from 'vitest'
import { buildElementList, elementTypeLabel, elementRowLabel } from './element-list'
import type { Section } from '@/lib/types/canvas'

const sections: Section[] = [
  {
    id: 's1', layout: 'full-width',
    columns: [{ id: 'c1', elements: [
      { id: 'e1', type: 'heading', content: 'Welcome' },
      { id: 'e2', type: 'image', url: 'https://x/hero.jpg' },
    ] }],
  },
  {
    id: 's2', layout: 'two-column',
    columns: [
      { id: 'c2', elements: [{ id: 'e3', type: 'kpi', kpiLabel: 'Revenue' }] },
      { id: 'c3', elements: [{ id: 'e4', type: 'button', buttonText: 'Buy' }] },
    ],
  },
]

describe('buildElementList', () => {
  it('groups elements by section with a 1-based index and layout', () => {
    const groups = buildElementList(sections)
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ sectionId: 's1', layout: 'full-width', index: 1 })
    expect(groups[1]).toMatchObject({ sectionId: 's2', layout: 'two-column', index: 2 })
  })
  it('flattens columns into rows in column then element order, carrying columnId', () => {
    const groups = buildElementList(sections)
    expect(groups[0].rows.map(r => r.element.id)).toEqual(['e1', 'e2'])
    expect(groups[1].rows.map(r => r.element.id)).toEqual(['e3', 'e4'])
    expect(groups[1].rows[0]).toMatchObject({ sectionId: 's2', columnId: 'c2' })
    expect(groups[1].rows[1]).toMatchObject({ sectionId: 's2', columnId: 'c3' })
  })
})

describe('labels', () => {
  it('elementTypeLabel gives a human name', () => {
    expect(elementTypeLabel('image')).toBe('Image')
    expect(elementTypeLabel('kpi')).toBe('KPI')
    expect(elementTypeLabel('wedding-rsvp')).toBe('Wedding RSVP')
  })
  it('elementRowLabel appends a content hint when present', () => {
    expect(elementRowLabel({ id: 'e', type: 'heading', content: 'Welcome' })).toBe('Heading — Welcome')
    expect(elementRowLabel({ id: 'e', type: 'kpi', kpiLabel: 'Revenue' })).toBe('KPI — Revenue')
    expect(elementRowLabel({ id: 'e', type: 'image' })).toBe('Image')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/editor/element-list.test.ts`
Expected: FAIL — cannot resolve `./element-list`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/editor/element-list.ts
import type { Section, CanvasElement, LayoutMode, ElementType } from '@/lib/types/canvas'

export interface ElementListRow {
  sectionId: string
  columnId: string
  element: CanvasElement
}

export interface ElementListGroup {
  sectionId: string
  layout: LayoutMode
  index: number
  rows: ElementListRow[]
}

export function buildElementList(sections: Section[]): ElementListGroup[] {
  return sections.map((section, i) => ({
    sectionId: section.id,
    layout: section.layout,
    index: i + 1,
    rows: section.columns.flatMap((column) =>
      column.elements.map((element) => ({
        sectionId: section.id,
        columnId: column.id,
        element,
      })),
    ),
  }))
}

// Turn an element type slug into a human label: 'wedding-rsvp' -> 'Wedding RSVP'.
const TYPE_LABEL_OVERRIDES: Partial<Record<ElementType, string>> = {
  kpi: 'KPI',
  mcq: 'MCQ',
  gpa-card: 'GPA Card' as never, // placeholder guard; replaced below
}

const ACRONYMS = new Set(['kpi', 'mcq', 'gpa', 'rsvp', 'id'])

export function elementTypeLabel(type: ElementType): string {
  return type
    .split('-')
    .map((word) => (ACRONYMS.has(word) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ')
}

// A short content hint per element, when one is readily available.
function contentHint(element: CanvasElement): string | undefined {
  switch (element.type) {
    case 'heading':
    case 'text':
      return element.content || undefined
    case 'kpi':
      return element.kpiLabel || undefined
    case 'button':
      return element.buttonText || undefined
    case 'image':
      return element.url ? element.url.split('/').pop() : undefined
    case 'quote':
      return element.quoteText || undefined
    default:
      return undefined
  }
}

export function elementRowLabel(element: CanvasElement): string {
  const base = elementTypeLabel(element.type)
  const hint = contentHint(element)
  return hint ? `${base} — ${hint}` : base
}
```

> Note: delete the `TYPE_LABEL_OVERRIDES` object — the `ACRONYMS` set fully handles `kpi`, `mcq`, `gpa`, `rsvp`. It is shown only to flag that acronym handling is required; the final file must not contain the invalid `gpa-card:` key.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/editor/element-list.test.ts`
Expected: PASS (4 tests). Confirm `elementTypeLabel('wedding-rsvp')` === `'Wedding RSVP'`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/element-list.ts src/lib/editor/element-list.test.ts
git commit -m "feat(editor): section-grouped element-list builder + label helpers"
```

---

## Task 3: Lift selection out of ColumnCanvas into props

**Files:**
- Modify: `src/components/canvas/ColumnCanvas.tsx`
- Test: `src/components/canvas/ColumnCanvas.selection.test.tsx`

**Interfaces:**
- Consumes: `EditorSelection` helpers (Task 1).
- Produces (new `ColumnCanvasProps` fields): `selectedElementId?: string | null`, `onSelectElement?: (sel: { sectionId: string; columnId: string; elementId: string } | null) => void`.

**Context:** Today `ColumnCanvas` owns `const [selectedElement, setSelectedElement] = useState<string | null>(null)` and clears it on background click. We replace that internal state with the two new props so `PageEditor` becomes the single source of truth.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/canvas/ColumnCanvas.selection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColumnCanvas } from './ColumnCanvas'
import type { Section } from '@/lib/types/canvas'

const sections: Section[] = [
  { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [
    { id: 'e1', type: 'heading', content: 'Hello', level: 2 },
  ] }] },
]

const baseProps = {
  sections,
  onSectionsChange: () => {},
  onAddSection: () => {},
  onDeleteSection: () => {},
  onOpenSlashMenu: () => {},
  onUpdateElement: () => {},
  onDeleteElement: () => {},
}

describe('ColumnCanvas selection is controlled', () => {
  it('calls onSelectElement with the element coordinates when a block is clicked', () => {
    const onSelectElement = vi.fn()
    render(<ColumnCanvas {...baseProps} selectedElementId={null} onSelectElement={onSelectElement} />)
    fireEvent.click(screen.getByText('Hello'))
    expect(onSelectElement).toHaveBeenCalledWith({ sectionId: 's1', columnId: 'c1', elementId: 'e1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/canvas/ColumnCanvas.selection.test.tsx`
Expected: FAIL — `onSelectElement` not called (canvas still uses internal state) or prop ignored.

- [ ] **Step 3: Apply the code changes**

In `src/components/canvas/ColumnCanvas.tsx`:

1. Add to `ColumnCanvasProps` (after `onDeleteElement`):

```tsx
  selectedElementId?: string | null
  onSelectElement?: (sel: { sectionId: string; columnId: string; elementId: string } | null) => void
```

2. Destructure them in the function signature and **remove** the internal selection state. Replace:

```tsx
  const [selectedElement, setSelectedElement] = useState<string | null>(null)
```

with (keep `activeId` state as-is):

```tsx
  // selection is controlled by the parent (PageEditor)
```

Add `selectedElementId = null` and `onSelectElement` to the destructured props list.

3. In `renderElement`, replace the selection line and `onSelect`:

```tsx
    const isSelected = selectedElementId === element.id && !isPreviewMode
    const commonProps = {
      isSelected,
      onSelect: () => !isPreviewMode && onSelectElement?.({ sectionId, columnId, elementId: element.id }),
      onDelete: () => onDeleteElement(sectionId, columnId, element.id),
    }
```

4. Replace the outer canvas background click handler (currently `onClick={() => setSelectedElement(null)}`):

```tsx
        onClick={() => onSelectElement?.(null)}
```

5. If `useState` is now unused, remove it from the React import.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/canvas/ColumnCanvas.selection.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck & full test sweep**

Run: `npx tsc --noEmit` then `pnpm test`
Expected: no type errors; all tests pass. (PageEditor still compiles — it does not yet pass the new props; they are optional.)

- [ ] **Step 6: Commit**

```bash
git add src/components/canvas/ColumnCanvas.tsx src/components/canvas/ColumnCanvas.selection.test.tsx
git commit -m "refactor(canvas): lift element selection to controlled props"
```

---

## Task 4: ControlPanel shell (collapse + Elements/Page tabs)

**Files:**
- Create: `src/components/editor/panel/ControlPanel.tsx`
- Test: `src/components/editor/panel/ControlPanel.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  interface ControlPanelProps {
    collapsed: boolean
    onToggleCollapsed: () => void
    activeTab: 'elements' | 'page'
    onTabChange: (tab: 'elements' | 'page') => void
    elementsSlot: React.ReactNode
    pageSlot: React.ReactNode
  }
  export function ControlPanel(props: ControlPanelProps): JSX.Element
  ```
- The shell renders the tab bar + the active slot when expanded, and a thin rail with an expand button when collapsed. It does **not** own its own collapse/tab state — `PageEditor` owns it (so the state can drive the canvas reflow).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/ControlPanel.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ControlPanel } from './ControlPanel'

const base = {
  collapsed: false,
  onToggleCollapsed: vi.fn(),
  activeTab: 'elements' as const,
  onTabChange: vi.fn(),
  elementsSlot: <div>ELEMENTS_SLOT</div>,
  pageSlot: <div>PAGE_SLOT</div>,
}

describe('ControlPanel', () => {
  it('shows the active tab slot and both tab buttons when expanded', () => {
    render(<ControlPanel {...base} />)
    expect(screen.getByText('ELEMENTS_SLOT')).toBeInTheDocument()
    expect(screen.queryByText('PAGE_SLOT')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /elements/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /page/i })).toBeInTheDocument()
  })
  it('calls onTabChange when the Page tab is clicked', () => {
    const onTabChange = vi.fn()
    render(<ControlPanel {...base} onTabChange={onTabChange} />)
    fireEvent.click(screen.getByRole('button', { name: /page/i }))
    expect(onTabChange).toHaveBeenCalledWith('page')
  })
  it('when collapsed, hides slots and shows an expand control', () => {
    render(<ControlPanel {...base} collapsed />)
    expect(screen.queryByText('ELEMENTS_SLOT')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /expand panel/i }))
    expect(base.onToggleCollapsed).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/ControlPanel.test.tsx`
Expected: FAIL — cannot resolve `./ControlPanel`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/editor/panel/ControlPanel.tsx
'use client'

import { PanelRightClose, PanelRightOpen, Layers, SlidersHorizontal } from 'lucide-react'

interface ControlPanelProps {
  collapsed: boolean
  onToggleCollapsed: () => void
  activeTab: 'elements' | 'page'
  onTabChange: (tab: 'elements' | 'page') => void
  elementsSlot: React.ReactNode
  pageSlot: React.ReactNode
}

export function ControlPanel({
  collapsed,
  onToggleCollapsed,
  activeTab,
  onTabChange,
  elementsSlot,
  pageSlot,
}: ControlPanelProps) {
  if (collapsed) {
    return (
      <div className="w-12 flex-shrink-0 border-l border-border bg-background flex flex-col items-center py-3 gap-2">
        <button
          onClick={onToggleCollapsed}
          aria-label="Expand panel"
          className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition"
        >
          <PanelRightOpen className="w-4 h-4" />
        </button>
        <button onClick={() => { onTabChange('elements'); onToggleCollapsed() }} aria-label="Elements" className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition">
          <Layers className="w-4 h-4" />
        </button>
        <button onClick={() => { onTabChange('page'); onToggleCollapsed() }} aria-label="Page settings" className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition">
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="w-80 flex-shrink-0 border-l border-border bg-background flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border flex-shrink-0">
        <div className="flex-1 flex gap-1 bg-muted/60 rounded-lg p-1">
          <button
            onClick={() => onTabChange('elements')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-1.5 rounded-md transition ${activeTab === 'elements' ? 'bg-background text-primary font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Layers className="w-4 h-4" /> Elements
          </button>
          <button
            onClick={() => onTabChange('page')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-1.5 rounded-md transition ${activeTab === 'page' ? 'bg-background text-primary font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <SlidersHorizontal className="w-4 h-4" /> Page
          </button>
        </div>
        <button
          onClick={onToggleCollapsed}
          aria-label="Collapse panel"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
        >
          <PanelRightClose className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'elements' ? elementsSlot : pageSlot}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/editor/panel/ControlPanel.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panel/ControlPanel.tsx src/components/editor/panel/ControlPanel.test.tsx
git commit -m "feat(editor): ControlPanel shell with collapse + Elements/Page tabs"
```

---

## Task 5: Inspector registry + DefaultInspector

**Files:**
- Create: `src/components/editor/panel/inspectors/registry.tsx`
- Create: `src/components/editor/panel/inspectors/DefaultInspector.tsx`
- Test: `src/components/editor/panel/inspectors/registry.test.tsx`

**Interfaces:**
- Produces:
  ```tsx
  interface InspectorProps {
    element: CanvasElement
    onChange: (updates: Partial<CanvasElement>) => void
    isPro: boolean
  }
  type Inspector = React.ComponentType<InspectorProps>
  const ELEMENT_INSPECTORS: Partial<Record<ElementType, Inspector>>
  function getInspector(type: ElementType): Inspector   // returns DefaultInspector when unmapped
  ```
- Consumes: nothing yet (starter inspectors register in Tasks 11–12; registry ships empty except the fallback).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/inspectors/registry.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getInspector } from './registry'

describe('inspector registry', () => {
  it('falls back to DefaultInspector for an unmapped type', () => {
    const Inspector = getInspector('table')
    render(<Inspector element={{ id: 'e1', type: 'table' }} onChange={() => {}} isPro={false} />)
    expect(screen.getByText(/settings for this element/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/inspectors/registry.test.tsx`
Expected: FAIL — cannot resolve `./registry`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/editor/panel/inspectors/DefaultInspector.tsx
'use client'

import type { CanvasElement } from '@/lib/types/canvas'

interface InspectorProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  isPro: boolean
}

export function DefaultInspector({ element }: InspectorProps) {
  return (
    <div className="px-3 py-3 text-sm text-muted-foreground">
      <p>Detailed settings for this element are on the block itself — click it on the canvas to edit inline.</p>
      <p className="mt-2 text-xs opacity-70">Type: {element.type}</p>
    </div>
  )
}

export type { InspectorProps }
```

```tsx
// src/components/editor/panel/inspectors/registry.tsx
'use client'

import type { ElementType } from '@/lib/types/canvas'
import { DefaultInspector, type InspectorProps } from './DefaultInspector'

export type Inspector = React.ComponentType<InspectorProps>
export type { InspectorProps }

// Elements register here as their inspectors are authored (Tasks 11–12).
export const ELEMENT_INSPECTORS: Partial<Record<ElementType, Inspector>> = {}

export function getInspector(type: ElementType): Inspector {
  return ELEMENT_INSPECTORS[type] ?? DefaultInspector
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/editor/panel/inspectors/registry.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panel/inspectors/
git commit -m "feat(editor): inspector registry + DefaultInspector fallback"
```

---

## Task 6: ElementRow (accordion row + inspector)

**Files:**
- Create: `src/components/editor/panel/ElementRow.tsx`
- Test: `src/components/editor/panel/ElementRow.test.tsx`

**Interfaces:**
- Consumes: `getInspector` (Task 5), `elementRowLabel` (Task 2).
- Produces:
  ```tsx
  interface ElementRowProps {
    row: import('@/lib/editor/element-list').ElementListRow
    expanded: boolean
    onToggle: () => void          // parent enforces single-open + selection
    onChange: (updates: Partial<CanvasElement>) => void
    onDelete: () => void
    isPro: boolean
  }
  export function ElementRow(props: ElementRowProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/ElementRow.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ElementRow } from './ElementRow'

const row = { sectionId: 's1', columnId: 'c1', element: { id: 'e1', type: 'image' as const, url: 'https://x/hero.jpg' } }

describe('ElementRow', () => {
  it('renders the row label and hides inspector when collapsed', () => {
    render(<ElementRow row={row} expanded={false} onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByText('Image — hero.jpg')).toBeInTheDocument()
    expect(screen.queryByText(/settings for this element/i)).not.toBeInTheDocument()
  })
  it('calls onToggle when the row header is clicked', () => {
    const onToggle = vi.fn()
    render(<ElementRow row={row} expanded={false} onToggle={onToggle} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    fireEvent.click(screen.getByRole('button', { name: /Image — hero\.jpg/ }))
    expect(onToggle).toHaveBeenCalled()
  })
  it('renders the inspector (DefaultInspector for image until migrated) when expanded', () => {
    render(<ElementRow row={row} expanded onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByText(/settings for this element/i)).toBeInTheDocument()
  })
})
```

> When Task 11 registers `ImageInspector`, update the third test to assert on an Image-specific field (noted in Task 11).

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/ElementRow.test.tsx`
Expected: FAIL — cannot resolve `./ElementRow`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/editor/panel/ElementRow.tsx
'use client'

import { useRef, useEffect } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementListRow } from '@/lib/editor/element-list'
import { elementRowLabel } from '@/lib/editor/element-list'
import { getInspector } from './inspectors/registry'

interface ElementRowProps {
  row: ElementListRow
  expanded: boolean
  onToggle: () => void
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isPro: boolean
}

export function ElementRow({ row, expanded, onToggle, onChange, onDelete, isPro }: ElementRowProps) {
  const ref = useRef<HTMLDivElement>(null)
  const Inspector = getInspector(row.element.type)

  // Auto-scroll the opened row to the top of the scrolling panel body.
  useEffect(() => {
    if (expanded) ref.current?.scrollIntoView({ block: 'nearest' })
  }, [expanded])

  return (
    <div ref={ref} className={`rounded-lg border ${expanded ? 'border-primary/40 bg-muted/40' : 'border-transparent'}`}>
      <div className="flex items-center">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-2.5 py-2 text-sm text-left rounded-lg hover:bg-muted transition min-w-0"
        >
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${expanded ? '' : '-rotate-90'} text-muted-foreground`} />
          <span className="truncate">{elementRowLabel(row.element)}</span>
        </button>
        <button onClick={onDelete} aria-label="Delete element" className="p-2 text-muted-foreground hover:text-destructive transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {expanded && (
        <div className="pb-2">
          <Inspector element={row.element} onChange={onChange} isPro={isPro} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/editor/panel/ElementRow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panel/ElementRow.tsx src/components/editor/panel/ElementRow.test.tsx
git commit -m "feat(editor): ElementRow accordion with inspector + auto-scroll"
```

---

## Task 7: SectionRow (group header + rows + add-element)

**Files:**
- Create: `src/components/editor/panel/SectionRow.tsx`
- Test: `src/components/editor/panel/SectionRow.test.tsx`

**Interfaces:**
- Consumes: `ElementListGroup` (Task 2), `ElementRow` (Task 6).
- Produces:
  ```tsx
  interface SectionRowProps {
    group: import('@/lib/editor/element-list').ElementListGroup
    expandedElementId: string | null
    onToggleElement: (row: import('@/lib/editor/element-list').ElementListRow) => void
    onChangeElement: (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) => void
    onDeleteElement: (sectionId: string, columnId: string, elementId: string) => void
    onOpenSectionSettings: (sectionId: string) => void
    onAddElement: (sectionId: string) => void
    isPro: boolean
  }
  export function SectionRow(props: SectionRowProps): JSX.Element
  ```

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/SectionRow.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionRow } from './SectionRow'

const group = {
  sectionId: 's1', layout: 'full-width' as const, index: 1,
  rows: [{ sectionId: 's1', columnId: 'c1', element: { id: 'e1', type: 'heading' as const, content: 'Hi' } }],
}
const base = {
  group,
  expandedElementId: null,
  onToggleElement: vi.fn(),
  onChangeElement: vi.fn(),
  onDeleteElement: vi.fn(),
  onOpenSectionSettings: vi.fn(),
  onAddElement: vi.fn(),
  isPro: false,
}

describe('SectionRow', () => {
  it('renders the section header label and its element rows', () => {
    render(<SectionRow {...base} />)
    expect(screen.getByText(/Section 1/)).toBeInTheDocument()
    expect(screen.getByText(/full.width/i)).toBeInTheDocument()
    expect(screen.getByText('Heading — Hi')).toBeInTheDocument()
  })
  it('fires onOpenSectionSettings from the gear button', () => {
    const onOpenSectionSettings = vi.fn()
    render(<SectionRow {...base} onOpenSectionSettings={onOpenSectionSettings} />)
    fireEvent.click(screen.getByRole('button', { name: /section 1 settings/i }))
    expect(onOpenSectionSettings).toHaveBeenCalledWith('s1')
  })
  it('fires onAddElement from the add button', () => {
    const onAddElement = vi.fn()
    render(<SectionRow {...base} onAddElement={onAddElement} />)
    fireEvent.click(screen.getByRole('button', { name: /add element/i }))
    expect(onAddElement).toHaveBeenCalledWith('s1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/SectionRow.test.tsx`
Expected: FAIL — cannot resolve `./SectionRow`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/editor/panel/SectionRow.tsx
'use client'

import { Settings2, Plus } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import type { ElementListGroup, ElementListRow } from '@/lib/editor/element-list'
import { ElementRow } from './ElementRow'

interface SectionRowProps {
  group: ElementListGroup
  expandedElementId: string | null
  onToggleElement: (row: ElementListRow) => void
  onChangeElement: (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) => void
  onDeleteElement: (sectionId: string, columnId: string, elementId: string) => void
  onOpenSectionSettings: (sectionId: string) => void
  onAddElement: (sectionId: string) => void
  isPro: boolean
}

export function SectionRow({
  group, expandedElementId, onToggleElement, onChangeElement, onDeleteElement,
  onOpenSectionSettings, onAddElement, isPro,
}: SectionRowProps) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Section {group.index} · {group.layout.replace('-', ' ')}
        </span>
        <button
          onClick={() => onOpenSectionSettings(group.sectionId)}
          aria-label={`Section ${group.index} settings`}
          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="space-y-0.5">
        {group.rows.map((row) => (
          <ElementRow
            key={row.element.id}
            row={row}
            expanded={expandedElementId === row.element.id}
            onToggle={() => onToggleElement(row)}
            onChange={(updates) => onChangeElement(row.sectionId, row.columnId, row.element.id, updates)}
            onDelete={() => onDeleteElement(row.sectionId, row.columnId, row.element.id)}
            isPro={isPro}
          />
        ))}
      </div>
      <button
        onClick={() => onAddElement(group.sectionId)}
        className="mt-1.5 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-primary border border-dashed border-primary/40 rounded-lg hover:bg-primary/5 transition"
      >
        <Plus className="w-3.5 h-3.5" /> Add element
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/editor/panel/SectionRow.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panel/SectionRow.tsx src/components/editor/panel/SectionRow.test.tsx
git commit -m "feat(editor): SectionRow group header + rows + add-element"
```

---

## Task 8: ElementsTab (assembles groups, single-open accordion)

**Files:**
- Create: `src/components/editor/panel/ElementsTab.tsx`
- Test: `src/components/editor/panel/ElementsTab.test.tsx`

**Interfaces:**
- Consumes: `buildElementList` (Task 2), `SectionRow` (Task 7).
- Produces:
  ```tsx
  interface ElementsTabProps {
    sections: Section[]
    expandedElementId: string | null
    onToggleElement: (row: ElementListRow) => void   // parent maps to selection (single-open)
    onChangeElement: (sectionId, columnId, elementId, updates) => void
    onDeleteElement: (sectionId, columnId, elementId) => void
    onOpenSectionSettings: (sectionId: string) => void
    onAddElement: (sectionId: string) => void
    isPro: boolean
  }
  export function ElementsTab(props: ElementsTabProps): JSX.Element
  ```
- Single-open is enforced by the parent (`PageEditor`): `expandedElementId` derives from `selectedElementId(selection)`, and `onToggleElement` sets/clears selection. `ElementsTab` is otherwise presentational.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/ElementsTab.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ElementsTab } from './ElementsTab'
import type { Section } from '@/lib/types/canvas'

const sections: Section[] = [
  { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'heading', content: 'Hi' }] }] },
  { id: 's2', layout: 'two-column', columns: [
    { id: 'c2', elements: [{ id: 'e2', type: 'kpi', kpiLabel: 'Rev' }] },
    { id: 'c3', elements: [] },
  ] },
]
const noop = () => {}
const base = {
  sections, expandedElementId: null,
  onToggleElement: noop, onChangeElement: noop, onDeleteElement: noop,
  onOpenSectionSettings: noop, onAddElement: noop, isPro: false,
}

describe('ElementsTab', () => {
  it('renders a group per section with their rows', () => {
    render(<ElementsTab {...base} />)
    expect(screen.getByText(/Section 1/)).toBeInTheDocument()
    expect(screen.getByText(/Section 2/)).toBeInTheDocument()
    expect(screen.getByText('Heading — Hi')).toBeInTheDocument()
    expect(screen.getByText('KPI — Rev')).toBeInTheDocument()
  })
  it('shows an empty state when there are no sections', () => {
    render(<ElementsTab {...base} sections={[]} />)
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/ElementsTab.test.tsx`
Expected: FAIL — cannot resolve `./ElementsTab`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/editor/panel/ElementsTab.tsx
'use client'

import type { CanvasElement, Section } from '@/lib/types/canvas'
import { buildElementList, type ElementListRow } from '@/lib/editor/element-list'
import { SectionRow } from './SectionRow'

interface ElementsTabProps {
  sections: Section[]
  expandedElementId: string | null
  onToggleElement: (row: ElementListRow) => void
  onChangeElement: (sectionId: string, columnId: string, elementId: string, updates: Partial<CanvasElement>) => void
  onDeleteElement: (sectionId: string, columnId: string, elementId: string) => void
  onOpenSectionSettings: (sectionId: string) => void
  onAddElement: (sectionId: string) => void
  isPro: boolean
}

export function ElementsTab(props: ElementsTabProps) {
  const groups = buildElementList(props.sections)

  if (groups.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-sm text-muted-foreground">
        Nothing here yet — add a section on the canvas to start building.
      </div>
    )
  }

  return (
    <div className="p-2">
      {groups.map((group) => (
        <SectionRow
          key={group.sectionId}
          group={group}
          expandedElementId={props.expandedElementId}
          onToggleElement={props.onToggleElement}
          onChangeElement={props.onChangeElement}
          onDeleteElement={props.onDeleteElement}
          onOpenSectionSettings={props.onOpenSectionSettings}
          onAddElement={props.onAddElement}
          isPro={props.isPro}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/editor/panel/ElementsTab.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panel/ElementsTab.tsx src/components/editor/panel/ElementsTab.test.tsx
git commit -m "feat(editor): ElementsTab assembling section groups"
```

---

## Task 9: Extract inline `*Body` from the settings modals

**Files:**
- Modify: `src/components/canvas/BackgroundSettings.tsx`, `src/components/canvas/SpacingSettings.tsx`, `src/components/canvas/ColumnStyleSettings.tsx`, `src/components/header/HeaderCardEditor.tsx`, `src/components/tabs/TabEditor.tsx`
- Test: `src/components/editor/panel/settings-bodies.test.tsx`

**Context:** Each of these components today is a modal: it early-returns `null` when `!isOpen` and renders a fixed overlay containing a header (with a close button) and a form. We extract the **form** into an exported `*Body` component so the Page tab can host it without the modal chrome. The modal wrapper keeps working (it renders the Body inside the overlay), so nothing else breaks.

**Interfaces produced (all in their existing files):**
- `export function BackgroundSettingsBody(props: { config: BackgroundConfig; onChange: (c: BackgroundConfig) => void }): JSX.Element`
- `export function SpacingSettingsBody(props: { config: SpacingConfig; onChange: (c: SpacingConfig) => void }): JSX.Element`
- `export function ColumnStyleSettingsBody(props: { settings: ColumnSettings; onChange: (s: ColumnSettings) => void }): JSX.Element`
- `export function HeaderCardEditorBody(props: { config: HeaderCardConfig; onChange: (c: HeaderCardConfig) => void }): JSX.Element`
- `export function TabEditorBody(props: { config: TabsConfig; onChange: (c: TabsConfig) => void; currentSections: Section[] }): JSX.Element`

**Refactor rule (apply to each file, identically in shape):**
1. Move all JSX **inside** the modal's content area (the form controls — everything except the outer fixed backdrop `<div>` and the title/close-button header bar) into a new exported function `XxxBody({ config, onChange }: ...)` in the same file. Keep the inner JSX and all handlers **byte-for-byte identical**; only relocate them. Handlers already call `onChange(...)` — leave them.
2. The original component keeps its `isOpen`/`onClose` signature and its overlay + header, and renders `<XxxBody config={config} onChange={onChange} />` where the form used to be. This preserves every current caller in `PageEditor`.
3. For `TabEditor`, the Body also takes `currentSections` (used when enabling tabs); thread it through unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/settings-bodies.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SpacingSettingsBody } from '@/components/canvas/SpacingSettings'
import { BackgroundSettingsBody } from '@/components/canvas/BackgroundSettings'
import { ColumnStyleSettingsBody } from '@/components/canvas/ColumnStyleSettings'
import { HeaderCardEditorBody } from '@/components/header/HeaderCardEditor'
import { TabEditorBody } from '@/components/tabs/TabEditor'
import { DEFAULT_SPACING_CONFIG } from '@/lib/types/spacing'
import { DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import { DEFAULT_COLUMN_SETTINGS } from '@/lib/types/canvas'
import { DEFAULT_HEADER_CARD } from '@/lib/types/header-card'
import { DEFAULT_TABS_CONFIG } from '@/lib/types/tabs'

describe('settings bodies render standalone (no modal chrome)', () => {
  it('SpacingSettingsBody renders without isOpen', () => {
    const { container } = render(<SpacingSettingsBody config={DEFAULT_SPACING_CONFIG} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('BackgroundSettingsBody renders', () => {
    const { container } = render(<BackgroundSettingsBody config={DEFAULT_BACKGROUND_CONFIG} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('ColumnStyleSettingsBody renders', () => {
    const { container } = render(<ColumnStyleSettingsBody settings={DEFAULT_COLUMN_SETTINGS} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('HeaderCardEditorBody renders', () => {
    const { container } = render(<HeaderCardEditorBody config={DEFAULT_HEADER_CARD} onChange={() => {}} />)
    expect(container.firstChild).toBeTruthy()
  })
  it('TabEditorBody renders', () => {
    const { container } = render(<TabEditorBody config={DEFAULT_TABS_CONFIG} onChange={() => {}} currentSections={[]} />)
    expect(container.firstChild).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/settings-bodies.test.tsx`
Expected: FAIL — the `*Body` exports don't exist yet.

- [ ] **Step 3: Perform the extraction in all five files**

Apply the Refactor rule above to each file. Verify imports of `Section` (TabEditor), `BackgroundConfig`, `SpacingConfig`, `ColumnSettings`, `HeaderCardConfig`, `TabsConfig` are present for the new Body prop types (they already are in each file).

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm test -- src/components/editor/panel/settings-bodies.test.tsx` then `npx tsc --noEmit`
Expected: PASS (5 tests); no type errors. The existing modal components still compile and render (they now delegate to their Body).

- [ ] **Step 5: Commit**

```bash
git add src/components/canvas/BackgroundSettings.tsx src/components/canvas/SpacingSettings.tsx src/components/canvas/ColumnStyleSettings.tsx src/components/header/HeaderCardEditor.tsx src/components/tabs/TabEditor.tsx src/components/editor/panel/settings-bodies.test.tsx
git commit -m "refactor(settings): extract inline *Body from settings modals"
```

---

## Task 10: PageTab (host settings inline)

**Files:**
- Create: `src/components/editor/panel/PageTab.tsx`
- Test: `src/components/editor/panel/PageTab.test.tsx`

**Interfaces:**
- Consumes the `*Body` components (Task 9).
- Produces:
  ```tsx
  interface PageTabProps {
    background: BackgroundConfig; onBackgroundChange: (c: BackgroundConfig) => void
    spacing: SpacingConfig; onSpacingChange: (c: SpacingConfig) => void
    headerCard: HeaderCardConfig; onHeaderCardChange: (c: HeaderCardConfig) => void
    tabsConfig: TabsConfig; onTabsChange: (c: TabsConfig) => void
    currentSections: Section[]
  }
  export function PageTab(props: PageTabProps): JSX.Element
  ```
- Renders four collapsible `<details>` sections: **Background**, **Spacing & layout**, **Header card**, **Tabs** — each wrapping the matching `*Body`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/PageTab.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageTab } from './PageTab'
import { DEFAULT_BACKGROUND_CONFIG } from '@/lib/types/background'
import { DEFAULT_SPACING_CONFIG } from '@/lib/types/spacing'
import { DEFAULT_HEADER_CARD } from '@/lib/types/header-card'
import { DEFAULT_TABS_CONFIG } from '@/lib/types/tabs'

const base = {
  background: DEFAULT_BACKGROUND_CONFIG, onBackgroundChange: () => {},
  spacing: DEFAULT_SPACING_CONFIG, onSpacingChange: () => {},
  headerCard: DEFAULT_HEADER_CARD, onHeaderCardChange: () => {},
  tabsConfig: DEFAULT_TABS_CONFIG, onTabsChange: () => {},
  currentSections: [],
}

describe('PageTab', () => {
  it('shows the four settings sections', () => {
    render(<PageTab {...base} />)
    expect(screen.getByText(/^Background$/)).toBeInTheDocument()
    expect(screen.getByText(/Spacing & layout/i)).toBeInTheDocument()
    expect(screen.getByText(/Header card/i)).toBeInTheDocument()
    expect(screen.getByText(/^Tabs$/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/PageTab.test.tsx`
Expected: FAIL — cannot resolve `./PageTab`.

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/components/editor/panel/PageTab.tsx
'use client'

import type { BackgroundConfig } from '@/lib/types/background'
import type { SpacingConfig } from '@/lib/types/spacing'
import type { HeaderCardConfig } from '@/lib/types/header-card'
import type { TabsConfig } from '@/lib/types/tabs'
import type { Section } from '@/lib/types/canvas'
import { BackgroundSettingsBody } from '@/components/canvas/BackgroundSettings'
import { SpacingSettingsBody } from '@/components/canvas/SpacingSettings'
import { HeaderCardEditorBody } from '@/components/header/HeaderCardEditor'
import { TabEditorBody } from '@/components/tabs/TabEditor'

interface PageTabProps {
  background: BackgroundConfig; onBackgroundChange: (c: BackgroundConfig) => void
  spacing: SpacingConfig; onSpacingChange: (c: SpacingConfig) => void
  headerCard: HeaderCardConfig; onHeaderCardChange: (c: HeaderCardConfig) => void
  tabsConfig: TabsConfig; onTabsChange: (c: TabsConfig) => void
  currentSections: Section[]
}

function Section_({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  return (
    <details open={defaultOpen} className="border-b border-border group">
      <summary className="px-3 py-2.5 text-sm font-medium cursor-pointer select-none list-none flex items-center justify-between hover:bg-muted/50 transition">
        {title}
        <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  )
}

export function PageTab(props: PageTabProps) {
  return (
    <div>
      <Section_ title="Background" defaultOpen>
        <BackgroundSettingsBody config={props.background} onChange={props.onBackgroundChange} />
      </Section_>
      <Section_ title="Spacing & layout">
        <SpacingSettingsBody config={props.spacing} onChange={props.onSpacingChange} />
      </Section_>
      <Section_ title="Header card">
        <HeaderCardEditorBody config={props.headerCard} onChange={props.onHeaderCardChange} />
      </Section_>
      <Section_ title="Tabs">
        <TabEditorBody config={props.tabsConfig} onChange={props.onTabsChange} currentSections={props.currentSections} />
      </Section_>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/editor/panel/PageTab.test.tsx`
Expected: PASS. If a `*Body` renders its own duplicate heading text that collides with the summary, the test still passes (uses the summary text); no action needed.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panel/PageTab.tsx src/components/editor/panel/PageTab.test.tsx
git commit -m "feat(editor): PageTab hosting background/spacing/header/tabs inline"
```

---

## Task 11: Wire the panel into PageEditor (selection, layout, slim top bar)

**Files:**
- Modify: `src/components/editor/PageEditor.tsx`
- Test: `src/components/editor/panel/PageEditor.integration.test.tsx`

**Context:** This task assembles everything: `PageEditor` gains `selection`, `panelCollapsed`, `panelTab` state; wraps canvas + `ControlPanel` in a horizontal flex; passes selection to `ColumnCanvas`; renders `ElementsTab`/`PageTab`; wires section ⚙ (opens existing `ColumnStyleSettings` for the section's first column) and panel "+ Add element" (reuses `openSlashMenu` targeting the section's first column); and **removes the Background/Spacing/Tabs/Header buttons** from the top bar. The old modal components stay mounted only if still referenced; per this task they are removed from the top bar and their state toggles deleted (Background/Spacing/Header/Tab editors now live in the Page tab). `ColumnStyleSettings` modal stays (used by the section ⚙ and the on-canvas column button).

**Interfaces consumed:** `ControlPanel` (T4), `ElementsTab` (T8), `PageTab` (T10), `selectedElementId`/`EditorSelection` (T1), `buildElementList`/`ElementListRow` (T2), `isPro` (`@/lib/plan`).

- [ ] **Step 1: Write the failing integration test**

```tsx
// src/components/editor/panel/PageEditor.integration.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PageEditor } from '@/components/editor/PageEditor'

// Minimal fetch stub: load an existing page with two sections.
const page = {
  id: 'p1', title: 'My Page', slug: 'my-page', published: false, version: 1, isOwner: true,
  category: null, coverImage: null,
  sections: [
    { id: 's1', layout: 'full-width', columns: [{ id: 'c1', elements: [{ id: 'e1', type: 'heading', content: 'Hi', level: 2 }] }] },
  ],
  background: null, spacing: null, headerCard: null, tabs: null, kitConfig: null,
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async (url: string, opts?: any) => {
    if (url === '/api/displays/p1' && (!opts || opts.method === undefined)) {
      return { ok: true, status: 200, json: async () => page } as any
    }
    return { ok: true, status: 200, json: async () => ({ version: 2 }) } as any
  }))
})

describe('PageEditor renders the control panel', () => {
  it('shows the Elements list with the page element and hides old top-bar buttons', async () => {
    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())
    // Elements/Page tabs exist
    expect(screen.getByRole('button', { name: /elements/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^page$/i })).toBeInTheDocument()
    // Old top-bar buttons are gone (moved into Page tab)
    expect(screen.queryByRole('button', { name: /^Background$/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Spacing$/ })).not.toBeInTheDocument()
  })

  it('collapsing the panel toggles to a rail with an expand control', async () => {
    render(<PageEditor pageId="p1" />)
    await waitFor(() => expect(screen.getByText('Heading — Hi')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /collapse panel/i }))
    expect(screen.getByRole('button', { name: /expand panel/i })).toBeInTheDocument()
  })
})
```

> The auth store (`useAuthStore`) reads `user`; the test relies on its default (null user → `isPro` false), which is fine. If `useAuthStore` needs a user for render, the existing store default already returns `{ user: null }`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/PageEditor.integration.test.tsx`
Expected: FAIL — panel not present; old buttons still there.

- [ ] **Step 3: Edit `PageEditor.tsx`**

3a. Add imports:

```tsx
import { ControlPanel } from '@/components/editor/panel/ControlPanel'
import { ElementsTab } from '@/components/editor/panel/ElementsTab'
import { PageTab } from '@/components/editor/panel/PageTab'
import type { EditorSelection } from '@/lib/editor/selection'
import { selectedElementId } from '@/lib/editor/selection'
import type { ElementListRow } from '@/lib/editor/element-list'
```

3b. Add state (near the other `useState` hooks):

```tsx
  const [selection, setSelection] = useState<EditorSelection>(null)
  const [panelCollapsed, setPanelCollapsed] = useState(false)
  const [panelTab, setPanelTab] = useState<'elements' | 'page'>('elements')
```

3c. Remove the top-bar buttons for **Header**, **Tabs**, **Background**, and **Spacing** (the four `<button>`s in the header wrapping `CreditCard`/`LayoutList`/`ImageIcon`/`AlignVerticalSpaceAround`). Also remove the now-unused state `showBackgroundSettings`, `showSpacingSettings`, `showHeaderEditor`, `showTabEditor` and the JSX that rendered `<BackgroundSettings>`, `<SpacingSettings>`, `<HeaderCardEditor>`, and `<TabEditor>` as modals at the bottom. Keep `ColumnStyleSettings`, `ShareDialog`, `CollaborateModal`, `PublishDialog`, `CardLibraryPicker`, `UpgradePrompt`, `PresenceBar`, `SlashCommandMenu`, and the header-card **preview** on the canvas.

3d. Handlers for panel section ⚙ and add-element (add near other handlers):

```tsx
  // Section ⚙ opens the existing column-style modal for the section's first column.
  const openSectionSettings = (sectionId: string) => {
    const secs = getActiveSections()
    const section = secs.find((s) => s.id === sectionId)
    const firstCol = section?.columns[0]
    if (section && firstCol) openColumnSettings(section.id, firstCol.id)
  }

  // Panel "+ Add element" reuses the slash menu, targeting the section's first column.
  const addElementToSection = (sectionId: string) => {
    const secs = getActiveSections()
    const section = secs.find((s) => s.id === sectionId)
    const firstCol = section?.columns[0]
    if (section && firstCol) openSlashMenu(section.id, firstCol.id)
  }

  // Single-open accordion: toggling a row sets/clears the element selection.
  const toggleRow = (row: ElementListRow) => {
    setSelection((prev) =>
      selectedElementId(prev) === row.element.id
        ? null
        : { kind: 'element', sectionId: row.sectionId, columnId: row.columnId, elementId: row.element.id },
    )
    setPanelTab('elements')
  }
```

3e. Pass selection into `ColumnCanvas` (find the `<ColumnCanvas ... />` render and add):

```tsx
            selectedElementId={selectedElementId(selection)}
            onSelectElement={(sel) =>
              setSelection(sel ? { kind: 'element', ...sel } : null)
            }
```

3f. Change the outer canvas container to sit beside the panel. Wrap the existing `<div className="flex-1 overflow-auto flex flex-col">…</div>` (the canvas region) and the new panel in a horizontal flex row. Concretely, replace the single canvas wrapper with:

```tsx
      <div className="flex-1 min-h-0 flex">
        {/* existing canvas scroll region (unchanged inner content) */}
        <div className="flex-1 overflow-auto flex flex-col">
          {/* …existing tab bar + background/header/ColumnCanvas… */}
        </div>

        {/* Control panel — hidden in preview */}
        {!isPreviewMode && (
          <ControlPanel
            collapsed={panelCollapsed}
            onToggleCollapsed={() => setPanelCollapsed((v) => !v)}
            activeTab={panelTab}
            onTabChange={setPanelTab}
            elementsSlot={
              <ElementsTab
                sections={getActiveSections()}
                expandedElementId={selectedElementId(selection)}
                onToggleElement={toggleRow}
                onChangeElement={updateElement}
                onDeleteElement={deleteElement}
                onOpenSectionSettings={openSectionSettings}
                onAddElement={addElementToSection}
                isPro={isPro(user)}
              />
            }
            pageSlot={
              <PageTab
                background={activeBackgroundConfig}
                onBackgroundChange={setActiveBackground}
                spacing={spacing}
                onSpacingChange={setSpacing}
                headerCard={activeHeaderCardConfig}
                onHeaderCardChange={setActiveHeaderCard}
                tabsConfig={tabsConfig}
                onTabsChange={(newConfig) => {
                  setTabsConfig(newConfig)
                  if (newConfig.enabled && newConfig.tabs.length > 0 && !activeTabId) setActiveTabId(newConfig.tabs[0].id)
                  if (!newConfig.enabled) {
                    if (tabsConfig.tabs.length > 0) setSections(tabsConfig.tabs[0].sections)
                    setActiveTabId(null)
                  }
                }}
                currentSections={sections}
              />
            }
          />
        )}
      </div>
```

> `activeBackgroundConfig` and `activeHeaderCardConfig` are already computed above the `return`. The `onTabsChange` logic mirrors the old `TabEditor` `onChange` that this task removes.

3g. Remove now-unused imports (`BackgroundSettings`, `SpacingSettings`, `HeaderCardEditor`, `TabEditor`, and the lucide icons `CreditCard`, `LayoutList`, `ImageIcon`, `AlignVerticalSpaceAround` if no longer used).

- [ ] **Step 4: Run the integration test**

Run: `pnpm test -- src/components/editor/panel/PageEditor.integration.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck + full sweep**

Run: `npx tsc --noEmit` then `pnpm test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Manual smoke (dev server)**

Run `pnpm dev`, open a page in the editor, and confirm: panel shows on the right; clicking a canvas block highlights it and opens its row; the Page tab edits background/spacing/header/tabs live; collapse reflows the canvas; slash-add and panel "+ Add element" both work; autosave still fires. Stop `pnpm dev` before any `pnpm build`.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/PageEditor.tsx src/components/editor/panel/PageEditor.integration.test.tsx
git commit -m "feat(editor): wire ControlPanel into PageEditor + slim the top bar"
```

---

## Task 12: Starter inspectors — Image, KPI, Button

**Files:**
- Create: `src/components/editor/panel/inspectors/ImageInspector.tsx`, `KPIInspector.tsx`, `ButtonInspector.tsx`
- Modify: `src/components/editor/panel/inspectors/registry.tsx`
- Modify: `src/components/editor/panel/ElementRow.test.tsx` (Image expanded assertion)
- Test: `src/components/editor/panel/inspectors/starter-inspectors.test.tsx`

**Interfaces:** each is an `Inspector` (`{ element, onChange, isPro }`). Register in `ELEMENT_INSPECTORS`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/inspectors/starter-inspectors.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getInspector } from './registry'

describe('starter inspectors', () => {
  it('Image inspector edits url + alt', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('image')
    render(<Inspector element={{ id: 'e', type: 'image', url: '', alt: '' }} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/image url/i), { target: { value: 'https://x/a.jpg' } })
    expect(onChange).toHaveBeenCalledWith({ url: 'https://x/a.jpg' })
  })
  it('KPI inspector edits label', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('kpi')
    render(<Inspector element={{ id: 'e', type: 'kpi', kpiLabel: '' }} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/label/i), { target: { value: 'Revenue' } })
    expect(onChange).toHaveBeenCalledWith({ kpiLabel: 'Revenue' })
  })
  it('Button inspector edits text', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('button')
    render(<Inspector element={{ id: 'e', type: 'button', buttonText: '' }} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/button text/i), { target: { value: 'Buy' } })
    expect(onChange).toHaveBeenCalledWith({ buttonText: 'Buy' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/inspectors/starter-inspectors.test.tsx`
Expected: FAIL — image/kpi/button still resolve to `DefaultInspector` (no labeled inputs).

- [ ] **Step 3: Write the inspectors + register them**

```tsx
// src/components/editor/panel/inspectors/ImageInspector.tsx
'use client'
import type { InspectorProps } from './DefaultInspector'

export function ImageInspector({ element, onChange }: InspectorProps) {
  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Image URL
        <input
          type="text"
          value={element.url ?? ''}
          onChange={(e) => onChange({ url: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Alt text
        <input
          type="text"
          value={element.alt ?? ''}
          onChange={(e) => onChange({ alt: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
    </div>
  )
}
```

```tsx
// src/components/editor/panel/inspectors/KPIInspector.tsx
'use client'
import type { InspectorProps } from './DefaultInspector'

export function KPIInspector({ element, onChange }: InspectorProps) {
  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Label
        <input
          type="text"
          value={element.kpiLabel ?? ''}
          onChange={(e) => onChange({ kpiLabel: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Value
        <input
          type="text"
          value={element.kpiValue ?? ''}
          onChange={(e) => onChange({ kpiValue: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
    </div>
  )
}
```

```tsx
// src/components/editor/panel/inspectors/ButtonInspector.tsx
'use client'
import type { InspectorProps } from './DefaultInspector'

export function ButtonInspector({ element, onChange }: InspectorProps) {
  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Button text
        <input
          type="text"
          value={element.buttonText ?? ''}
          onChange={(e) => onChange({ buttonText: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Link URL
        <input
          type="text"
          value={element.buttonUrl ?? ''}
          onChange={(e) => onChange({ buttonUrl: e.target.value })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
    </div>
  )
}
```

Update `registry.tsx`:

```tsx
import { ImageInspector } from './ImageInspector'
import { KPIInspector } from './KPIInspector'
import { ButtonInspector } from './ButtonInspector'

export const ELEMENT_INSPECTORS: Partial<Record<ElementType, Inspector>> = {
  image: ImageInspector,
  kpi: KPIInspector,
  button: ButtonInspector,
}
```

Update the third `ElementRow.test.tsx` case (expanded image) to assert the migrated inspector:

```tsx
  it('renders the ImageInspector when expanded', () => {
    render(<ElementRow row={row} expanded onToggle={() => {}} onChange={() => {}} onDelete={() => {}} isPro={false} />)
    expect(screen.getByLabelText(/image url/i)).toBeInTheDocument()
  })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test -- src/components/editor/panel/inspectors/starter-inspectors.test.tsx src/components/editor/panel/ElementRow.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/panel/inspectors/ src/components/editor/panel/ElementRow.test.tsx
git commit -m "feat(editor): Image/KPI/Button inspectors in the panel registry"
```

---

## Task 13: Slideshow inspector with Advanced (Pro) home

**Files:**
- Create: `src/components/editor/panel/inspectors/SlideshowInspector.tsx`
- Modify: `src/components/editor/panel/inspectors/registry.tsx`
- Test: `src/components/editor/panel/inspectors/slideshow-inspector.test.tsx`

**Context:** This proves the two-tier + Pro pattern the spec is built around: basic settings (height, overlay) are free; an **Advanced** section is the reserved home for future Pro depth (auto-rotation cadence + preset images). For free users the Advanced section shows a locked `UpgradePrompt` trigger; for Pro users it shows a placeholder note that the rotation controls will land here (the rotation feature itself is a separate spec — this only guarantees the home).

**Interfaces:** `Inspector` (`{ element, onChange, isPro }`); registers `slideshow` in `ELEMENT_INSPECTORS`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/editor/panel/inspectors/slideshow-inspector.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { getInspector } from './registry'

const el = { id: 'e', type: 'slideshow' as const, slideshowSlides: [], slideshowHeight: 400, slideshowShowOverlay: true }

describe('SlideshowInspector', () => {
  it('edits the height (basic, free)', () => {
    const onChange = vi.fn()
    const Inspector = getInspector('slideshow')
    render(<Inspector element={el} onChange={onChange} isPro={false} />)
    fireEvent.change(screen.getByLabelText(/height/i), { target: { value: '500' } })
    expect(onChange).toHaveBeenCalledWith({ slideshowHeight: 500 })
  })
  it('shows a Pro lock in Advanced for free users', () => {
    const Inspector = getInspector('slideshow')
    render(<Inspector element={el} onChange={() => {}} isPro={false} />)
    expect(screen.getByText(/advanced/i)).toBeInTheDocument()
    expect(screen.getByText(/pro/i)).toBeInTheDocument()
  })
  it('shows the rotation home (no lock) for Pro users', () => {
    const Inspector = getInspector('slideshow')
    render(<Inspector element={el} onChange={() => {}} isPro />)
    expect(screen.getByText(/auto-rotation/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/components/editor/panel/inspectors/slideshow-inspector.test.tsx`
Expected: FAIL — slideshow resolves to `DefaultInspector`.

- [ ] **Step 3: Write the inspector + register it**

```tsx
// src/components/editor/panel/inspectors/SlideshowInspector.tsx
'use client'
import { Lock } from 'lucide-react'
import type { InspectorProps } from './DefaultInspector'

export function SlideshowInspector({ element, onChange, isPro }: InspectorProps) {
  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Height (px)
        <input
          type="number"
          value={element.slideshowHeight ?? 400}
          onChange={(e) => onChange({ slideshowHeight: Number(e.target.value) })}
          className="mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={element.slideshowShowOverlay ?? true}
          onChange={(e) => onChange({ slideshowShowOverlay: e.target.checked })}
        />
        Show text overlay
      </label>

      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="uppercase tracking-wide text-muted-foreground">Advanced</span>
          {!isPro && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-galli-violet/10 text-galli-violet px-1.5 py-0.5 rounded">
              <Lock className="w-3 h-3" /> PRO
            </span>
          )}
        </div>
        {isPro ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Auto-rotation (daily / weekly / biweekly) and preset image sets will appear here.
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Upgrade to Pro to unlock auto-rotation and preset image sets.
          </p>
        )}
      </div>
    </div>
  )
}
```

> `galli-violet` is the existing brand token used for Pro accents; if a different Pro accent token is already used elsewhere in `src/components/pro/*`, match that instead.

Update `registry.tsx`:

```tsx
import { SlideshowInspector } from './SlideshowInspector'
// …add to ELEMENT_INSPECTORS:
  slideshow: SlideshowInspector,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/components/editor/panel/inspectors/slideshow-inspector.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Full sweep + typecheck**

Run: `npx tsc --noEmit` then `pnpm test`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/panel/inspectors/
git commit -m "feat(editor): Slideshow inspector with Advanced (Pro) rotation home"
```

---

## Self-Review

**Spec coverage:**
- Right-docked, collapsible panel + canvas reflow → Tasks 4, 11. ✅
- Two tabs (Elements / Page) → Tasks 4, 8, 10, 11. ✅
- Grouped-by-section list + section ⚙ → Tasks 2, 7, 11. ✅
- Single-open accordion + auto-scroll → Tasks 6 (auto-scroll), 11 (single-open via selection). ✅
- Inspector registry + DefaultInspector + starter inspectors + Advanced/Pro home → Tasks 5, 12, 13. ✅
- Page settings moved out of modals (Background/Spacing/Tabs/Header) → Tasks 9, 10, 11. ✅
- Slimmed top bar → Task 11 (Step 3c). ✅
- Two-way selection sync → Tasks 3, 11. ✅
- Both add routes (slash + panel +) → Task 11 (`addElementToSection` reuses slash menu). ✅
- Keep inline editing / dnd / autosave / preview / collab → Tasks 3 (canvas unchanged except selection), 11 Step 6 smoke. ✅

**Placeholder scan:** Task 2 intentionally flags and instructs deletion of an invalid demonstrative object; every code step otherwise ships complete code. No "TODO/handle edge cases" hand-waving. ✅

**Type consistency:** `EditorSelection`, `selectedElementId`, `ElementListRow`/`ElementListGroup`, `InspectorProps`/`Inspector`/`getInspector`, and the `*Body` signatures are defined once (Tasks 1, 2, 5, 9) and consumed with the same names/shapes downstream. `onSelectElement` shape (`{sectionId, columnId, elementId} | null`) matches between Task 3 and Task 11 (3e). ✅

**Out-of-scope respected:** no mass inspector rewrite (only Image/KPI/Button/Slideshow), no panel drag-reorder, no rotation feature implementation (home only). ✅
