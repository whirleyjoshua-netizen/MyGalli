# Special Elements — Batch 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five differentiated element types — `link-hub`, `gallery`, `countdown`, `before-after`, `tip-jar` — as free/functional page-editor blocks.

**Architecture:** Each element is pure `Display.sections` JSON config plus a client/server React component pair, wired through the existing add-an-element seams. No Prisma models, no API routes, no migration. A one-time refactor makes `createElement()` in `canvas.ts` the single source of element defaults so new elements aren't duplicated in `PageEditor`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, lucide-react, Vitest + Testing Library, pnpm.

## Global Constraints

- Element defaults live **once** in `src/lib/types/canvas.ts` `createElement()` (after Task 0's fallback). Do NOT add per-element cases to `PageEditor.handleCommandSelect`.
- New slash-menu `category` MUST be one of `CATEGORY_ORDER` (`'Content' | 'Data & Visuals' | 'Media' | 'Forms' | 'Social' | 'Apps' | 'Kit'`). Batch 1 uses `'Media'` and `'Content'` only.
- Editor component props: `{ element: CanvasElement, onChange: (updates: Partial<CanvasElement>) => void, onDelete: () => void, isSelected: boolean, onSelect: () => void }`.
- Public component props: `{ element: CanvasElement }`.
- Every outbound link in a Public component: `target="_blank" rel="noopener noreferrer"` and an http(s)-only guard — use the shared `safeHref` helper from Task 0.
- Image uploads reuse `POST /api/upload` (FormData field `file` → `{ url }`, 10MB cap), same as `ImageElement`.
- Brand green is `#39D98A`.
- **Gate every task before commit:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (full suite green). On Windows do not run `pnpm build` while `next dev` is running.
- One task = one element (or Task 0). Commit at the end of each task. Ship/deploy between tasks for live testing.

---

## Task 0: Single-source element defaults + shared `safeHref`

**Files:**
- Modify: `src/components/editor/PageEditor.tsx` (the `switch` in `handleCommandSelect`, ends ~line 801)
- Create: `src/lib/editor/safe-href.ts`
- Test: `src/lib/editor/safe-href.test.ts`

**Interfaces:**
- Produces: `safeHref(url?: string): string | undefined` — returns the url if it is `http://`/`https://`/`mailto:` (or a root-relative `/…`), else `undefined`. Used by every Public link component.
- Produces: `PageEditor.handleCommandSelect` now falls through to `createElement(type)` for any type without an explicit case.

- [ ] **Step 1: Write the failing test for `safeHref`**

```ts
// src/lib/editor/safe-href.test.ts
import { describe, it, expect } from 'vitest'
import { safeHref } from './safe-href'

describe('safeHref', () => {
  it('allows http, https, mailto, and root-relative', () => {
    expect(safeHref('https://a.com')).toBe('https://a.com')
    expect(safeHref('http://a.com')).toBe('http://a.com')
    expect(safeHref('mailto:me@a.com')).toBe('mailto:me@a.com')
    expect(safeHref('/explore')).toBe('/explore')
  })
  it('rejects javascript: and other schemes and empties', () => {
    expect(safeHref('javascript:alert(1)')).toBeUndefined()
    expect(safeHref('data:text/html,x')).toBeUndefined()
    expect(safeHref('')).toBeUndefined()
    expect(safeHref(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module './safe-href'`)

Run: `npx vitest run src/lib/editor/safe-href.test.ts`

- [ ] **Step 3: Implement `safeHref`**

```ts
// src/lib/editor/safe-href.ts
/** Returns the url only if it uses a safe scheme; otherwise undefined. */
export function safeHref(url?: string): string | undefined {
  if (!url) return undefined
  const u = url.trim()
  if (!u) return undefined
  if (u.startsWith('/')) return u // root-relative
  if (/^https?:\/\//i.test(u)) return u
  if (/^mailto:/i.test(u)) return u
  return undefined
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/lib/editor/safe-href.test.ts`

- [ ] **Step 5: Add the `default` fallback to `PageEditor.handleCommandSelect`**

Ensure `createElement` is imported from `@/lib/types/canvas` (add to the existing import if absent). Then add a `default` case as the LAST case of the `switch (type)` block (immediately before the closing `}` at ~line 801):

```ts
      default: {
        // New element types define their defaults once in createElement().
        Object.assign(newElement, createElement(type))
        break
      }
```

Leave every existing `case` unchanged.

- [ ] **Step 6: Verify gates**

