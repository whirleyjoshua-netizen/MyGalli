# Flowchart / Workflow Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `flowchart` page element: the owner builds a branching tree of blocks in an auto-layout builder (no dragging); each block can link to a page, board, or external URL; public visitors click blocks to see details and open links.

**Architecture:** Everything lives in the element JSON (`Display.sections`) — no new DB tables or element API. A pure tidy-tree layout function (`src/lib/flowchart-layout.ts`) positions nodes from their `parentId` (a tree; branches split, never rejoin). The public component renders positioned cards + an SVG arrow overlay; the editor is a block list with a parent dropdown, a link picker (over existing `GET /api/displays`), and a live preview.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest + Testing Library. No new dependencies.

## Global Constraints

- Package manager **pnpm**. This plan adds **NO new dependencies** — do not run `pnpm install`.
- All flow data lives in the element JSON on `CanvasElement`; **no new Prisma models, no new migration, no new API routes**.
- Flow shape is a **branching tree / forest**: each node has ≤ 1 parent (`parentId`); branches do **not** rejoin; cycles are prevented in the editor and defended against in layout.
- **Link safety:** external URLs pass through `safeHref` (`src/lib/editor/safe-href.ts`) — only `http(s)`, `mailto`, or root-relative accepted; external links render with `target="_blank" rel="noopener noreferrer"`. Internal links are root-relative `/{username}/{slug}`.
- Standard add-an-element seams; **no `PageEditor` edit** (its `default:` case delegates to `createElement()`).
- Editor components are `'use client'`, standard props `{ element, onChange, onDelete, isSelected, onSelect }`; public components take `{ element }`.
- Verify with `npx tsc --noEmit` + `npx vitest run <file>`. Don't run `pnpm build` while a dev server runs (Windows `.next` race).
- Commit after each task.

---

## File Structure

**Create:**
- `src/lib/flowchart-layout.ts` — pure `layoutFlow` + `descendantIds` (imports `FlowNode` type from canvas).
- `src/lib/flowchart-layout.test.ts` — layout + descendant unit tests.
- `src/components/elements/PublicFlowchartElement.tsx` — public renderer (cards + SVG arrows + detail popover).
- `src/components/elements/PublicFlowchartElement.test.tsx`
- `src/components/elements/FlowLinkPicker.tsx` — link picker over `GET /api/displays` + external URL.
- `src/components/elements/FlowLinkPicker.test.tsx`
- `src/components/elements/FlowchartElement.tsx` — editor (block list, parent dropdown, branch label, preview).
- `src/components/elements/FlowchartElement.test.tsx`

**Modify:**
- `src/lib/types/canvas.ts` — `FlowNode` interface, `flow*` fields, `ElementType 'flowchart'`, `createElement` default.
- `src/components/canvas/SlashCommandMenu.tsx` — menu entry (Data & Visuals).
- `src/components/canvas/ColumnCanvas.tsx` — `renderElement` case.
- `src/components/elements/index.ts` — exports.
- `src/lib/render-elements.tsx` — published-page case.

---

## Task 1: Element type, `FlowNode`, fields, and default

**Files:**
- Modify: `src/lib/types/canvas.ts` (union; a new `FlowNode` interface; `CanvasElement` fields; `createElement` case)

**Interfaces:**
- Produces: `interface FlowNode { id; title; description?; icon?; color?; linkUrl?; linkLabel?; parentId?; branchLabel? }`; `ElementType` includes `'flowchart'`; `CanvasElement` gains `flowTitle?: string` and `flowNodes?: FlowNode[]`; `createElement('flowchart')` returns one root node titled "Start".

- [ ] **Step 1: Add the `FlowNode` interface**

Near the top of `src/lib/types/canvas.ts`, after the `TextStyle` interface/`getTextStyles` block (~line 30), add:

```ts
// Flowchart element — a branching tree of linked blocks (all in element JSON)
export interface FlowNode {
  id: string
  title: string
  description?: string
  icon?: string          // single emoji, optional
  color?: string         // accent color, optional
  linkUrl?: string       // resolved destination: root-relative internal, or http(s)/mailto external
  linkLabel?: string     // friendly label for the picked target
  parentId?: string      // the block this one follows; undefined = a root
  branchLabel?: string   // optional label on the arrow from parent → this node
}
```

- [ ] **Step 2: Add `'flowchart'` to the `ElementType` union**

In the `ElementType` union, after the `'live-feed'` entry, add:

