# Whiteboard Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Pro-gated `whiteboard` canvas element — a fixed fabric.js artboard the owner draws on in the editor, published as a read-only PNG.

**Architecture:** All state lives in the element JSON in `Display.sections` (no new model). The editor component lazy-loads fabric.js; on edit it saves the scene JSON and uploads a PNG snapshot to Blob; the public page renders only that PNG (`<img>`), so fabric never ships to visitors. Pure logic is extracted to `src/lib/whiteboard.ts` for unit testing (fabric/canvas isn't testable under jsdom).

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, `fabric` v6 (new dep, dynamically imported), Zustand, Tailwind, Vitest, existing `/api/upload` (Blob).

## Global Constraints

- **Add an element type** = this checklist: `ElementType` union + `CanvasElement` fields (`src/lib/types/canvas.ts`) → `createElement()` default → editor + `Public*` component pair → `SlashCommandMenu` entry → `PageEditor.handleCommandSelect` (only for the Pro gate) → `ColumnCanvas` `renderElement` switch (preview→Public, else editor) → `elements/index.ts` → `render-elements.tsx` case.
- **Element component contracts:** editor props `{ element, onChange, onDelete, isSelected, onSelect }`; public props `{ element }`.
- **fabric is editor-only:** import it exclusively via dynamic `import('fabric')` inside the editor component. It must NEVER be imported (statically or dynamically) by `PublicWhiteboardElement.tsx`, `render-elements.tsx`, or anything the public page loads.
- **Uploads** use the existing helper pattern: `POST /api/upload` with a `FormData` `file` field → response `{ url }`. Blob accepts images ≤10MB. Board images and the preview PNG both go through this.
- **Pro gate** reuses the existing `card` pattern in `PageEditor.handleCommandSelect`: `if (!isPro(user)) { setShowSlashMenu(false); setUpgradeOpen(true); return }` (`user` from `useAuthStore()`, `isPro` from `@/lib/plan`).
- **Artboard defaults:** width 800, height 450 (16:9), background `'blank'`. Presets: 16:9 (800×450), 4:3 (800×600), 1:1 (600×600).
- Test runner: Vitest. Single file: `pnpm exec vitest run <path>`. Typecheck: `pnpm exec tsc --noEmit`.
- Never commit: `Documents/`, `Images/`, `g1t.json`, `nul`, `.claude/settings.local.json`.
- **fabric UI tasks (4, 5) are not unit-testable under jsdom** (no canvas). Their gate is `tsc --noEmit` clean + the manual browser smoke in Task 6. Write the fabric code to the behavioral spec given; do not fake canvas unit tests.

## File Structure

- `src/lib/whiteboard.ts` (NEW) — pure helpers: presets, history stack, preview filename, blank-scene check. Unit-tested.
- `src/lib/whiteboard.test.ts` (NEW) — its tests.
- `src/lib/types/canvas.ts` (MODIFY) — `ElementType` + `CanvasElement` fields + `createElement` case.
- `src/components/elements/PublicWhiteboardElement.tsx` (NEW) — read-only `<img>` render.
- `src/components/elements/PublicWhiteboardElement.test.tsx` (NEW).
- `src/components/elements/WhiteboardElement.tsx` (NEW) — fabric canvas lifecycle + persistence (editor).
- `src/components/elements/WhiteboardToolbar.tsx` (NEW) — the toolbar UI (keeps the element file focused).
- `src/components/elements/index.ts` (MODIFY) — barrel exports.
- `src/lib/render-elements.tsx` (MODIFY) — published-page case.
- `src/components/canvas/ColumnCanvas.tsx` (MODIFY) — editor switch case.
- `src/components/canvas/SlashCommandMenu.tsx` (MODIFY) — command entry + `pro?` flag + badge.
- `src/components/editor/PageEditor.tsx` (MODIFY) — Pro gate case.
- `package.json` (MODIFY) — add `fabric`.

---

### Task 1: Pure whiteboard helpers + tests

**Files:**
- Create: `src/lib/whiteboard.ts`
- Test: `src/lib/whiteboard.test.ts`

**Interfaces:**
- Produces:
  - `interface ArtboardPreset { label: string; width: number; height: number }`
  - `ARTBOARD_PRESETS: ArtboardPreset[]` — `[{label:'16:9',800,450},{label:'4:3',800,600},{label:'1:1',600,600}]`
  - `pushHistory(stack: string[], scene: string, cap?: number): string[]` — returns a new array with `scene` appended, trimmed to the last `cap` (default 50).
  - `previewFilename(elementId: string): string` — `` `whiteboard-${elementId}.png` ``
  - `isBlankScene(scene?: string): boolean` — true when undefined/empty/whitespace, or parses to JSON with an empty/absent `objects` array.

- [ ] **Step 1: Write the failing test**

Create `src/lib/whiteboard.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { ARTBOARD_PRESETS, pushHistory, previewFilename, isBlankScene } from './whiteboard'

describe('ARTBOARD_PRESETS', () => {
  it('has 16:9, 4:3, 1:1 with correct dimensions', () => {
    expect(ARTBOARD_PRESETS).toEqual([
      { label: '16:9', width: 800, height: 450 },
      { label: '4:3', width: 800, height: 600 },
      { label: '1:1', width: 600, height: 600 },
    ])
  })
})

describe('pushHistory', () => {
  it('appends and caps to the last N, dropping oldest', () => {
    const start = ['a', 'b', 'c']
    expect(pushHistory(start, 'd', 3)).toEqual(['b', 'c', 'd'])
    expect(start).toEqual(['a', 'b', 'c']) // immutable
  })
  it('keeps all when under cap', () => {
    expect(pushHistory(['a'], 'b', 50)).toEqual(['a', 'b'])
  })
})

describe('previewFilename', () => {
  it('builds a stable name from the element id', () => {
    expect(previewFilename('el-123')).toBe('whiteboard-el-123.png')
  })
})

describe('isBlankScene', () => {
  it('is true for empty/whitespace/undefined', () => {
    expect(isBlankScene(undefined)).toBe(true)
    expect(isBlankScene('')).toBe(true)
    expect(isBlankScene('   ')).toBe(true)
  })
  it('is true for a scene with no objects', () => {
    expect(isBlankScene(JSON.stringify({ version: '6', objects: [] }))).toBe(true)
  })
  it('is false for a scene with objects', () => {
    expect(isBlankScene(JSON.stringify({ objects: [{ type: 'rect' }] }))).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/whiteboard.test.ts`
Expected: FAIL — cannot resolve `./whiteboard`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/whiteboard.ts`:
```ts
// Pure helpers for the whiteboard element. No fabric / no DOM — unit-testable.

export interface ArtboardPreset {
  label: string
  width: number
  height: number
}

export const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { label: '16:9', width: 800, height: 450 },
  { label: '4:3', width: 800, height: 600 },
  { label: '1:1', width: 600, height: 600 },
]