Run: `npx tsc --noEmit` (expect exit 0)
Run: `npx vitest run` (expect full suite green)

- [ ] **Step 7: Commit**

```bash
git add src/lib/editor/safe-href.ts src/lib/editor/safe-href.test.ts src/components/editor/PageEditor.tsx
git commit -m "refactor(editor): single-source element defaults via createElement + safeHref helper"
```

---

## Shared per-element wiring recipe

Every element task below performs these wiring edits. Exact code is given per task; this recipe explains the shape once.

1. **`src/lib/types/canvas.ts`**
   - Add the type id to the `ElementType` union (near the bottom, under a `// Batch 1: Special elements` comment).
   - Add the element's typed fields to `interface CanvasElement`.
   - Add a `case` to `createElement()` returning `{ ...base, <defaults> }`.
2. **`src/components/elements/{Name}Element.tsx`** — editor component.
3. **`src/components/elements/Public{Name}Element.tsx`** — public component.
4. **`src/components/elements/index.ts`** — `export { ... }` both, under a `// Batch 1` comment.
5. **`src/components/canvas/SlashCommandMenu.tsx`** — import the lucide icon; add a `commands[]` entry.
6. **`src/components/canvas/ColumnCanvas.tsx`** — import both components; add a `renderElement` case:
   ```tsx
   case '<id>':
     if (isPreviewMode) return <Public{Name}Element element={element} />
     return (
       <{Name}Element
         element={element}
         onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
         onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
         isSelected={commonProps.isSelected}
         onSelect={commonProps.onSelect}
       />
     )
   ```
7. **`src/lib/render-elements.tsx`** — import the Public component; add `case '<id>': return <Public{Name}Element element={element} />`.

The editor component boilerplate (selection ring, delete button) mirrors `src/components/elements/ColorPaletteElement.tsx`. Reproduce that outer structure; only the settings body differs per element.

---

## Task 1: `link-hub` — Link-in-bio hub

**Files:**
- Modify: `src/lib/types/canvas.ts`
- Create: `src/components/elements/LinkHubElement.tsx`, `src/components/elements/PublicLinkHubElement.tsx`
- Modify: `src/components/elements/index.ts`, `SlashCommandMenu.tsx`, `ColumnCanvas.tsx`, `src/lib/render-elements.tsx`
- Test: `src/components/elements/PublicLinkHubElement.test.tsx`

**Interfaces:**
- Consumes: `safeHref` (Task 0).
- Produces: `ElementType` gains `'link-hub'`; `CanvasElement` gains `linkHubTitle?`, `linkHubItems?`.

**Data model (canvas.ts):**
```ts
// in ElementType union:
  | 'link-hub'               // Batch 1: link-in-bio hub
// in CanvasElement:
  // Link hub specific
  linkHubTitle?: string
  linkHubItems?: { label: string; url: string; icon?: string }[]
// in createElement():
    case 'link-hub':
      return { ...base, linkHubTitle: '', linkHubItems: [{ label: 'My website', url: '', icon: 'website' }] }
```

**Icon set (shared const in both components):**
```ts
import { Instagram, Twitter, Youtube, Github, Linkedin, Facebook, Twitch, Music, Mail, Globe, Link as LinkIcon } from 'lucide-react'
const LINK_ICONS: Record<string, typeof Globe> = {
  instagram: Instagram, twitter: Twitter, youtube: Youtube, github: Github,
  linkedin: Linkedin, facebook: Facebook, twitch: Twitch, tiktok: Music,
  spotify: Music, email: Mail, website: Globe,
}
const iconFor = (key?: string) => LINK_ICONS[key || ''] || LinkIcon
export const LINK_ICON_KEYS = Object.keys(LINK_ICONS)
```

- [ ] **Step 1: Write the failing Public test**

```tsx
// src/components/elements/PublicLinkHubElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicLinkHubElement } from './PublicLinkHubElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'link-hub', ...over })

describe('PublicLinkHubElement', () => {
  it('renders each item with a safe href opening in a new tab', () => {
    render(<PublicLinkHubElement element={el({ linkHubTitle: 'Find me', linkHubItems: [
      { label: 'Insta', url: 'https://instagram.com/x', icon: 'instagram' },
    ] })} />)
    const link = screen.getByRole('link', { name: /insta/i })
    expect(link).toHaveAttribute('href', 'https://instagram.com/x')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })
  it('skips items with empty or unsafe urls', () => {
    render(<PublicLinkHubElement element={el({ linkHubItems: [
      { label: 'Empty', url: '' },
      { label: 'Bad', url: 'javascript:alert(1)' },
      { label: 'Good', url: 'https://a.com' },
    ] })} />)
    expect(screen.queryByText('Empty')).toBeNull()
    expect(screen.queryByText('Bad')).toBeNull()
    expect(screen.getByText('Good')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module './PublicLinkHubElement'`)