```ts
  | 'flowchart'    // Branching workflow/flowchart of linked blocks
```

- [ ] **Step 3: Add the fields to `CanvasElement`**

After the live-feed fields block (the `liveFeedColor?: string` line), add:

```ts
  // Flowchart specific (branching tree of linked blocks; all in element JSON)
  flowTitle?: string
  flowNodes?: FlowNode[]
```

- [ ] **Step 4: Add the `createElement` default**

In the `createElement` switch, after the `case 'live-feed':` return block, add:

```ts
    case 'flowchart':
      return {
        ...base,
        flowTitle: 'Workflow',
        flowNodes: [
          { id: `fn-${Date.now()}-start`, title: 'Start' },
        ],
      }
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean (the render switches have `default` cases, so the new union member compiles without the later tasks' cases).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/canvas.ts
git commit -m "feat(flowchart): element type, FlowNode, fields, and createElement default"
```

---

## Task 2: Pure layout engine + descendant helper

**Files:**
- Create: `src/lib/flowchart-layout.ts`
- Test: `src/lib/flowchart-layout.test.ts`

**Interfaces:**
- Consumes: `FlowNode` (Task 1).
- Produces:
  - `layoutFlow(nodes: FlowNode[], opts?): FlowLayout` where
    `FlowLayout = { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number }`,
    `LaidOutNode = { id: string; x: number; y: number; w: number; h: number; node: FlowNode }`,
    `LaidOutEdge = { fromId: string; toId: string; label?: string; x1; y1; x2; y2 }`.
  - `descendantIds(nodes: FlowNode[], id: string): Set<string>`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/flowchart-layout.test.ts
import { describe, it, expect } from 'vitest'
import { layoutFlow, descendantIds } from './flowchart-layout'
import type { FlowNode } from './types/canvas'

const n = (id: string, parentId?: string, extra: Partial<FlowNode> = {}): FlowNode =>
  ({ id, title: id, parentId, ...extra })

describe('descendantIds', () => {
  it('collects all descendants, not the node itself', () => {
    const nodes = [n('a'), n('b', 'a'), n('c', 'b'), n('d', 'a')]
    expect(descendantIds(nodes, 'a')).toEqual(new Set(['b', 'c', 'd']))
    expect(descendantIds(nodes, 'b')).toEqual(new Set(['c']))
    expect(descendantIds(nodes, 'c')).toEqual(new Set())
  })
})