// Append a scene snapshot to a bounded history stack (immutable).
export function pushHistory(stack: string[], scene: string, cap = 50): string[] {
  const next = [...stack, scene]
  return next.length > cap ? next.slice(next.length - cap) : next
}

// Stable Blob filename for an element's rendered PNG preview.
export function previewFilename(elementId: string): string {
  return `whiteboard-${elementId}.png`
}

// True when the scene has no drawable content (used to skip preview / render).
export function isBlankScene(scene?: string): boolean {
  if (!scene || !scene.trim()) return true
  try {
    const parsed = JSON.parse(scene) as { objects?: unknown[] }
    return !Array.isArray(parsed.objects) || parsed.objects.length === 0
  } catch {
    return true
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/lib/whiteboard.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard.ts src/lib/whiteboard.test.ts
git commit -m "feat(whiteboard): pure helpers (presets, history, preview name, blank check)"
```

---

### Task 2: Element type plumbing — `canvas.ts`

**Files:**
- Modify: `src/lib/types/canvas.ts` (ElementType union ~line 118; `CanvasElement` fields; `createElement` before `default:` ~line 1179)
- Test: `src/lib/types/canvas.whiteboard.test.ts`

**Interfaces:**
- Produces: `'whiteboard'` in `ElementType`; `CanvasElement` fields `whiteboardScene?`, `whiteboardWidth?`, `whiteboardHeight?`, `whiteboardBackground?: 'blank'|'grid'|'dots'`, `whiteboardPreviewUrl?`; `createElement('whiteboard')` default.

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/canvas.whiteboard.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('whiteboard')", () => {
  it('returns artboard defaults', () => {
    const el = createElement('whiteboard')
    expect(el.type).toBe('whiteboard')
    expect(el.whiteboardWidth).toBe(800)
    expect(el.whiteboardHeight).toBe(450)
    expect(el.whiteboardBackground).toBe('blank')
    expect(el.whiteboardScene).toBe('')
    expect(el.whiteboardPreviewUrl).toBe('')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/lib/types/canvas.whiteboard.test.ts`
Expected: FAIL — `whiteboardWidth` undefined (and a TS error on `'whiteboard'` until the union is updated).

- [ ] **Step 3: Add the union member**

In `src/lib/types/canvas.ts`, in the `ElementType` union just after the `'audio-player'` line (line ~118), add:
```ts
  | 'whiteboard'            // fabric.js fixed-artboard drawing surface (Pro)
```

- [ ] **Step 4: Add the `CanvasElement` fields**

In `src/lib/types/canvas.ts`, inside `interface CanvasElement`, after the audio-player fields block, add:
```ts
  // Whiteboard specific
  whiteboardScene?: string        // fabric.js canvas JSON (editable source of truth)
  whiteboardWidth?: number
  whiteboardHeight?: number
  whiteboardBackground?: 'blank' | 'grid' | 'dots'
  whiteboardPreviewUrl?: string   // rendered PNG (Blob URL) for the public page
```
(If you cannot locate the audio-player fields block, place this block immediately before the closing `}` of the `CanvasElement` interface. Do not disturb other fields.)

- [ ] **Step 5: Add the `createElement` case**

In `src/lib/types/canvas.ts`, in `createElement`, immediately before `default:` (line ~1179), add:
```ts
    case 'whiteboard':
      return {
        ...base,
        whiteboardScene: '',
        whiteboardWidth: 800,
        whiteboardHeight: 450,
        whiteboardBackground: 'blank',
        whiteboardPreviewUrl: '',
      }
```

- [ ] **Step 6: Run the test + typecheck**

Run: `pnpm exec vitest run src/lib/types/canvas.whiteboard.test.ts` → PASS.
Run: `pnpm exec tsc --noEmit` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/types/canvas.ts src/lib/types/canvas.whiteboard.test.ts
git commit -m "feat(whiteboard): add whiteboard element type + defaults"
```

---

### Task 3: Public component + published-page wiring + tests

**Files:**
- Create: `src/components/elements/PublicWhiteboardElement.tsx`
- Test: `src/components/elements/PublicWhiteboardElement.test.tsx`
- Modify: `src/components/elements/index.ts`
- Modify: `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `CanvasElement.whiteboardPreviewUrl/Width/Height`.
- Produces: `PublicWhiteboardElement({ element }: { element: CanvasElement })`.

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/PublicWhiteboardElement.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicWhiteboardElement } from './PublicWhiteboardElement'
import type { CanvasElement } from '@/lib/types/canvas'

const base: CanvasElement = { id: 'w1', type: 'whiteboard', whiteboardWidth: 800, whiteboardHeight: 450 }

describe('PublicWhiteboardElement', () => {
  it('renders an img with the preview url', () => {
    render(<PublicWhiteboardElement element={{ ...base, whiteboardPreviewUrl: 'https://blob/x.png' }} />)
    const img = screen.getByRole('img')
    expect(img).toHaveAttribute('src', 'https://blob/x.png')
  })
  it('renders nothing when there is no preview', () => {
    const { container } = render(<PublicWhiteboardElement element={{ ...base, whiteboardPreviewUrl: '' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run src/components/elements/PublicWhiteboardElement.test.tsx`
Expected: FAIL — cannot resolve `./PublicWhiteboardElement`.

- [ ] **Step 3: Write the component**

Create `src/components/elements/PublicWhiteboardElement.tsx`:
```tsx
import type { CanvasElement } from '@/lib/types/canvas'

// Public render is a plain image of the owner's board — no fabric ships here.
export function PublicWhiteboardElement({ element }: { element: CanvasElement }) {
  const src = element.whiteboardPreviewUrl
  if (!src) return null
  const w = element.whiteboardWidth || 800
  const h = element.whiteboardHeight || 450
  return (
    <div className="w-full overflow-hidden rounded-lg border border-border/50">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Whiteboard"
        width={w}
        height={h}
        className="block w-full h-auto"
        style={{ aspectRatio: `${w} / ${h}` }}
      />
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run src/components/elements/PublicWhiteboardElement.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire barrel export**

In `src/components/elements/index.ts`, after the audio/live-feed exports (line ~89), add:
```ts
export { PublicWhiteboardElement } from './PublicWhiteboardElement'
export { WhiteboardElement } from './WhiteboardElement'
```
(`WhiteboardElement` is created in Task 4. If executing strictly in order and Task 4 isn't done, add only the `PublicWhiteboardElement` line now and add the `WhiteboardElement` line in Task 4 Step 6.)

- [ ] **Step 6: Wire the published-page renderer**

In `src/lib/render-elements.tsx`: after the `PublicAudioPlayerElement` import (line ~56), add:
```ts
import { PublicWhiteboardElement } from '@/components/elements/PublicWhiteboardElement'
```
Then in the `renderElement` switch, after the `case 'audio-player':` block (line ~546), add:
```tsx
    case 'whiteboard':
      return <PublicWhiteboardElement element={element} />
```

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm exec tsc --noEmit` → no errors.
```bash
git add src/components/elements/PublicWhiteboardElement.tsx src/components/elements/PublicWhiteboardElement.test.tsx src/components/elements/index.ts src/lib/render-elements.tsx
git commit -m "feat(whiteboard): public PNG renderer + published-page wiring"
```

---

### Task 4: Editor component core — fabric canvas + persistence (pen/select/baseline)

> **This is a fabric UI task — not unit-testable under jsdom. Gate = `tsc --noEmit` clean. Behavior is verified in Task 6's manual smoke.** Write real fabric v6 code to the spec below.

**Files:**
- Modify: `package.json` (add `fabric`)
- Create: `src/components/elements/WhiteboardElement.tsx`
- Create: `src/components/elements/WhiteboardToolbar.tsx`
- Modify: `src/components/canvas/ColumnCanvas.tsx` (imports + `renderElement` switch)
- Modify: `src/components/elements/index.ts` (add `WhiteboardElement` export if not added in Task 3)

**Interfaces:**
- Consumes: `CanvasElement` whiteboard fields; `ARTBOARD_PRESETS`, `pushHistory`, `previewFilename`, `isBlankScene` (`@/lib/whiteboard`).
- Produces:
  - `WhiteboardElement({ element, onChange, onDelete, isSelected, onSelect })` — `onChange(updates: Partial<CanvasElement>)`.
  - `WhiteboardToolbar` props (see Step 3): `{ tool, onToolChange, strokeColor, fillColor, strokeWidth, onStyleChange, background, onBackgroundChange, preset, onPresetChange, onUndo, onRedo, onClear, onDeleteSelection, onAddImage }`.
  - `WhiteboardTool = 'select' | 'pen' | 'highlighter' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'sticky' | 'image'` (defined and exported from `WhiteboardToolbar.tsx`, imported by `WhiteboardElement.tsx`; Task 5 uses the shape/text/sticky/image members).

- [ ] **Step 1: Add fabric**

Run:
```bash
pnpm add fabric
pnpm exec tsc --noEmit
```
Expected: fabric v6.x added to `package.json` dependencies; tsc still clean (fabric ships its own types).

- [ ] **Step 2: Create the toolbar component**

Create `src/components/elements/WhiteboardToolbar.tsx`. It is a controlled, presentational toolbar (no fabric). Export a `WhiteboardTool` type re-used by the element. Include buttons for: select, pen, highlighter, rect, ellipse, line, arrow, text, sticky, image (image triggers a hidden file input calling `onAddImage(file)`); stroke color (`<input type=color>`), fill color + "no fill" toggle, stroke width (range); undo, redo, clear, delete-selection; a background select (blank/grid/dots) and an artboard preset select driven by `ARTBOARD_PRESETS`. Use lucide icons already used elsewhere (e.g. `MousePointer2, Pen, Highlighter, Square, Circle, Minus, ArrowRight, Type, StickyNote, ImageIcon, Undo2, Redo2, Trash2, X`). Full props per the Interfaces block. Styling: a horizontal wrap bar with `rounded-md border bg-surface` buttons, active tool highlighted with `bg-primary text-white`.

```tsx
'use client'
import { useRef } from 'react'
import {
  MousePointer2, Pen, Highlighter, Square, Circle, Minus, ArrowRight,
  Type, StickyNote, Image as ImageIcon, Undo2, Redo2, Trash2, X,
} from 'lucide-react'
import { ARTBOARD_PRESETS } from '@/lib/whiteboard'

export type WhiteboardTool =
  | 'select' | 'pen' | 'highlighter' | 'rect' | 'ellipse' | 'line' | 'arrow'
  | 'text' | 'sticky' | 'image'

interface Props {
  tool: WhiteboardTool
  onToolChange: (t: WhiteboardTool) => void
  strokeColor: string
  fillColor: string | null
  strokeWidth: number
  onStyleChange: (s: { strokeColor?: string; fillColor?: string | null; strokeWidth?: number }) => void
  background: 'blank' | 'grid' | 'dots'
  onBackgroundChange: (b: 'blank' | 'grid' | 'dots') => void
  presetLabel: string
  onPresetChange: (label: string) => void
  onUndo: () => void
  onRedo: () => void
  onClear: () => void
  onDeleteSelection: () => void
  onAddImage: (file: File) => void
}

const TOOLS: { id: WhiteboardTool; icon: typeof Pen; title: string }[] = [
  { id: 'select', icon: MousePointer2, title: 'Select' },
  { id: 'pen', icon: Pen, title: 'Pen' },
  { id: 'highlighter', icon: Highlighter, title: 'Highlighter' },
  { id: 'rect', icon: Square, title: 'Rectangle' },
  { id: 'ellipse', icon: Circle, title: 'Ellipse' },
  { id: 'line', icon: Minus, title: 'Line' },
  { id: 'arrow', icon: ArrowRight, title: 'Arrow' },
  { id: 'text', icon: Type, title: 'Text' },
  { id: 'sticky', icon: StickyNote, title: 'Sticky note' },
  { id: 'image', icon: ImageIcon, title: 'Image' },
]

export function WhiteboardToolbar(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-surface p-1.5 mb-2">
      {TOOLS.map(({ id, icon: Icon, title }) => (
        <button
          key={id} title={title} type="button"
          onClick={() => { if (id === 'image') fileRef.current?.click(); else props.onToolChange(id) }}
          className={`p-1.5 rounded-md ${props.tool === id ? 'bg-primary text-white' : 'hover:bg-muted'}`}
        ><Icon className="w-4 h-4" /></button>
      ))}
      <span className="mx-1 h-5 w-px bg-border" />
      <input type="color" title="Stroke" value={props.strokeColor}
        onChange={(e) => props.onStyleChange({ strokeColor: e.target.value })} className="h-7 w-7 rounded" />
      <input type="color" title="Fill" value={props.fillColor ?? '#ffffff'}
        onChange={(e) => props.onStyleChange({ fillColor: e.target.value })} className="h-7 w-7 rounded" />
      <button type="button" title="No fill" onClick={() => props.onStyleChange({ fillColor: null })}
        className={`p-1.5 rounded-md ${props.fillColor === null ? 'bg-primary text-white' : 'hover:bg-muted'}`}><X className="w-4 h-4" /></button>
      <input type="range" min={1} max={24} value={props.strokeWidth} title="Stroke width"
        onChange={(e) => props.onStyleChange({ strokeWidth: Number(e.target.value) })} className="w-20" />
      <span className="mx-1 h-5 w-px bg-border" />
      <button type="button" title="Undo" onClick={props.onUndo} className="p-1.5 rounded-md hover:bg-muted"><Undo2 className="w-4 h-4" /></button>
      <button type="button" title="Redo" onClick={props.onRedo} className="p-1.5 rounded-md hover:bg-muted"><Redo2 className="w-4 h-4" /></button>
      <button type="button" title="Delete selection" onClick={props.onDeleteSelection} className="p-1.5 rounded-md hover:bg-muted"><Trash2 className="w-4 h-4" /></button>
      <button type="button" title="Clear board" onClick={props.onClear} className="p-1.5 rounded-md text-xs hover:bg-muted">Clear</button>
      <span className="mx-1 h-5 w-px bg-border" />
      <select value={props.background} onChange={(e) => props.onBackgroundChange(e.target.value as 'blank'|'grid'|'dots')}
        className="text-xs rounded-md border border-border bg-surface px-1 py-1" title="Background">
        <option value="blank">Blank</option><option value="grid">Grid</option><option value="dots">Dots</option>
      </select>
      <select value={props.presetLabel} onChange={(e) => props.onPresetChange(e.target.value)}
        className="text-xs rounded-md border border-border bg-surface px-1 py-1" title="Size">
        {ARTBOARD_PRESETS.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
      </select>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) props.onAddImage(f); e.currentTarget.value = '' }} />
    </div>
  )
}
```

- [ ] **Step 3: Create the editor element (fabric lifecycle + persistence + pen/select/baseline)**

Create `src/components/elements/WhiteboardElement.tsx`. Responsibilities for THIS task: lazy-load fabric; mount a `Canvas` at the artboard size; load `whiteboardScene`; apply background (blank/grid/dots via a canvas `backgroundColor` + a lightweight pattern for grid/dots); implement **select**, **pen**, **highlighter** tools, **delete selection**, **undo/redo** (history via `pushHistory`), **clear**, **background** change, **size preset** change, and the **image** upload handler (adds a `FabricImage`); wire **persistence**: a debounced `persist()` that saves the scene JSON via `onChange({ whiteboardScene })` and regenerates+uploads the PNG preview via `onChange({ whiteboardPreviewUrl })`. Leave shape/text/sticky tool handlers as no-ops with a `// Task 5` marker (Task 5 fills them). Use fabric v6 API (`Canvas`, `PencilBrush`, `FabricImage`, `ActiveSelection`, `util`). Concrete implementation:

```tsx
'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Trash2 } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { ARTBOARD_PRESETS, pushHistory, previewFilename, isBlankScene } from '@/lib/whiteboard'
import { WhiteboardToolbar, type WhiteboardTool } from './WhiteboardToolbar'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

async function uploadDataUrl(dataUrl: string, filename: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob()
  const fd = new FormData()
  fd.append('file', new File([blob], filename, { type: 'image/png' }))
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  return (await res.json()).url as string
}

async function uploadImageFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await fetch('/api/upload', { method: 'POST', body: fd })
  if (!res.ok) throw new Error('upload failed')
  return (await res.json()).url as string
}

export function WhiteboardElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null)
  // fabric Canvas instance (typed loosely to avoid a static fabric import at module scope)
  const fabricRef = useRef<any>(null)
  const fabricLibRef = useRef<any>(null)
  const historyRef = useRef<string[]>([])
  const redoRef = useRef<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [tool, setTool] = useState<WhiteboardTool>('select')
  const [strokeColor, setStrokeColor] = useState('#111111')
  const [fillColor, setFillColor] = useState<string | null>('#39D98A')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [background, setBackground] = useState<'blank'|'grid'|'dots'>(element.whiteboardBackground || 'blank')
  const [presetLabel, setPresetLabel] = useState(
    ARTBOARD_PRESETS.find((p) => p.width === element.whiteboardWidth && p.height === element.whiteboardHeight)?.label
    || ARTBOARD_PRESETS[0].label
  )

  const width = element.whiteboardWidth || 800
  const height = element.whiteboardHeight || 450

  // Debounced persist: scene JSON + regenerated PNG preview.
  const persist = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const canvas = fabricRef.current
      if (!canvas) return
      const scene = JSON.stringify(canvas.toJSON())
      onChange({ whiteboardScene: scene })
      if (isBlankScene(scene)) { onChange({ whiteboardPreviewUrl: '' }); return }
      try {
        const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 2 })
        const url = await uploadDataUrl(dataUrl, previewFilename(element.id))
        onChange({ whiteboardPreviewUrl: url })
      } catch { /* keep previous preview on failure */ }
    }, 600)
  }, [element.id, onChange])

  const snapshot = useCallback(() => {
    const canvas = fabricRef.current
    if (!canvas) return
    historyRef.current = pushHistory(historyRef.current, JSON.stringify(canvas.toJSON()))
    redoRef.current = []
    persist()
  }, [persist])

  // Mount fabric once.
  useEffect(() => {
    let disposed = false
    ;(async () => {
      const fabric = await import('fabric')
      if (disposed || !canvasElRef.current) return
      fabricLibRef.current = fabric
      const canvas = new fabric.Canvas(canvasElRef.current, { width, height, backgroundColor: '#ffffff' })
      fabricRef.current = canvas
      if (!isBlankScene(element.whiteboardScene)) {
        await canvas.loadFromJSON(element.whiteboardScene!)
        canvas.renderAll()
      }
      historyRef.current = [JSON.stringify(canvas.toJSON())]
      applyBackground(canvas, fabric, background, width, height)
      canvas.on('object:added', snapshot)
      canvas.on('object:modified', snapshot)
      canvas.on('object:removed', snapshot)
      canvas.on('path:created', snapshot)
    })()
    return () => {
      disposed = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      fabricRef.current?.dispose?.()
      fabricRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tool → fabric drawing mode.
  useEffect(() => {
    const canvas = fabricRef.current
    const fabric = fabricLibRef.current
    if (!canvas || !fabric) return
    canvas.isDrawingMode = tool === 'pen' || tool === 'highlighter'
    canvas.selection = tool === 'select'
    if (canvas.isDrawingMode) {
      const brush = new fabric.PencilBrush(canvas)
      brush.color = tool === 'highlighter' ? hexToRgba(strokeColor, 0.35) : strokeColor
      brush.width = tool === 'highlighter' ? strokeWidth * 4 : strokeWidth
      canvas.freeDrawingBrush = brush
    }
    // Shape/text/sticky pointer handlers are added in Task 5.
  }, [tool, strokeColor, strokeWidth])

  const onStyleChange = (s: { strokeColor?: string; fillColor?: string | null; strokeWidth?: number }) => {
    if (s.strokeColor !== undefined) setStrokeColor(s.strokeColor)
    if (s.fillColor !== undefined) setFillColor(s.fillColor)
    if (s.strokeWidth !== undefined) setStrokeWidth(s.strokeWidth)
    // Apply to the active object if any.
    const canvas = fabricRef.current
    const obj = canvas?.getActiveObject()
    if (obj) {
      if (s.strokeColor !== undefined) obj.set('stroke', s.strokeColor)
      if (s.fillColor !== undefined) obj.set('fill', s.fillColor ?? 'transparent')
      if (s.strokeWidth !== undefined) obj.set('strokeWidth', s.strokeWidth)
      canvas.renderAll(); snapshot()
    }
  }

  const deleteSelection = () => {
    const canvas = fabricRef.current
    canvas?.getActiveObjects()?.forEach((o: any) => canvas.remove(o))
    canvas?.discardActiveObject(); canvas?.renderAll()
  }
  const undo = () => {
    const canvas = fabricRef.current
    if (!canvas || historyRef.current.length < 2) return
    const cur = historyRef.current[historyRef.current.length - 1]
    redoRef.current = [...redoRef.current, cur]
    historyRef.current = historyRef.current.slice(0, -1)
    canvas.loadFromJSON(historyRef.current[historyRef.current.length - 1]).then(() => canvas.renderAll())
    persist()
  }
  const redo = () => {
    const canvas = fabricRef.current
    if (!canvas || redoRef.current.length === 0) return
    const scene = redoRef.current[redoRef.current.length - 1]
    redoRef.current = redoRef.current.slice(0, -1)
    historyRef.current = pushHistory(historyRef.current, scene)
    canvas.loadFromJSON(scene).then(() => canvas.renderAll())
    persist()
  }
  const clear = () => {
    const canvas = fabricRef.current
    if (!canvas) return
    canvas.getObjects().slice().forEach((o: any) => canvas.remove(o))
    canvas.renderAll(); snapshot()
  }
  const changeBackground = (b: 'blank'|'grid'|'dots') => {
    setBackground(b); onChange({ whiteboardBackground: b })
    const canvas = fabricRef.current, fabric = fabricLibRef.current
    if (canvas && fabric) { applyBackground(canvas, fabric, b, width, height); persist() }
  }
  const changePreset = (label: string) => {
    const p = ARTBOARD_PRESETS.find((x) => x.label === label); if (!p) return
    setPresetLabel(label); onChange({ whiteboardWidth: p.width, whiteboardHeight: p.height })
    const canvas = fabricRef.current
    if (canvas) { canvas.setDimensions({ width: p.width, height: p.height }); canvas.renderAll(); persist() }
  }
  const addImage = async (file: File) => {
    const canvas = fabricRef.current, fabric = fabricLibRef.current
    if (!canvas || !fabric) return
    try {
      const url = await uploadImageFile(file)
      const img = await fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' })
      img.scaleToWidth(Math.min(300, width / 2))
      canvas.add(img); canvas.setActiveObject(img); canvas.renderAll()
    } catch { /* ignore */ }
  }

  return (
    <div onClick={onSelect} className={`relative rounded-xl border-2 p-2 ${isSelected ? 'border-primary' : 'border-transparent hover:border-border'}`}>
      <WhiteboardToolbar
        tool={tool} onToolChange={setTool}
        strokeColor={strokeColor} fillColor={fillColor} strokeWidth={strokeWidth} onStyleChange={onStyleChange}
        background={background} onBackgroundChange={changeBackground}
        presetLabel={presetLabel} onPresetChange={changePreset}
        onUndo={undo} onRedo={redo} onClear={clear} onDeleteSelection={deleteSelection} onAddImage={addImage}
      />
      <div className="overflow-auto">
        <canvas ref={canvasElRef} className="border border-border rounded-md" />
      </div>
      <button aria-label="Delete element" onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
    </div>
  )
}

// --- helpers (module-local, no React) ---
function hexToRgba(hex: string, a: number): string {
  const m = hex.replace('#', '')
  const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}
function applyBackground(canvas: any, fabric: any, kind: 'blank'|'grid'|'dots', w: number, h: number) {
  if (kind === 'blank') { canvas.backgroundColor = '#ffffff'; canvas.renderAll(); return }
  // Build a small repeating pattern tile via an offscreen canvas.
  const tile = document.createElement('canvas'); tile.width = 20; tile.height = 20
  const ctx = tile.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 20, 20)
  ctx.fillStyle = '#e2e8f0'
  if (kind === 'grid') { ctx.strokeStyle = '#e2e8f0'; ctx.strokeRect(0, 0, 20, 20) }
  else { ctx.beginPath(); ctx.arc(10, 10, 1.5, 0, Math.PI * 2); ctx.fill() }
  canvas.backgroundColor = new fabric.Pattern({ source: tile, repeat: 'repeat' })
  canvas.renderAll()
}
```

- [ ] **Step 4: Wire the editor switch in `ColumnCanvas`**

In `src/components/canvas/ColumnCanvas.tsx`, add `WhiteboardElement` and `PublicWhiteboardElement` to the imports from `@/components/elements` (near the audio-player imports). Then in the `renderElement` switch, after the `case 'audio-player':` block (line ~1160), add:
```tsx
      case 'whiteboard':
        if (isPreviewMode) return <PublicWhiteboardElement element={element} />
        return (
          <WhiteboardElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```
(Match the exact prop-passing style of the `audio-player` case in this file. If `PublicWhiteboardElement` is already imported for the preview branch, don't duplicate the import.)

- [ ] **Step 5: Ensure the `WhiteboardElement` barrel export exists**

Confirm `src/components/elements/index.ts` has `export { WhiteboardElement } from './WhiteboardElement'` (add if Task 3 deferred it).

- [ ] **Step 6: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors. (Do NOT expect unit tests — this is canvas UI.)

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/elements/WhiteboardElement.tsx src/components/elements/WhiteboardToolbar.tsx src/components/canvas/ColumnCanvas.tsx src/components/elements/index.ts
git commit -m "feat(whiteboard): editor element (fabric canvas, pen/select, persistence, PNG preview)"
```

---

### Task 5: Shape / text / sticky-note tool handlers

> Fabric UI task — gate is `tsc --noEmit` clean + Task 6 smoke. Extends `WhiteboardElement.tsx` only.

**Files:**
- Modify: `src/components/elements/WhiteboardElement.tsx`

**Interfaces:**
- Consumes: the `tool`/style state and `fabricRef`/`fabricLibRef`/`snapshot` from Task 4.
- Produces: pointer-driven creation for `rect`, `ellipse`, `line`, `arrow`, `text`, `sticky`.

- [ ] **Step 1: Add shape/text/sticky creation**

In `WhiteboardElement.tsx`, replace the Task-4 tool `useEffect` comment (`// Shape/text/sticky pointer handlers are added in Task 5.`) with mouse-driven object creation. On `mouse:down` in a shape tool, create the object; for drag shapes (rect/ellipse/line/arrow) update size on `mouse:move` and finalize on `mouse:up`; for `text` add an editable `Textbox` at the click point and enter editing; for `sticky` add a filled rounded rect group with a `Textbox`. Use current `strokeColor`/`fillColor`/`strokeWidth`. After finalizing, switch `tool` back to `'select'` and call `snapshot()`. Concrete implementation (fabric v6):

```tsx
  // Replace the Task-4 placeholder comment block with:
  useEffect(() => {
    const canvas = fabricRef.current
    const fabric = fabricLibRef.current
    if (!canvas || !fabric) return
    if (['pen', 'highlighter', 'select'].includes(tool)) return

    let obj: any = null
    let start = { x: 0, y: 0 }
    const fill = fillColor ?? 'transparent'

    const onDown = (opt: any) => {
      const p = canvas.getScenePoint(opt.e)
      start = { x: p.x, y: p.y }
      if (tool === 'rect') obj = new fabric.Rect({ left: p.x, top: p.y, width: 1, height: 1, fill, stroke: strokeColor, strokeWidth })
      else if (tool === 'ellipse') obj = new fabric.Ellipse({ left: p.x, top: p.y, rx: 1, ry: 1, fill, stroke: strokeColor, strokeWidth })
      else if (tool === 'line' || tool === 'arrow') obj = new fabric.Line([p.x, p.y, p.x, p.y], { stroke: strokeColor, strokeWidth })
      else if (tool === 'text') {
        obj = new fabric.Textbox('Text', { left: p.x, top: p.y, fontSize: 24, fill: strokeColor, width: 160 })
        canvas.add(obj); canvas.setActiveObject(obj); obj.enterEditing?.(); setTool('select'); return
      } else if (tool === 'sticky') {
        const bg = new fabric.Rect({ width: 160, height: 160, rx: 8, ry: 8, fill: fillColor ?? '#FEF08A' })
        const txt = new fabric.Textbox('Note', { width: 140, fontSize: 18, fill: '#111111', left: 10, top: 10 })
        obj = new fabric.Group([bg, txt], { left: p.x, top: p.y })
        canvas.add(obj); canvas.setActiveObject(obj); setTool('select'); snapshot(); return
      }
      if (obj) canvas.add(obj)
    }
    const onMove = (opt: any) => {
      if (!obj) return
      const p = canvas.getScenePoint(opt.e)
      if (tool === 'rect') obj.set({ width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y), left: Math.min(p.x, start.x), top: Math.min(p.y, start.y) })
      else if (tool === 'ellipse') obj.set({ rx: Math.abs(p.x - start.x) / 2, ry: Math.abs(p.y - start.y) / 2, left: Math.min(p.x, start.x), top: Math.min(p.y, start.y) })
      else if (tool === 'line' || tool === 'arrow') obj.set({ x2: p.x, y2: p.y })
      canvas.renderAll()
    }
    const onUp = () => {
      if (obj && (tool === 'arrow')) {
        // add a simple arrowhead as a triangle at the line end
        const triangle = new fabric.Triangle({
          left: obj.x2, top: obj.y2, width: strokeWidth * 4, height: strokeWidth * 4,
          fill: strokeColor, angle: (Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1) * 180) / Math.PI + 90,
          originX: 'center', originY: 'center',
        })
        canvas.add(triangle)
      }
      obj = null
      setTool('select')
      snapshot()
    }
    canvas.on('mouse:down', onDown)
    canvas.on('mouse:move', onMove)
    canvas.on('mouse:up', onUp)
    return () => { canvas.off('mouse:down', onDown); canvas.off('mouse:move', onMove); canvas.off('mouse:up', onUp) }
  }, [tool, strokeColor, fillColor, strokeWidth, snapshot])
```

- [ ] **Step 2: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/elements/WhiteboardElement.tsx
git commit -m "feat(whiteboard): shape, line, arrow, text, and sticky-note tools"
```

---

### Task 6: Slash-menu entry + Pro gate + full verification

**Files:**
- Modify: `src/components/canvas/SlashCommandMenu.tsx` (Command type + entry + Pro badge)
- Modify: `src/components/editor/PageEditor.tsx` (`handleCommandSelect` Pro-gate case)
- Test: `src/components/canvas/SlashCommandMenu.whiteboard.test.tsx` (the entry is `pro: true`)

**Interfaces:**
- Consumes: existing `isPro`/`useAuthStore`/`setUpgradeOpen` in `PageEditor`.
- Produces: a slash-menu `whiteboard` command (`pro: true`) and an insertion Pro gate.

- [ ] **Step 1: Add `pro?` to the Command type + the entry**

In `src/components/canvas/SlashCommandMenu.tsx`, add `pro?: boolean` to the `Command` interface (after `disabledLabel?`). Then add to the `commands` array in the **Media** group (near the `image`/`embed`/`slideshow` entries), importing `PenTool` from `lucide-react`:
```ts
  { id: 'whiteboard', label: 'Whiteboard', icon: PenTool, description: 'Draw & design on a board', category: 'Media', pro: true },
```

- [ ] **Step 2: Render a Pro badge**

In the command render (the `column.cmds.map(...)` normal/non-disabled branch, near the `disabledLabel` badge at line ~323), add, inside the rendered command row:
```tsx
{cmd.pro && (
  <span className="ml-auto text-[10px] font-semibold text-galli-violet bg-galli-violet/10 px-1.5 py-0.5 rounded-full">Pro</span>
)}
```
Place it so it mirrors how `disabledLabel` is positioned (right-aligned). Ensure it doesn't collide with the `disabledLabel` span (whiteboard is not disabled, so only the Pro badge shows).

- [ ] **Step 3: Write the failing test**

Create `src/components/canvas/SlashCommandMenu.whiteboard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SlashCommandMenu } from './SlashCommandMenu'

describe('SlashCommandMenu whiteboard entry', () => {
  it('shows the Whiteboard command with a Pro badge', () => {
    render(<SlashCommandMenu position={{ top: 0, left: 0 }} onSelect={() => {}} onClose={() => {}} />)
    expect(screen.getByText('Whiteboard')).toBeInTheDocument()
    // Pro badge rendered somewhere in the menu
    expect(screen.getAllByText('Pro').length).toBeGreaterThan(0)
  })
})
```
(If `SlashCommandMenu` requires additional required props, pass minimal valid values matching its current prop types — check the component signature.)

- [ ] **Step 4: Run the test**

Run: `pnpm exec vitest run src/components/canvas/SlashCommandMenu.whiteboard.test.tsx`
Expected: PASS (after Steps 1-2 are in place). If it fails because the menu needs more props, fix the test props to satisfy the component's actual signature, not the component.

- [ ] **Step 5: Add the Pro-gate case in `handleCommandSelect`**

In `src/components/editor/PageEditor.tsx`, in the `handleCommandSelect` switch (before `default:`), add:
```ts
      case 'whiteboard':
        if (!isPro(user)) { setShowSlashMenu(false); setUpgradeOpen(true); return }
        Object.assign(newElement, createElement('whiteboard'))
        break
```
(This mirrors the `card` gate but, on success, falls through to the shared insertion below the switch rather than returning. `user`, `isPro`, `setUpgradeOpen`, `setShowSlashMenu` are already in scope.)

- [ ] **Step 6: Typecheck + full suite**

Run: `pnpm exec tsc --noEmit` → no errors.
Run: `pnpm test` → all tests pass (including the new whiteboard tests).

- [ ] **Step 7: Manual browser smoke (record results in the commit message / PR)**

Start dev (`DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" pnpm dev`), sign in as a **Pro** user (`plan='pro'` in DB), open a page in the editor, and verify:
1. Slash menu shows **Whiteboard** with a **Pro** badge.
2. As a **free** user, selecting Whiteboard shows the upgrade prompt (no insert).
3. As Pro: insert a whiteboard; draw with pen + highlighter; add a rectangle, ellipse, line, arrow; add text and a sticky note; upload an image; move/resize/delete objects; undo/redo; change background (grid/dots) and size preset.
4. Reload the editor — the board persists (scene restored).
5. Publish the page — the public URL shows the board as an image matching the drawing.
6. Confirm the public page network tab does **not** load fabric (only the PNG).

- [ ] **Step 8: Commit**

```bash
git add src/components/canvas/SlashCommandMenu.tsx src/components/canvas/SlashCommandMenu.whiteboard.test.tsx src/components/editor/PageEditor.tsx
git commit -m "feat(whiteboard): slash-menu entry + Pro badge + insertion gate"
```

---

## Self-Review notes (for the executor)

- fabric v6 API names used: `Canvas`, `PencilBrush`, `FabricImage.fromURL`, `Rect`, `Ellipse`, `Line`, `Triangle`, `Textbox`, `Group`, `Pattern`, `canvas.getScenePoint`, `canvas.toJSON`, `canvas.loadFromJSON` (returns a Promise in v6), `canvas.toDataURL`. If the installed fabric version differs, adapt these call sites to the installed API (they are isolated to `WhiteboardElement.tsx`), keep behavior identical, and note the change in your report.
- The `whiteboardScene` is saved via the element's normal `onChange` → it flows into `Display.sections` through the existing editor save (Display `PATCH`); no new API is needed.
- Preview PNGs and board images both use the existing `/api/upload` (Blob, ≤10MB). A 2× PNG of an 800×450 board is well under the limit.

## Deferred (NOT in this plan)

Infinite canvas; smart connectors; templates; layers panel; real-time collaboration; visitor drawing; on-board comments; downloadable export; frames.