Run: `npx vitest run src/components/elements/PublicLinkHubElement.test.tsx`

- [ ] **Step 3: Implement the Public component**

```tsx
// src/components/elements/PublicLinkHubElement.tsx
import { Instagram, Twitter, Youtube, Github, Linkedin, Facebook, Twitch, Music, Mail, Globe, Link as LinkIcon } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { safeHref } from '@/lib/editor/safe-href'

const LINK_ICONS: Record<string, typeof Globe> = {
  instagram: Instagram, twitter: Twitter, youtube: Youtube, github: Github,
  linkedin: Linkedin, facebook: Facebook, twitch: Twitch, tiktok: Music,
  spotify: Music, email: Mail, website: Globe,
}
const iconFor = (key?: string) => LINK_ICONS[key || ''] || LinkIcon

export function PublicLinkHubElement({ element }: { element: CanvasElement }) {
  const items = (element.linkHubItems || []).filter((i) => safeHref(i.url))
  return (
    <div className="space-y-3">
      {element.linkHubTitle && (
        <h3 className="text-lg font-bold text-center">{element.linkHubTitle}</h3>
      )}
      <div className="flex flex-col gap-2.5 max-w-md mx-auto w-full">
        {items.map((item, i) => {
          const Icon = iconFor(item.icon)
          return (
            <a
              key={i}
              href={safeHref(item.url)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface font-medium text-foreground hover:border-primary hover:shadow-soft transition-all"
            >
              <Icon className="w-5 h-5 shrink-0 text-primary" />
              <span className="flex-1 text-center -ml-8">{item.label || item.url}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run src/components/elements/PublicLinkHubElement.test.tsx`

- [ ] **Step 5: Implement the editor component**

Mirror `ColorPaletteElement.tsx`'s outer structure (selection ring div, delete button). Body: a title `<input>` bound to `element.linkHubTitle` (`onChange({ linkHubTitle: e.target.value })`); then map `element.linkHubItems` to rows, each with a label input, url input, an icon `<select>` over `LINK_ICON_KEYS`, and remove / move-up / move-down buttons. An "Add link" button appends `{ label: '', url: '', icon: 'website' }`. All mutations call `onChange({ linkHubItems: next })` with a new array (never mutate in place). Use `LINK_ICON_KEYS` exported from the Public component (or redefine locally).

```tsx
// src/components/elements/LinkHubElement.tsx — skeleton (fill body per above)
'use client'
import { X, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}
const ICON_KEYS = ['website','instagram','twitter','youtube','tiktok','github','linkedin','facebook','twitch','spotify','email']

export function LinkHubElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const items = element.linkHubItems || []
  const set = (next: typeof items) => onChange({ linkHubItems: next })
  const update = (i: number, patch: Partial<{ label: string; url: string; icon: string }>) =>
    set(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const remove = (i: number) => set(items.filter((_, idx) => idx !== i))
  const move = (i: number, d: -1 | 1) => {
    const j = i + d; if (j < 0 || j >= items.length) return
    const next = [...items]; [next[i], next[j]] = [next[j], next[i]]; set(next)
  }
  return (
    <div className={`relative group ${isSelected ? 'ring-2 ring-primary rounded-lg p-2' : ''}`} onClick={onSelect}>
      {/* title input + item rows (label/url/icon-select/move/remove) + Add link button */}
      {/* delete button (top-right, X) shown when isSelected — mirror ColorPaletteElement */}
    </div>
  )
}
```

Implement the body fully following the description; ensure the delete button calls `onDelete()` and stops propagation.

- [ ] **Step 6: Wire it in** — apply the Shared Recipe steps 1(done in Step 0 of this task via data model), 4, 5, 6, 7.
  - `index.ts`: `export { LinkHubElement } from './LinkHubElement'` and `export { PublicLinkHubElement } from './PublicLinkHubElement'`.
  - `SlashCommandMenu.tsx`: import `Link2` from lucide; add `{ id: 'link-hub', label: 'Link Hub', icon: Link2, description: 'Link-in-bio button stack', category: 'Media' }`.
  - `ColumnCanvas.tsx`: import both; add the `case 'link-hub'` per recipe §6.
  - `render-elements.tsx`: import `PublicLinkHubElement`; add `case 'link-hub': return <PublicLinkHubElement element={element} />`.