describe('layoutFlow', () => {
  it('places a child below its parent', () => {
    const { nodes, edges } = layoutFlow([n('a'), n('b', 'a')])
    const a = nodes.find(x => x.id === 'a')!
    const b = nodes.find(x => x.id === 'b')!
    expect(b.y).toBeGreaterThan(a.y)
    expect(edges).toHaveLength(1)
    expect(edges[0]).toMatchObject({ fromId: 'a', toId: 'b' })
  })

  it('centers a parent over its two children and keeps siblings apart', () => {
    const { nodes } = layoutFlow([n('p'), n('l', 'p'), n('r', 'p')])
    const p = nodes.find(x => x.id === 'p')!
    const l = nodes.find(x => x.id === 'l')!
    const r = nodes.find(x => x.id === 'r')!
    expect(l.x).not.toBe(r.x)              // siblings do not overlap
    const mid = (l.x + r.x) / 2
    expect(Math.abs(p.x - mid)).toBeLessThan(1) // parent centered
  })

  it('lays out a forest (two roots) without overlap and carries branch labels on edges', () => {
    const { nodes, edges } = layoutFlow([n('r1'), n('r2'), n('c', 'r1', { branchLabel: 'Yes' })])
    const r1 = nodes.find(x => x.id === 'r1')!
    const r2 = nodes.find(x => x.id === 'r2')!
    expect(r1.x).not.toBe(r2.x)
    expect(edges.find(e => e.toId === 'c')!.label).toBe('Yes')
  })

  it('treats a parentId pointing at a missing node as a root (no crash)', () => {
    const { nodes, edges } = layoutFlow([n('x', 'ghost')])
    expect(nodes).toHaveLength(1)
    expect(edges).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/flowchart-layout.test.ts`
Expected: FAIL — cannot find module `./flowchart-layout`.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/flowchart-layout.ts
import type { FlowNode } from './types/canvas'

export interface LaidOutNode { id: string; x: number; y: number; w: number; h: number; node: FlowNode }
export interface LaidOutEdge {
  fromId: string; toId: string; label?: string
  x1: number; y1: number; x2: number; y2: number
}
export interface FlowLayout { nodes: LaidOutNode[]; edges: LaidOutEdge[]; width: number; height: number }

const DEFAULTS = { nodeW: 190, nodeH: 76, gapX: 28, gapY: 56 }

// Map parentId -> children ids, ignoring parents that don't exist or self-loops.
function childMap(nodes: FlowNode[]): { children: Map<string, string[]>; roots: string[] } {
  const ids = new Set(nodes.map((x) => x.id))
  const children = new Map<string, string[]>()
  const roots: string[] = []
  for (const node of nodes) {
    const p = node.parentId
    if (!p || p === node.id || !ids.has(p)) {
      roots.push(node.id)
      continue
    }
    const arr = children.get(p) ?? []
    arr.push(node.id)
    children.set(p, arr)
  }
  return { children, roots }
}

/** All descendants of `id` (excludes `id` itself). Used for cycle prevention. */
export function descendantIds(nodes: FlowNode[], id: string): Set<string> {
  const { children } = childMap(nodes)
  const out = new Set<string>()
  const stack = [...(children.get(id) ?? [])]
  while (stack.length) {
    const cur = stack.pop() as string
    if (out.has(cur)) continue
    out.add(cur)
    for (const c of children.get(cur) ?? []) stack.push(c)
  }
  return out
}

/** Tidy top-down tree layout. Pure and deterministic. */
export function layoutFlow(nodes: FlowNode[], opts?: Partial<typeof DEFAULTS>): FlowLayout {
  const cfg = { ...DEFAULTS, ...opts }
  const { children, roots } = childMap(nodes)
  const pos = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()
  let nextLeaf = 0

  const place = (id: string, depth: number): number => {
    if (visited.has(id)) {
      const x = nextLeaf * (cfg.nodeW + cfg.gapX)
      nextLeaf++
      pos.set(id, { x, y: depth * (cfg.nodeH + cfg.gapY) })
      return x
    }
    visited.add(id)
    const kids = children.get(id) ?? []
    let x: number
    if (kids.length === 0) {
      x = nextLeaf * (cfg.nodeW + cfg.gapX)
      nextLeaf++
    } else {
      const xs = kids.map((k) => place(k, depth + 1))
      x = (xs[0] + xs[xs.length - 1]) / 2
    }
    pos.set(id, { x, y: depth * (cfg.nodeH + cfg.gapY) })
    return x
  }

  for (const r of roots) place(r, 0)
  for (const node of nodes) if (!visited.has(node.id)) place(node.id, 0) // orphans/cycles

  const laid: LaidOutNode[] = nodes.map((node) => {
    const p = pos.get(node.id) as { x: number; y: number }
    return { id: node.id, x: p.x, y: p.y, w: cfg.nodeW, h: cfg.nodeH, node }
  })
  const byId = new Map(laid.map((l) => [l.id, l]))

  const edges: LaidOutEdge[] = []
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined
    if (!parent || node.parentId === node.id) continue
    const child = byId.get(node.id) as LaidOutNode
    edges.push({
      fromId: parent.id,
      toId: child.id,
      label: node.branchLabel,
      x1: parent.x + cfg.nodeW / 2,
      y1: parent.y + cfg.nodeH,
      x2: child.x + cfg.nodeW / 2,
      y2: child.y,
    })
  }

  const width = laid.reduce((m, node) => Math.max(m, node.x + node.w), 0)
  const height = laid.reduce((m, node) => Math.max(m, node.y + node.h), 0)
  return { nodes: laid, edges, width, height }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/flowchart-layout.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/flowchart-layout.ts src/lib/flowchart-layout.test.ts
git commit -m "feat(flowchart): pure tidy-tree layout + descendantIds helper"
```

---

## Task 3: Public renderer

**Files:**
- Create: `src/components/elements/PublicFlowchartElement.tsx`
- Test: `src/components/elements/PublicFlowchartElement.test.tsx`

**Interfaces:**
- Consumes: `layoutFlow` (Task 2); `safeHref` (`@/lib/editor/safe-href`); `CanvasElement` (Task 1).
- Produces: `export function PublicFlowchartElement({ element }: { element: CanvasElement })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/elements/PublicFlowchartElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicFlowchartElement } from './PublicFlowchartElement'
import type { CanvasElement } from '@/lib/types/canvas'

function el(flowNodes: CanvasElement['flowNodes']): CanvasElement {
  return { id: 'el-1', type: 'flowchart', flowTitle: 'Flow', flowNodes } as CanvasElement
}

describe('PublicFlowchartElement', () => {
  it('renders a card per node and an arrow per child edge', () => {
    const { container } = render(<PublicFlowchartElement element={el([
      { id: 'a', title: 'Start' },
      { id: 'b', title: 'Next', parentId: 'a' },
    ])} />)
    expect(screen.getByText('Start')).toBeTruthy()
    expect(screen.getByText('Next')).toBeTruthy()
    expect(container.querySelectorAll('line').length).toBe(1) // one edge a->b
  })

  it('clicking a linked block shows detail with an Open link to its url', () => {
    render(<PublicFlowchartElement element={el([
      { id: 'a', title: 'Step', description: 'Do the thing', linkUrl: 'https://example.com', linkLabel: 'Example' },
    ])} />)
    fireEvent.click(screen.getByText('Step'))
    expect(screen.getByText('Do the thing')).toBeTruthy()
    const open = screen.getByRole('link', { name: /open/i }) as HTMLAnchorElement
    expect(open.getAttribute('href')).toBe('https://example.com')
    expect(open.getAttribute('target')).toBe('_blank')
    expect(open.getAttribute('rel')).toContain('noopener')
  })

  it('a block with no link shows detail but no Open link', () => {
    render(<PublicFlowchartElement element={el([{ id: 'a', title: 'Note', description: 'plain' }])} />)
    fireEvent.click(screen.getByText('Note'))
    expect(screen.getByText('plain')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  })

  it('drops an unsafe external url (javascript:) — no Open link', () => {
    render(<PublicFlowchartElement element={el([
      { id: 'a', title: 'Bad', linkUrl: 'javascript:alert(1)' },
    ])} />)
    fireEvent.click(screen.getByText('Bad'))
    expect(screen.queryByRole('link', { name: /open/i })).toBeNull()
  })

  it('empty flow renders a neutral placeholder', () => {
    render(<PublicFlowchartElement element={el([])} />)
    expect(screen.getByText(/no steps/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/PublicFlowchartElement.test.tsx`
Expected: FAIL — cannot find module `./PublicFlowchartElement`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/elements/PublicFlowchartElement.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { layoutFlow } from '@/lib/flowchart-layout'
import { safeHref } from '@/lib/editor/safe-href'
import type { CanvasElement } from '@/lib/types/canvas'

export function PublicFlowchartElement({ element }: { element: CanvasElement }) {
  const nodes = element.flowNodes ?? []
  const [openId, setOpenId] = useState<string | null>(null)

  if (nodes.length === 0) {
    return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-400 text-center">No steps yet.</div>
  }

  const { nodes: laid, edges, width, height } = layoutFlow(nodes)
  const openNode = laid.find((l) => l.id === openId)?.node
  const openUrl = openNode ? safeHref(openNode.linkUrl) : undefined
  const external = !!openUrl && /^https?:|^mailto:/i.test(openUrl)

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {element.flowTitle && <h3 className="text-base font-bold text-slate-900 mb-3">{element.flowTitle}</h3>}

      <div className="overflow-auto">
        <div className="relative mx-auto" style={{ width, height }}>
          {/* Arrow overlay */}
          <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
            <defs>
              <marker id="flow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const midX = (e.x1 + e.x2) / 2
              const midY = (e.y1 + e.y2) / 2
              return (
                <g key={i}>
                  <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#94a3b8" strokeWidth={1.5} markerEnd="url(#flow-arrow)" />
                  {e.label && (
                    <text x={midX} y={midY} dy={-4} textAnchor="middle" className="fill-slate-500" fontSize={11}>{e.label}</text>
                  )}
                </g>
              )
            })}
          </svg>

          {/* Node cards */}
          {laid.map((l) => (
            <button
              key={l.id}
              onClick={() => setOpenId(l.id)}
              className="absolute rounded-xl border-2 bg-white px-3 py-2 text-left shadow-sm hover:shadow-md transition-shadow"
              style={{ left: l.x, top: l.y, width: l.w, height: l.h, borderColor: l.node.color ?? '#e2e8f0' }}
            >
              <div className="flex items-center gap-1.5">
                {l.node.icon && <span className="text-base leading-none">{l.node.icon}</span>}
                <span className="text-sm font-semibold text-slate-900 truncate">{l.node.title}</span>
              </div>
              {l.node.description && (
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">{l.node.description}</p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Detail popover */}
      {openNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={() => setOpenId(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h4 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                {openNode.icon && <span>{openNode.icon}</span>}{openNode.title}
              </h4>
              <button onClick={() => setOpenId(null)} className="p-1 text-slate-400 hover:text-slate-700" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            {openNode.description && <p className="mt-2 text-sm text-slate-600">{openNode.description}</p>}
            {openUrl && (
              <a
                href={openUrl}
                {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
              >
                {openNode.linkLabel ? `Open ${openNode.linkLabel} →` : 'Open →'}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/elements/PublicFlowchartElement.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/PublicFlowchartElement.tsx src/components/elements/PublicFlowchartElement.test.tsx
git commit -m "feat(flowchart): public renderer (cards + SVG arrows + detail popover)"
```

---

## Task 4: Link picker component

**Files:**
- Create: `src/components/elements/FlowLinkPicker.tsx`
- Test: `src/components/elements/FlowLinkPicker.test.tsx`

**Interfaces:**
- Consumes: `GET /api/displays` (existing; returns the owner's displays with `kind`, `slug`, `title`); `useAuthStore` (`@/lib/store`, `.user?.username`); `safeHref`.
- Produces: `export function FlowLinkPicker({ value, onPick }: { value?: { url?: string; label?: string }; onPick: (v: { url?: string; label?: string }) => void })`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/elements/FlowLinkPicker.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FlowLinkPicker } from './FlowLinkPicker'

vi.mock('@/lib/store', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { username: 'joe' } }) }))

const displays = [
  { id: 'd1', title: 'My Page', slug: 'my-page', kind: 'page' },
  { id: 'd2', title: 'My Board', slug: 'my-board', kind: 'collection' },
]

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => displays }))
})
afterEach(() => vi.unstubAllGlobals())

describe('FlowLinkPicker', () => {
  it('picks a page → root-relative url and its title as label', async () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /pages/i }))
    await waitFor(() => expect(screen.getByText('My Page')).toBeTruthy())
    fireEvent.click(screen.getByText('My Page'))
    expect(onPick).toHaveBeenCalledWith({ url: '/joe/my-page', label: 'My Page' })
  })

  it('picks a board from the boards group', async () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /boards/i }))
    await waitFor(() => expect(screen.getByText('My Board')).toBeTruthy())
    fireEvent.click(screen.getByText('My Board'))
    expect(onPick).toHaveBeenCalledWith({ url: '/joe/my-board', label: 'My Board' })
  })

  it('external URL passes through safeHref; a bad scheme is rejected (no pick)', () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /external/i }))
    const input = screen.getByPlaceholderText(/https/i)
    fireEvent.change(input, { target: { value: 'javascript:alert(1)' } })
    fireEvent.click(screen.getByRole('button', { name: /^set link$/i }))
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.change(input, { target: { value: 'https://ok.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^set link$/i }))
    expect(onPick).toHaveBeenCalledWith({ url: 'https://ok.com', label: 'External link' })
  })

  it('None clears the link', () => {
    const onPick = vi.fn()
    render(<FlowLinkPicker value={{ url: '/joe/x', label: 'X' }} onPick={onPick} />)
    fireEvent.click(screen.getByRole('button', { name: /^none$/i }))
    expect(onPick).toHaveBeenCalledWith({ url: undefined, label: undefined })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/FlowLinkPicker.test.tsx`
Expected: FAIL — cannot find module `./FlowLinkPicker`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/elements/FlowLinkPicker.tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/lib/store'
import { safeHref } from '@/lib/editor/safe-href'

interface Display { id: string; title: string; slug: string; kind?: string }
type Tab = 'pages' | 'boards' | 'external'

export function FlowLinkPicker({
  value,
  onPick,
}: {
  value?: { url?: string; label?: string }
  onPick: (v: { url?: string; label?: string }) => void
}) {
  const username = useAuthStore((s) => (s as { user?: { username?: string } }).user?.username)
  const [tab, setTab] = useState<Tab>('pages')
  const [displays, setDisplays] = useState<Display[]>([])
  const [ext, setExt] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/displays', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => { if (!cancelled) setDisplays(Array.isArray(data) ? data : []) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const pages = displays.filter((d) => d.kind !== 'collection')
  const boards = displays.filter((d) => d.kind === 'collection')

  const pickDisplay = (d: Display) => onPick({ url: `/${username}/${d.slug}`, label: d.title })
  const setExternal = () => {
    const safe = safeHref(ext)
    if (!safe) return
    onPick({ url: safe, label: 'External link' })
  }

  const tabBtn = (id: Tab, label: string) => (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setTab(id) }}
      className={`px-2 py-1 text-xs rounded ${tab === id ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-500'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="rounded-lg border border-slate-200 p-2 space-y-2" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1">
        {tabBtn('pages', 'Pages')}
        {tabBtn('boards', 'Boards')}
        {tabBtn('external', 'External')}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onPick({ url: undefined, label: undefined }) }}
          className="ml-auto px-2 py-1 text-xs rounded text-slate-500 hover:text-destructive"
        >
          None
        </button>
      </div>

      {value?.label && <div className="text-[11px] text-slate-500">Linked: {value.label}</div>}

      {tab === 'external' ? (
        <div className="flex items-center gap-1.5">
          <input
            value={ext}
            onChange={(e) => setExt(e.target.value)}
            placeholder="https://…"
            className="flex-1 text-xs border border-slate-200 rounded px-2 py-1"
          />
          <button type="button" onClick={(e) => { e.stopPropagation(); setExternal() }} className="px-2 py-1 text-xs rounded bg-slate-200">Set link</button>
        </div>
      ) : (
        <div className="max-h-32 overflow-auto space-y-0.5">
          {(tab === 'pages' ? pages : boards).map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); pickDisplay(d) }}
              className="block w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-100 truncate"
            >
              {d.title}
            </button>
          ))}
          {(tab === 'pages' ? pages : boards).length === 0 && (
            <div className="text-[11px] text-slate-400 px-2 py-1">Nothing here yet.</div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/elements/FlowLinkPicker.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/FlowLinkPicker.tsx src/components/elements/FlowLinkPicker.test.tsx
git commit -m "feat(flowchart): link picker over /api/displays (pages/boards/external)"
```

---

## Task 5: Editor element

**Files:**
- Create: `src/components/elements/FlowchartElement.tsx`
- Test: `src/components/elements/FlowchartElement.test.tsx`

**Interfaces:**
- Consumes: `FlowNode`, `CanvasElement` (Task 1); `descendantIds` (Task 2); `FlowLinkPicker` (Task 4); `PublicFlowchartElement` (Task 3, used as the live preview).
- Produces: `export function FlowchartElement({ element, onChange, onDelete, isSelected, onSelect }: Props)`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/elements/FlowchartElement.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { FlowchartElement } from './FlowchartElement'
import type { CanvasElement } from '@/lib/types/canvas'

vi.mock('@/lib/store', () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: { username: 'joe' } }) }))
beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] })))
afterEach(() => vi.unstubAllGlobals())

function el(flowNodes: CanvasElement['flowNodes']): CanvasElement {
  return { id: 'el-1', type: 'flowchart', flowTitle: 'Flow', flowNodes } as CanvasElement
}
const noop = () => {}

describe('FlowchartElement', () => {
  it('the parent dropdown for a node excludes itself and its descendants', () => {
    // a -> b -> c ; editing a's parent must not offer a, b, or c
    const element = el([
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', parentId: 'a' },
      { id: 'c', title: 'C', parentId: 'b' },
    ])
    render(<FlowchartElement element={element} onChange={noop} onDelete={noop} isSelected onSelect={noop} />)
    const selectA = screen.getByLabelText('parent-a') as HTMLSelectElement
    const optionValues = Array.from(selectA.options).map((o) => o.value)
    expect(optionValues).not.toContain('a')
    expect(optionValues).not.toContain('b')
    expect(optionValues).not.toContain('c')
    expect(optionValues).toContain('') // the "root" option
  })

  it('Add block appends a node via onChange', () => {
    const onChange = vi.fn()
    render(<FlowchartElement element={el([{ id: 'a', title: 'A' }])} onChange={onChange} onDelete={noop} isSelected onSelect={noop} />)
    fireEvent.click(screen.getByRole('button', { name: /add block/i }))
    expect(onChange).toHaveBeenCalled()
    const arg = onChange.mock.calls[0][0]
    expect(arg.flowNodes).toHaveLength(2)
  })

  it('editing a block title updates that node', () => {
    const onChange = vi.fn()
    render(<FlowchartElement element={el([{ id: 'a', title: 'A' }])} onChange={onChange} onDelete={noop} isSelected onSelect={noop} />)
    const card = screen.getByTestId('flow-block-a')
    fireEvent.change(within(card).getByPlaceholderText(/title/i), { target: { value: 'Renamed' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      flowNodes: [expect.objectContaining({ id: 'a', title: 'Renamed' })],
    }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/FlowchartElement.test.tsx`
Expected: FAIL — cannot find module `./FlowchartElement`.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/elements/FlowchartElement.tsx
'use client'

import { Trash2, Plus, X, Workflow } from 'lucide-react'
import type { CanvasElement, FlowNode } from '@/lib/types/canvas'
import { descendantIds } from '@/lib/flowchart-layout'
import { FlowLinkPicker } from './FlowLinkPicker'
import { PublicFlowchartElement } from './PublicFlowchartElement'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

export function FlowchartElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const nodes: FlowNode[] = element.flowNodes ?? []
  const set = (next: FlowNode[]) => onChange({ flowNodes: next })
  const update = (id: string, patch: Partial<FlowNode>) =>
    set(nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  const remove = (id: string) =>
    set(nodes.filter((n) => n.id !== id).map((n) => (n.parentId === id ? { ...n, parentId: undefined } : n)))
  const add = () =>
    set([...nodes, { id: `fn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: 'New step' }])

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-primary" />
          <input
            value={element.flowTitle ?? ''}
            onChange={(e) => onChange({ flowTitle: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            placeholder="Workflow title"
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
        </div>

        {/* Blocks */}
        <div className="space-y-2">
          {nodes.map((n) => {
            const banned = descendantIds(nodes, n.id)
            const parentOptions = nodes.filter((o) => o.id !== n.id && !banned.has(o.id))
            return (
              <div key={n.id} data-testid={`flow-block-${n.id}`} className="rounded-lg border border-border p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={n.icon ?? ''}
                    onChange={(e) => update(n.id, { icon: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="🙂"
                    className="w-10 text-sm text-center bg-transparent border border-border rounded px-1 py-1"
                  />
                  <input
                    value={n.title}
                    onChange={(e) => update(n.id, { title: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Title"
                    className="text-sm bg-transparent border border-border rounded px-2 py-1 flex-1 min-w-0"
                  />
                  <input
                    type="color"
                    value={n.color ?? '#e2e8f0'}
                    onChange={(e) => update(n.id, { color: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    className="w-8 h-8 border border-border rounded"
                  />
                  <button onClick={(e) => { e.stopPropagation(); remove(n.id) }} className="p-1 text-muted-foreground hover:text-destructive" aria-label={`delete-${n.id}`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <textarea
                  value={n.description ?? ''}
                  onChange={(e) => update(n.id, { description: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full text-sm bg-transparent border border-border rounded px-2 py-1"
                />

                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">Comes after</label>
                  <select
                    aria-label={`parent-${n.id}`}
                    value={n.parentId ?? ''}
                    onChange={(e) => update(n.id, { parentId: e.target.value || undefined })}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs border border-border rounded px-1 py-1"
                  >
                    <option value="">— (start / root)</option>
                    {parentOptions.map((o) => (
                      <option key={o.id} value={o.id}>{o.title || o.id}</option>
                    ))}
                  </select>
                  <input
                    value={n.branchLabel ?? ''}
                    onChange={(e) => update(n.id, { branchLabel: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Arrow label (e.g. Yes)"
                    className="text-xs bg-transparent border border-border rounded px-2 py-1 flex-1 min-w-0"
                  />
                </div>

                <FlowLinkPicker
                  value={{ url: n.linkUrl, label: n.linkLabel }}
                  onPick={(v) => update(n.id, { linkUrl: v.url, linkLabel: v.label })}
                />
              </div>
            )
          })}
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); add() }}
          className="flex items-center gap-1.5 text-sm text-primary hover:opacity-80 font-medium transition"
        >
          <Plus className="w-3.5 h-3.5" /> Add block
        </button>

        {/* Live preview */}
        {nodes.length > 0 && (
          <div className="pt-2 border-t border-border">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Preview</div>
            <div className="pointer-events-none">
              <PublicFlowchartElement element={element} />
            </div>
          </div>
        )}
      </div>

      {isSelected && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/elements/FlowchartElement.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/elements/FlowchartElement.tsx src/components/elements/FlowchartElement.test.tsx
git commit -m "feat(flowchart): editor (block list, parent dropdown, branch label, link picker, preview)"
```

---

## Task 6: Wiring (slash menu, canvas, exports, published page)

**Files:**
- Modify: `src/components/elements/index.ts`
- Modify: `src/components/canvas/SlashCommandMenu.tsx`
- Modify: `src/components/canvas/ColumnCanvas.tsx`
- Modify: `src/lib/render-elements.tsx`

**Interfaces:**
- Consumes: `FlowchartElement` (Task 5), `PublicFlowchartElement` (Task 3).

- [ ] **Step 1: Add exports**

In `src/components/elements/index.ts`, at the end, add:

```ts
export { FlowchartElement } from './FlowchartElement'
export { PublicFlowchartElement } from './PublicFlowchartElement'
```

- [ ] **Step 2: Add the slash-menu entry**

In `src/components/canvas/SlashCommandMenu.tsx`:
(a) add `Workflow` to the lucide-react import list.
(b) In the `commands` array, in the **Data & Visuals** group (near `chart`), add:
```ts
  { id: 'flowchart', label: 'Flowchart', icon: Workflow, description: 'Branching workflow of linked blocks', category: 'Data & Visuals' },
```
(No `CATEGORY_ORDER` change — "Data & Visuals" already exists.)

- [ ] **Step 3: Add the ColumnCanvas render case**

In `src/components/canvas/ColumnCanvas.tsx`:
(a) add imports near the other element imports:
```ts
import { FlowchartElement } from '@/components/elements/FlowchartElement'
import { PublicFlowchartElement } from '@/components/elements/PublicFlowchartElement'
```
(b) in the `renderElement` switch, following the `kit-profile` shape (preview → Public, no displayId), add:
```tsx
      case 'flowchart':
        if (isPreviewMode) {
          return <PublicFlowchartElement element={element} />
        }
        return (
          <FlowchartElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 4: Add the published-page case**

In `src/lib/render-elements.tsx`:
(a) add the import near the other public-element imports:
```ts
import { PublicFlowchartElement } from '@/components/elements/PublicFlowchartElement'
```
(b) in the switch, add:
```tsx
    case 'flowchart':
      return <PublicFlowchartElement element={element} />
```

- [ ] **Step 5: Typecheck + run flowchart tests**

Run:
```bash
npx tsc --noEmit
npx vitest run src/lib/flowchart-layout.test.ts src/components/elements/PublicFlowchartElement.test.tsx src/components/elements/FlowLinkPicker.test.tsx src/components/elements/FlowchartElement.test.tsx
```
Expected: tsc clean; all four test files pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(flowchart): wire element into slash menu, canvas, exports, published page"
```

---

## Self-Review

**Spec coverage:**
- Element type + fields + default → Task 1. ✓
- Branching-tree data model (`parentId`/`branchLabel`) → Task 1 (types), Task 2 (layout derives edges). ✓
- Pure tidy-tree auto-layout, no dependency → Task 2. ✓
- Public clickable diagram + detail popover + Open link (internal same-tab / external new-tab) → Task 3. ✓
- Link picker: pages/boards via `GET /api/displays`, external via `safeHref`, future-Hub-ready URLs → Task 4. ✓
- Editor: block list, add/delete, parent dropdown with cycle prevention (`descendantIds`), branch label, live preview → Task 5. ✓
- Wiring seams (canvas.ts done in T1; slash menu / ColumnCanvas / index / render-elements) → Task 6. ✓
- Security: `safeHref` external, root-relative internal, no new endpoints, text-only rendering → Tasks 3/4. ✓
- Testing: layout purity, cycle prevention, link safety, public render/click → Tasks 2–5. ✓

**Deviations from spec (intentional, noted):**
- The spec's `LaidOutNode` carries the source node under a `node` field (`LaidOutNode.node`) rather than spreading FlowNode fields onto the laid-out object — cleaner and avoids id/field collisions. Public renderer reads `l.node.*`. Consistent across Tasks 2/3.

**Placeholder scan:** none — every step has concrete code + commands.

**Type consistency:** `FlowNode` defined once (Task 1), imported by layout (Task 2), public (Task 3), editor (Task 5). `layoutFlow`/`descendantIds` signatures match across Tasks 2/3/5. `FlowLinkPicker` `{ value, onPick }` matches its use in Task 5. `flowNodes`/`flowTitle` field names consistent everywhere.