- [ ] **Step 7: Verify gates** — `npx tsc --noEmit` (exit 0); `npx vitest run` (green).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(elements): link-hub (link-in-bio button stack)"
```

---

## Task 2: `gallery` — Photo gallery + lightbox

**Files:** canvas.ts · `GalleryElement.tsx` (new) · `PublicGalleryElement.tsx` (new) · index.ts · SlashCommandMenu.tsx · ColumnCanvas.tsx · render-elements.tsx · `PublicGalleryElement.test.tsx` (new)

**Interfaces:**
- Produces: `ElementType` gains `'gallery'`; `CanvasElement` gains `galleryTitle?`, `galleryImages?`, `galleryColumns?`.

**Data model:**
```ts
  | 'gallery'                // Batch 1: photo gallery w/ lightbox
  // Gallery specific
  galleryTitle?: string
  galleryImages?: { url: string; caption?: string; alt?: string }[]
  galleryColumns?: 2 | 3 | 4
// createElement:
    case 'gallery':
      return { ...base, galleryTitle: '', galleryImages: [], galleryColumns: 3 }
```

- [ ] **Step 1: Write the failing Public test**

```tsx
// src/components/elements/PublicGalleryElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PublicGalleryElement } from './PublicGalleryElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'gallery', ...over })

describe('PublicGalleryElement', () => {
  const imgs = [
    { url: 'https://a.com/1.jpg', caption: 'One' },
    { url: 'https://a.com/2.jpg', caption: 'Two' },
  ]
  it('renders a thumbnail per image', () => {
    render(<PublicGalleryElement element={el({ galleryImages: imgs })} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
  })
  it('opens a lightbox on click and closes it', () => {
    render(<PublicGalleryElement element={el({ galleryImages: imgs })} />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: /view image/i })[0])
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/components/elements/PublicGalleryElement.test.tsx`

- [ ] **Step 3: Implement the Public component**

```tsx
// src/components/elements/PublicGalleryElement.tsx
'use client'
import { useState, useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'

const COLS: Record<number, string> = { 2: 'grid-cols-2', 3: 'grid-cols-2 sm:grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }

export function PublicGalleryElement({ element }: { element: CanvasElement }) {
  const images = (element.galleryImages || []).filter((i) => i.url)
  const [open, setOpen] = useState<number | null>(null)
  const cols = COLS[element.galleryColumns || 3] || COLS[3]

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((o) => (o === null ? o : (o + 1) % images.length))
      if (e.key === 'ArrowLeft') setOpen((o) => (o === null ? o : (o - 1 + images.length) % images.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, images.length])

  if (images.length === 0) return null
  const cur = open !== null ? images[open] : null
  return (
    <div className="space-y-3">
      {element.galleryTitle && <h3 className="text-lg font-bold">{element.galleryTitle}</h3>}
      <div className={`grid ${cols} gap-2`}>
        {images.map((img, i) => (
          <button key={i} aria-label={`View image ${i + 1}`} onClick={() => setOpen(i)}
            className="relative aspect-square overflow-hidden rounded-lg group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.alt || img.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          </button>
        ))}
      </div>
      {cur && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(null)}>
          <button aria-label="Close" onClick={() => setOpen(null)} className="absolute top-4 right-4 p-2 text-white/80 hover:text-white"><X className="w-6 h-6" /></button>
          {images.length > 1 && (
            <>
              <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); setOpen((o) => (o! - 1 + images.length) % images.length) }} className="absolute left-4 p-2 text-white/80 hover:text-white"><ChevronLeft className="w-8 h-8" /></button>
              <button aria-label="Next" onClick={(e) => { e.stopPropagation(); setOpen((o) => (o! + 1) % images.length) }} className="absolute right-4 p-2 text-white/80 hover:text-white"><ChevronRight className="w-8 h-8" /></button>
            </>
          )}
          <figure className="max-w-4xl max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.url} alt={cur.alt || cur.caption || ''} className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            {cur.caption && <figcaption className="text-center text-white/80 text-sm mt-2">{cur.caption}</figcaption>}
          </figure>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/components/elements/PublicGalleryElement.test.tsx`

- [ ] **Step 5: Implement the editor component**

Mirror `MoodBoardElement.tsx` (image-grid editor with upload). Body: title input; a column-count selector (2/3/4 buttons → `onChange({ galleryColumns: n })`); an upload tile that POSTs the file to `/api/upload` and appends `{ url, caption: '' }` to `galleryImages`; each existing image shows a thumbnail, a caption input, and a remove button. All array mutations produce new arrays via `onChange({ galleryImages: next })`. Reuse the upload code shape from `ImageElement.tsx` (Read it: lines ~50-85).

- [ ] **Step 6: Wire it in** (recipe §4-7):
  - `index.ts`: export both.
  - `SlashCommandMenu.tsx`: import `Images` from lucide; `{ id: 'gallery', label: 'Gallery', icon: Images, description: 'Photo grid with lightbox', category: 'Media' }`.
  - `ColumnCanvas.tsx`: `case 'gallery'` per recipe §6.
  - `render-elements.tsx`: `case 'gallery': return <PublicGalleryElement element={element} />`.

- [ ] **Step 7: Verify gates** — `npx tsc --noEmit`; `npx vitest run`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(elements): gallery (photo grid + lightbox)"
```

---

## Task 3: `countdown` — Countdown timer

**Files:** canvas.ts · `CountdownElement.tsx` (new) · `PublicCountdownElement.tsx` (new) · index.ts · SlashCommandMenu.tsx · ColumnCanvas.tsx · render-elements.tsx · `PublicCountdownElement.test.tsx` (new)

**Interfaces:**
- Produces: `ElementType` gains `'countdown'`; `CanvasElement` gains `countdownTitle?`, `countdownTarget?`, `countdownStyle?`, `countdownColor?`, `countdownExpiredText?`.

**Data model:**
```ts
  | 'countdown'              // Batch 1: countdown timer
  // Countdown specific
  countdownTitle?: string
  countdownTarget?: string       // datetime-local value, compared to viewer local time
  countdownStyle?: 'boxes' | 'inline'
  countdownColor?: string
  countdownExpiredText?: string
// createElement:
    case 'countdown':
      return { ...base, countdownTitle: 'Counting down', countdownTarget: '', countdownStyle: 'boxes', countdownColor: '#39D98A', countdownExpiredText: "It's here! 🎉" }
```

**Pure helper (exported from the Public component, so it is testable without timers):**
```ts
export function remainingParts(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs)
  const s = Math.floor(diff / 1000)
  return { expired: diff === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}
```

- [ ] **Step 1: Write the failing Public test** (uses the pure helper + a fixed target to avoid clock flakiness)

```tsx
// src/components/elements/PublicCountdownElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicCountdownElement, remainingParts } from './PublicCountdownElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'countdown', ...over })

describe('remainingParts', () => {
  it('splits a positive diff into d/h/m/s', () => {
    const p = remainingParts(90_061_000, 0) // 1d 1h 1m 1s
    expect(p).toMatchObject({ expired: false, days: 1, hours: 1, minutes: 1, seconds: 1 })
  })
  it('marks expired at/after target', () => {
    expect(remainingParts(0, 5).expired).toBe(true)
  })
})

describe('PublicCountdownElement', () => {
  it('shows the expired text when the target is in the past', () => {
    render(<PublicCountdownElement element={el({ countdownTarget: '2000-01-01T00:00', countdownExpiredText: 'Done!' })} />)
    expect(screen.getByText('Done!')).toBeInTheDocument()
  })
  it('renders a placeholder when no target is set', () => {
    render(<PublicCountdownElement element={el({ countdownTarget: '' })} />)
    expect(screen.getByText(/set a date/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/components/elements/PublicCountdownElement.test.tsx`

- [ ] **Step 3: Implement the Public component**

```tsx
// src/components/elements/PublicCountdownElement.tsx
'use client'
import { useState, useEffect } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

export function remainingParts(targetMs: number, nowMs: number) {
  const diff = Math.max(0, targetMs - nowMs)
  const s = Math.floor(diff / 1000)
  return { expired: diff === 0, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 }
}

const UNITS: [keyof ReturnType<typeof remainingParts>, string][] = [['days', 'Days'], ['hours', 'Hours'], ['minutes', 'Min'], ['seconds', 'Sec']]

export function PublicCountdownElement({ element }: { element: CanvasElement }) {
  const targetMs = element.countdownTarget ? new Date(element.countdownTarget).getTime() : NaN
  const [nowMs, setNowMs] = useState(() => 0)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setNowMs(Date.now())
    const t = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const color = element.countdownColor || '#39D98A'
  if (!element.countdownTarget || Number.isNaN(targetMs)) {
    return <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-xl">Set a date to start the countdown.</div>
  }
  // Before mount, render as not-yet-expired to avoid SSR/CSR mismatch flashing the expired text.
  const parts = remainingParts(targetMs, mounted ? nowMs : Math.min(nowMs, targetMs - 1000))
  return (
    <div className="text-center space-y-3">
      {element.countdownTitle && <h3 className="text-lg font-bold">{element.countdownTitle}</h3>}
      {parts.expired ? (
        <p className="text-xl font-bold" style={{ color }}>{element.countdownExpiredText || "It's here!"}</p>
      ) : (
        <div className="flex justify-center gap-2 sm:gap-3">
          {UNITS.map(([key, label]) => (
            <div key={label} className="flex flex-col items-center min-w-[56px] rounded-xl px-2 py-3" style={{ backgroundColor: `${color}1a` }}>
              <span className="text-2xl sm:text-3xl font-extrabold tabular-nums" style={{ color }}>{String(parts[key]).padStart(2, '0')}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/components/elements/PublicCountdownElement.test.tsx`

- [ ] **Step 5: Implement the editor component**

Mirror `ColorPaletteElement.tsx` outer structure. Body: title input; a `<input type="datetime-local">` bound to `element.countdownTarget`; a style toggle (`boxes`/`inline` — for v1 both render as boxes, keep the control but it may be a no-op visually, OR omit and default boxes; simplest: omit the style control); an accent color `<input type="color">` → `countdownColor`; an expired-text input. Keep it minimal.

- [ ] **Step 6: Wire it in** (recipe §4-7):
  - `index.ts`: export both.
  - `SlashCommandMenu.tsx`: import `Timer` from lucide; `{ id: 'countdown', label: 'Countdown', icon: Timer, description: 'Live countdown to a date', category: 'Content' }`.
  - `ColumnCanvas.tsx`: `case 'countdown'` per recipe §6.
  - `render-elements.tsx`: `case 'countdown': return <PublicCountdownElement element={element} />`.

- [ ] **Step 7: Verify gates** — `npx tsc --noEmit`; `npx vitest run`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(elements): countdown timer"
```

---

## Task 4: `before-after` — Before/After image slider

**Files:** canvas.ts · `BeforeAfterElement.tsx` (new) · `PublicBeforeAfterElement.tsx` (new) · index.ts · SlashCommandMenu.tsx · ColumnCanvas.tsx · render-elements.tsx · `PublicBeforeAfterElement.test.tsx` (new)

**Interfaces:**
- Produces: `ElementType` gains `'before-after'`; `CanvasElement` gains `beforeAfterBefore?`, `beforeAfterAfter?`, `beforeAfterBeforeLabel?`, `beforeAfterAfterLabel?`, `beforeAfterHeight?`.

**Data model:**
```ts
  | 'before-after'           // Batch 1: before/after image slider
  // Before/After specific
  beforeAfterBefore?: string
  beforeAfterAfter?: string
  beforeAfterBeforeLabel?: string
  beforeAfterAfterLabel?: string
  beforeAfterHeight?: number
// createElement:
    case 'before-after':
      return { ...base, beforeAfterBefore: '', beforeAfterAfter: '', beforeAfterBeforeLabel: 'Before', beforeAfterAfterLabel: 'After', beforeAfterHeight: 400 }
```

- [ ] **Step 1: Write the failing Public test**

```tsx
// src/components/elements/PublicBeforeAfterElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicBeforeAfterElement } from './PublicBeforeAfterElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'before-after', ...over })

describe('PublicBeforeAfterElement', () => {
  it('renders both images and the drag handle when both are set', () => {
    render(<PublicBeforeAfterElement element={el({ beforeAfterBefore: 'https://a/b.jpg', beforeAfterAfter: 'https://a/a.jpg' })} />)
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByRole('slider')).toBeInTheDocument()
  })
  it('shows a placeholder when an image is missing', () => {
    render(<PublicBeforeAfterElement element={el({ beforeAfterBefore: 'https://a/b.jpg' })} />)
    expect(screen.getByText(/add both/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/components/elements/PublicBeforeAfterElement.test.tsx`

- [ ] **Step 3: Implement the Public component**

```tsx
// src/components/elements/PublicBeforeAfterElement.tsx
'use client'
import { useRef, useState } from 'react'
import type { CanvasElement } from '@/lib/types/canvas'

export function PublicBeforeAfterElement({ element }: { element: CanvasElement }) {
  const before = element.beforeAfterBefore
  const after = element.beforeAfterAfter
  const height = element.beforeAfterHeight || 400
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)

  if (!before || !after) {
    return <div className="text-center text-sm text-muted-foreground py-6 border border-dashed border-border rounded-xl" style={{ minHeight: 120 }}>Add both a before and an after image.</div>
  }
  const setFromClientX = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)))
  }
  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-xl select-none" style={{ height }}
      onPointerMove={(e) => { if (e.buttons === 1) setFromClientX(e.clientX) }}
      onPointerDown={(e) => setFromClientX(e.clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt={element.beforeAfterBeforeLabel || 'Before'} className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt={element.beforeAfterAfterLabel || 'After'} className="absolute inset-0 h-full object-cover" style={{ width: ref.current?.clientWidth || '100%' }} draggable={false} />
      </div>
      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">{element.beforeAfterAfterLabel || 'After'}</span>
      <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-xs">{element.beforeAfterBeforeLabel || 'Before'}</span>
      <div role="slider" aria-valuenow={Math.round(pos)} aria-valuemin={0} aria-valuemax={100} tabIndex={0}
        className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
        onKeyDown={(e) => { if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 2)); if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 2)) }}
      >
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-slate-700 text-xs">↔</span>
      </div>
    </div>
  )
}
```

Note: the after-image width uses the container width so it does not squish as the reveal changes. If `ref.current` is null on first render, `'100%'` is an acceptable fallback (corrected on next paint).

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/components/elements/PublicBeforeAfterElement.test.tsx`

- [ ] **Step 5: Implement the editor component**

Mirror `ColorPaletteElement.tsx` outer structure. Body: two upload controls (before, after) reusing the `/api/upload` shape from `ImageElement.tsx`, each writing `beforeAfterBefore` / `beforeAfterAfter`; two label inputs; a height number input. Show small thumbnails of whichever images are set.

- [ ] **Step 6: Wire it in** (recipe §4-7):
  - `index.ts`: export both.
  - `SlashCommandMenu.tsx`: import `Contrast` from lucide; `{ id: 'before-after', label: 'Before / After', icon: Contrast, description: 'Draggable image comparison', category: 'Media' }`.
  - `ColumnCanvas.tsx`: `case 'before-after'` per recipe §6.
  - `render-elements.tsx`: `case 'before-after': return <PublicBeforeAfterElement element={element} />`.

- [ ] **Step 7: Verify gates** — `npx tsc --noEmit`; `npx vitest run`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(elements): before/after image slider"
```

---

## Task 5: `tip-jar` — Tip jar / support button

**Files:** canvas.ts · `TipJarElement.tsx` (new) · `PublicTipJarElement.tsx` (new) · index.ts · SlashCommandMenu.tsx · ColumnCanvas.tsx · render-elements.tsx · `PublicTipJarElement.test.tsx` (new)

**Interfaces:**
- Consumes: `safeHref` (Task 0).
- Produces: `ElementType` gains `'tip-jar'`; `CanvasElement` gains `tipJarTitle?`, `tipJarMessage?`, `tipJarPlatform?`, `tipJarUrl?`, `tipJarButtonText?`, `tipJarAmounts?`.

**Data model:**
```ts
  | 'tip-jar'                // Batch 1: tip jar / support button
  // Tip jar specific
  tipJarTitle?: string
  tipJarMessage?: string
  tipJarPlatform?: 'kofi' | 'venmo' | 'paypal' | 'cashapp' | 'stripe' | 'custom'
  tipJarUrl?: string
  tipJarButtonText?: string
  tipJarAmounts?: string[]
// createElement:
    case 'tip-jar':
      return { ...base, tipJarTitle: 'Support my work', tipJarMessage: 'If you enjoy what I do, consider leaving a tip 💚', tipJarPlatform: 'custom', tipJarUrl: '', tipJarButtonText: 'Leave a tip', tipJarAmounts: ['$3', '$5', '$10'] }
```

- [ ] **Step 1: Write the failing Public test**

```tsx
// src/components/elements/PublicTipJarElement.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicTipJarElement } from './PublicTipJarElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'tip-jar', ...over })

describe('PublicTipJarElement', () => {
  it('renders a CTA linking to a safe url in a new tab', () => {
    render(<PublicTipJarElement element={el({ tipJarUrl: 'https://ko-fi.com/x', tipJarButtonText: 'Tip me' })} />)
    const link = screen.getByRole('link', { name: /tip me/i })
    expect(link).toHaveAttribute('href', 'https://ko-fi.com/x')
    expect(link).toHaveAttribute('target', '_blank')
  })
  it('renders no actionable link when url is empty or unsafe', () => {
    render(<PublicTipJarElement element={el({ tipJarUrl: 'javascript:x', tipJarButtonText: 'Tip me' })} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('renders suggested amount chips', () => {
    render(<PublicTipJarElement element={el({ tipJarUrl: 'https://a.com', tipJarAmounts: ['$3', '$5'] })} />)
    expect(screen.getByText('$3')).toBeInTheDocument()
    expect(screen.getByText('$5')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest run src/components/elements/PublicTipJarElement.test.tsx`

- [ ] **Step 3: Implement the Public component**

```tsx
// src/components/elements/PublicTipJarElement.tsx
import { Heart } from 'lucide-react'
import type { CanvasElement } from '@/lib/types/canvas'
import { safeHref } from '@/lib/editor/safe-href'

export function PublicTipJarElement({ element }: { element: CanvasElement }) {
  const href = safeHref(element.tipJarUrl)
  const amounts = (element.tipJarAmounts || []).filter(Boolean)
  return (
    <div className="max-w-md mx-auto rounded-2xl border border-border bg-surface p-5 text-center space-y-3">
      {element.tipJarTitle && <h3 className="text-lg font-bold">{element.tipJarTitle}</h3>}
      {element.tipJarMessage && <p className="text-sm text-muted-foreground">{element.tipJarMessage}</p>}
      {amounts.length > 0 && (
        <div className="flex justify-center gap-2 flex-wrap">
          {amounts.map((a, i) => (
            href
              ? <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-full border border-border text-sm font-medium hover:border-primary transition">{a}</a>
              : <span key={i} className="px-3 py-1.5 rounded-full border border-border text-sm font-medium text-muted-foreground">{a}</span>
          ))}
        </div>
      )}
      {href && (
        <a href={href} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition">
          <Heart className="w-4 h-4" /> {element.tipJarButtonText || 'Leave a tip'}
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run — expect PASS.** `npx vitest run src/components/elements/PublicTipJarElement.test.tsx`

- [ ] **Step 5: Implement the editor component**

Mirror `ColorPaletteElement.tsx` outer structure. Body: title input; message textarea; platform `<select>` (`kofi|venmo|paypal|cashapp|stripe|custom`); url input; button-text input; an amounts input (comma-separated string ↔ `tipJarAmounts` array via `.split(',').map(s => s.trim()).filter(Boolean)`).

- [ ] **Step 6: Wire it in** (recipe §4-7):
  - `index.ts`: export both.
  - `SlashCommandMenu.tsx`: import `HandCoins` from lucide (fallback `Heart` if unavailable); `{ id: 'tip-jar', label: 'Tip Jar', icon: HandCoins, description: 'Support / donate button', category: 'Media' }`.
  - `ColumnCanvas.tsx`: `case 'tip-jar'` per recipe §6.
  - `render-elements.tsx`: `case 'tip-jar': return <PublicTipJarElement element={element} />`.

- [ ] **Step 7: Verify gates** — `npx tsc --noEmit`; `npx vitest run`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(elements): tip jar / support button"
```

---

## Self-review notes (verified against spec)

- **Spec coverage:** all five elements + the PageEditor default-fallback refactor + `safeHref` link guard + image-upload reuse are each a task/step. Categories all in `CATEGORY_ORDER`. ✔
- **createElement single-source:** Task 0 adds the fallback; no per-element `PageEditor` edits. ✔
- **Type consistency:** field names used in components exactly match the `CanvasElement` additions in each task's data model block. ✔
- **Testability:** each element's Public surface has a real behavioral test; countdown extracts a pure `remainingParts` helper to avoid timer flakiness. ✔
- **Icon availability:** confirmed present in the installed `lucide-react` — `Link2`, `Images`, `Timer`, `Contrast`, `HandCoins`, `Instagram`, `Twitter`, `Youtube`, `Github`, `Linkedin`, `Facebook`, `Twitch`, `Heart`, `ChevronLeft`, `ChevronRight`. No fallback needed.
