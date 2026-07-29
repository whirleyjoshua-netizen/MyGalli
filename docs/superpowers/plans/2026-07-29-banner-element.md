# Banner Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `banner` canvas element with seven visual presets (heraldic, announcement, hero) placeable anywhere on a page.

**Architecture:** One `ElementType` member plus `banner*` fields on `CanvasElement`. All shape and color math lives in one pure module (`banner/presets.ts` + `banner/BannerShape.tsx`); the editor component and the public component both render through it, so they cannot drift. Configuration is inspector-native — no gear modal.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind, Vitest + @testing-library/react.

## Global Constraints

- Work in the worktree `C:\Users\whirl\pages-mvp\.claude\worktrees\feat-banner-element` on branch `worktree-feat-banner-element`. **Gate every commit:** `[ "$(git branch --show-current)" = "worktree-feat-banner-element" ] || exit 1` as the FIRST clause.
- Stored field names are `banner*` — the inspector writes stored names, never component prop names.
- Element defaults live in `createElement()` in `src/lib/types/canvas.ts` — the single source.
- Free element. No `isPro` checks anywhere.
- Brand colors: Primary `#39D98A`, Anchor `#0F3D2E`, Aqua `#1FB6FF`, Violet `#6C63FF`.
- Slash-menu category is `Content` (no `Design` category exists in `CATEGORY_ORDER`).
- Links must pass through `safeHref` from `src/lib/editor/safe-href.ts`.
- Run vitest suites **one at a time** — never two concurrently (known worker-spawn timeouts).
- Before finishing, lint bypassing the ESLint cascade: `./node_modules/.bin/eslint --no-eslintrc --config .eslintrc.json --ext .ts,.tsx <changed files>`.

## Deviations from the spec

Three, all deliberate:

1. **Slash-menu category is `Content`, not `Design`.** No `Design` category exists in `CATEGORY_ORDER`; adding one would relayout the menu for every element. Out of scope here.
2. **Text color derives from the fill, not the preset.** The spec assigned an AA-safe color per preset, but a ribbon on mint and a ribbon on anchor need different text. `resolveFill` pairs each solid token with its safe text color, and always scrims gradients and images with light text — the same guarantee, correctly scoped.
3. **Image fill takes a URL, not an uploader.** The spec said to reuse the existing upload path. That means wiring the blob upload component into the inspector, which is a meaningfully larger job and a second review surface. A URL field ships the feature; an upload button is a clean follow-up that changes only `BannerInspector`. **Flag to the user if this is not acceptable before starting Task 5.**

---

### Task 1: Types and defaults

**Files:**
- Modify: `src/lib/types/canvas.ts` (ElementType union ~line 178; CanvasElement fields; `createElement()` ~line 1392)
- Test: `src/lib/types/canvas.banner.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type BannerPreset = 'ribbon' | 'pennant' | 'crest' | 'strip' | 'notice' | 'hero' | 'band'`; `type BannerFillKind = 'token' | 'gradient' | 'image'`; element fields `bannerPreset: BannerPreset`, `bannerHeading?: string`, `bannerSubtext?: string`, `bannerFillKind: BannerFillKind`, `bannerFillValue: string`, `bannerLinkLabel?: string`, `bannerLinkUrl?: string`; `createElement('banner')`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/canvas.banner.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe('createElement("banner")', () => {
  it('produces the documented default shape', () => {
    const el = createElement('banner')
    expect(el.type).toBe('banner')
    expect(el.bannerPreset).toBe('ribbon')
    expect(el.bannerHeading).toBe('Your headline')
    expect(el.bannerSubtext).toBe('')
    expect(el.bannerFillKind).toBe('token')
    expect(el.bannerFillValue).toBe('primary')
    expect(el.bannerLinkLabel).toBe('')
    expect(el.bannerLinkUrl).toBe('')
  })

  it('gives each banner a distinct id', () => {
    expect(createElement('banner').id).not.toBe(createElement('banner').id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/types/canvas.banner.test.ts`
Expected: FAIL — TypeScript rejects `'banner'` as an `ElementType`.

- [ ] **Step 3: Add the type members**

In `src/lib/types/canvas.ts`, add to the `ElementType` union immediately after the `| 'index'` line:

```ts
  // Design
  | 'banner'                // Decorative / announcement banner with shape presets
```

Add these exported types near the other element-specific types (e.g. beside `MapPlace`):

```ts
export type BannerPreset =
  | 'ribbon' | 'pennant' | 'crest'   // heraldic
  | 'strip' | 'notice'               // announcement
  | 'hero' | 'band'                  // hero

export type BannerFillKind = 'token' | 'gradient' | 'image'
```

Add to the `CanvasElement` interface, beside the other element field groups:

```ts
  // Banner
  bannerPreset?: BannerPreset
  bannerHeading?: string
  bannerSubtext?: string
  bannerFillKind?: BannerFillKind
  bannerFillValue?: string
  bannerLinkLabel?: string
  bannerLinkUrl?: string
```

- [ ] **Step 4: Add the createElement case**

In `createElement()`, immediately after the `case 'product-list':` branch:

```ts
    case 'banner':
      return {
        ...base,
        bannerPreset: 'ribbon',
        bannerHeading: 'Your headline',
        bannerSubtext: '',
        bannerFillKind: 'token',
        bannerFillValue: 'primary',
        bannerLinkLabel: '',
        bannerLinkUrl: '',
      }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/types/canvas.banner.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "worktree-feat-banner-element" ] || exit 1
git add src/lib/types/canvas.ts src/lib/types/canvas.banner.test.ts
git commit -m "feat(banner): element type, fields and defaults"
```

---

### Task 2: Preset and fill tables

**Files:**
- Create: `src/components/elements/banner/presets.ts`
- Test: `src/components/elements/banner/presets.test.ts`

**Interfaces:**
- Consumes: `BannerPreset`, `BannerFillKind` from Task 1.
- Produces:
  - `interface PresetSpec { minHeight: number; align: 'left' | 'center'; headingClass: string; subtextClass: string; clipPath?: string; borderRadius?: string; accentBar?: boolean }`
  - `const BANNER_PRESETS: Record<BannerPreset, PresetSpec>`
  - `interface ResolvedFill { background: string; scrim: boolean; text: 'light' | 'dark' }`
  - `function resolveFill(kind: BannerFillKind | undefined, value: string | undefined): ResolvedFill`
  - `const FILL_TOKENS: Record<string, { css: string; text: 'light' | 'dark' }>`
  - `const FILL_GRADIENTS: Record<string, string>`

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/banner/presets.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BANNER_PRESETS, resolveFill } from './presets'

describe('BANNER_PRESETS', () => {
  it('covers all seven presets', () => {
    expect(Object.keys(BANNER_PRESETS).sort()).toEqual(
      ['band', 'crest', 'hero', 'notice', 'pennant', 'ribbon', 'strip']
    )
  })

  it('gives heraldic presets a shape and announcement presets none', () => {
    expect(BANNER_PRESETS.ribbon.clipPath).toBeTruthy()
    expect(BANNER_PRESETS.pennant.clipPath).toBeTruthy()
    expect(BANNER_PRESETS.strip.clipPath).toBeUndefined()
    expect(BANNER_PRESETS.hero.clipPath).toBeUndefined()
  })

  it('scales height from strip up to hero', () => {
    expect(BANNER_PRESETS.strip.minHeight).toBeLessThan(BANNER_PRESETS.band.minHeight)
    expect(BANNER_PRESETS.band.minHeight).toBeLessThan(BANNER_PRESETS.hero.minHeight)
  })
})

describe('resolveFill', () => {
  it('resolves a brand token to a solid color with no scrim', () => {
    const f = resolveFill('token', 'primary')
    expect(f.background).toBe('#39D98A')
    expect(f.scrim).toBe(false)
    expect(f.text).toBe('dark')
  })

  it('uses light text on the dark anchor token', () => {
    expect(resolveFill('token', 'anchor').text).toBe('light')
  })

  it('always scrims gradients and forces light text', () => {
    const f = resolveFill('gradient', 'mint-aqua')
    expect(f.background).toContain('linear-gradient')
    expect(f.scrim).toBe(true)
    expect(f.text).toBe('light')
  })

  it('always scrims images and forces light text', () => {
    const f = resolveFill('image', 'https://blob.example/x.jpg')
    expect(f.background).toContain('https://blob.example/x.jpg')
    expect(f.scrim).toBe(true)
    expect(f.text).toBe('light')
  })

  it('falls back to the primary token when the value is unknown or missing', () => {
    expect(resolveFill('token', 'nope').background).toBe('#39D98A')
    expect(resolveFill(undefined, undefined).background).toBe('#39D98A')
    expect(resolveFill('gradient', 'nope').background).toContain('linear-gradient')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/banner/presets.test.ts`
Expected: FAIL — cannot resolve `./presets`.

- [ ] **Step 3: Write the implementation**

Create `src/components/elements/banner/presets.ts`:

```ts
import type { BannerFillKind, BannerPreset } from '@/lib/types/canvas'

export interface PresetSpec {
  minHeight: number
  align: 'left' | 'center'
  headingClass: string
  subtextClass: string
  clipPath?: string
  borderRadius?: string
  accentBar?: boolean
}

export const BANNER_PRESETS: Record<BannerPreset, PresetSpec> = {
  // Heraldic
  ribbon: {
    minHeight: 72,
    align: 'center',
    headingClass: 'text-lg font-semibold tracking-tight',
    subtextClass: 'text-xs opacity-90',
    clipPath: 'polygon(0 0, 100% 0, calc(100% - 24px) 50%, 100% 100%, 0 100%, 24px 50%)',
  },
  pennant: {
    minHeight: 64,
    align: 'left',
    headingClass: 'text-base font-semibold tracking-tight',
    subtextClass: 'text-xs opacity-90',
    clipPath: 'polygon(0 0, 100% 0, calc(100% - 32px) 50%, 100% 100%, 0 100%)',
  },
  crest: {
    minHeight: 120,
    align: 'center',
    headingClass: 'text-xl font-semibold tracking-tight',
    subtextClass: 'text-sm opacity-90',
    borderRadius: '9999px 9999px 12px 12px',
  },
  // Announcement
  strip: {
    minHeight: 44,
    align: 'center',
    headingClass: 'text-sm font-medium',
    subtextClass: 'text-xs opacity-80',
  },
  notice: {
    minHeight: 56,
    align: 'left',
    headingClass: 'text-sm font-semibold',
    subtextClass: 'text-xs opacity-85',
    borderRadius: '8px',
    accentBar: true,
  },
  // Hero
  hero: {
    minHeight: 240,
    align: 'center',
    headingClass: 'text-3xl sm:text-4xl font-bold tracking-tight',
    subtextClass: 'text-base opacity-90',
  },
  band: {
    minHeight: 140,
    align: 'center',
    headingClass: 'text-2xl font-semibold tracking-tight',
    subtextClass: 'text-sm opacity-90',
  },
}

export const FILL_TOKENS: Record<string, { css: string; text: 'light' | 'dark' }> = {
  primary: { css: '#39D98A', text: 'dark' },
  anchor: { css: '#0F3D2E', text: 'light' },
  aqua: { css: '#1FB6FF', text: 'dark' },
  violet: { css: '#6C63FF', text: 'light' },
}

export const FILL_GRADIENTS: Record<string, string> = {
  'mint-aqua': 'linear-gradient(135deg, #39D98A 0%, #1FB6FF 100%)',
  'aqua-violet': 'linear-gradient(135deg, #1FB6FF 0%, #6C63FF 100%)',
  'anchor-mint': 'linear-gradient(135deg, #0F3D2E 0%, #39D98A 100%)',
}

export interface ResolvedFill {
  background: string
  scrim: boolean
  text: 'light' | 'dark'
}

/**
 * Text color is derived from the FILL, not the preset — a ribbon on mint and a
 * ribbon on anchor need different text. Gradients and images always get a scrim
 * plus light text, which is the only combination guaranteed readable over
 * arbitrary user imagery.
 */
export function resolveFill(kind: BannerFillKind | undefined, value: string | undefined): ResolvedFill {
  if (kind === 'gradient') {
    return {
      background: FILL_GRADIENTS[value ?? ''] ?? FILL_GRADIENTS['mint-aqua'],
      scrim: true,
      text: 'light',
    }
  }
  if (kind === 'image' && value) {
    return {
      background: `url("${value.replace(/"/g, '%22')}") center / cover no-repeat`,
      scrim: true,
      text: 'light',
    }
  }
  const token = FILL_TOKENS[value ?? ''] ?? FILL_TOKENS.primary
  return { background: token.css, scrim: false, text: token.text }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/elements/banner/presets.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "worktree-feat-banner-element" ] || exit 1
git add src/components/elements/banner/presets.ts src/components/elements/banner/presets.test.ts
git commit -m "feat(banner): preset and fill tables"
```

---

### Task 3: BannerShape — the single rendering path

**Files:**
- Create: `src/components/elements/banner/BannerShape.tsx`
- Test: `src/components/elements/banner/BannerShape.test.tsx`

**Interfaces:**
- Consumes: `BANNER_PRESETS`, `resolveFill` (Task 2); `safeHref` from `@/lib/editor/safe-href`.
- Produces:
```ts
interface BannerShapeProps {
  preset: BannerPreset
  heading?: string
  subtext?: string
  fillKind?: BannerFillKind
  fillValue?: string
  linkLabel?: string
  linkUrl?: string
  headingNode?: React.ReactNode   // editor override; replaces the heading text
  subtextNode?: React.ReactNode   // editor override; replaces the subtext text
}
export function BannerShape(props: BannerShapeProps): JSX.Element
```

This component is pure and presentational: no store access, no editing logic, no `onChange`. Both the editor and the public component render through it.

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/banner/BannerShape.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BannerShape } from './BannerShape'
import type { BannerPreset } from '@/lib/types/canvas'

const ALL: BannerPreset[] = ['ribbon', 'pennant', 'crest', 'strip', 'notice', 'hero', 'band']

describe('BannerShape', () => {
  it.each(ALL)('renders the %s preset with its heading', (preset) => {
    render(<BannerShape preset={preset} heading={`H-${preset}`} />)
    expect(screen.getByText(`H-${preset}`)).toBeInTheDocument()
  })

  it('renders subtext when present and omits it when blank', () => {
    const { rerender } = render(<BannerShape preset="hero" heading="Hi" subtext="Sub" />)
    expect(screen.getByText('Sub')).toBeInTheDocument()
    rerender(<BannerShape preset="hero" heading="Hi" subtext="" />)
    expect(screen.queryByText('Sub')).not.toBeInTheDocument()
  })

  it('renders the link only when BOTH label and url are set', () => {
    const { rerender } = render(
      <BannerShape preset="strip" heading="Hi" linkLabel="Go" linkUrl="https://x.test" />
    )
    expect(screen.getByRole('link', { name: 'Go' })).toHaveAttribute('href', 'https://x.test')

    rerender(<BannerShape preset="strip" heading="Hi" linkLabel="Go" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    rerender(<BannerShape preset="strip" heading="Hi" linkUrl="https://x.test" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('neutralizes a javascript: link url', () => {
    render(
      <BannerShape preset="strip" heading="Hi" linkLabel="Go" linkUrl="javascript:alert(1)" />
    )
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('renders headingNode instead of heading when provided', () => {
    render(
      <BannerShape preset="band" heading="plain" headingNode={<span>edited</span>} />
    )
    expect(screen.getByText('edited')).toBeInTheDocument()
    expect(screen.queryByText('plain')).not.toBeInTheDocument()
  })

  it('applies a scrim for image fills but not for token fills', () => {
    const { container: img } = render(
      <BannerShape preset="hero" heading="Hi" fillKind="image" fillValue="https://b.test/a.jpg" />
    )
    expect(img.querySelector('[data-banner-scrim]')).not.toBeNull()

    const { container: tok } = render(
      <BannerShape preset="hero" heading="Hi" fillKind="token" fillValue="primary" />
    )
    expect(tok.querySelector('[data-banner-scrim]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/banner/BannerShape.test.tsx`
Expected: FAIL — cannot resolve `./BannerShape`.

- [ ] **Step 3: Write the implementation**

Create `src/components/elements/banner/BannerShape.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import type { BannerFillKind, BannerPreset } from '@/lib/types/canvas'
import { safeHref } from '@/lib/editor/safe-href'
import { BANNER_PRESETS, resolveFill } from './presets'

export interface BannerShapeProps {
  preset: BannerPreset
  heading?: string
  subtext?: string
  fillKind?: BannerFillKind
  fillValue?: string
  linkLabel?: string
  linkUrl?: string
  headingNode?: ReactNode
  subtextNode?: ReactNode
}

export function BannerShape({
  preset,
  heading,
  subtext,
  fillKind,
  fillValue,
  linkLabel,
  linkUrl,
  headingNode,
  subtextNode,
}: BannerShapeProps) {
  const spec = BANNER_PRESETS[preset] ?? BANNER_PRESETS.ribbon
  const fill = resolveFill(fillKind, fillValue)
  const href = safeHref(linkUrl)
  const showLink = Boolean(linkLabel && href)

  const textColor = fill.text === 'light' ? '#FFFFFF' : '#0F3D2E'
  const padX = spec.clipPath ? 48 : 24

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        minHeight: spec.minHeight,
        background: fill.background,
        clipPath: spec.clipPath,
        borderRadius: spec.borderRadius,
        color: textColor,
      }}
    >
      {fill.scrim && (
        <div
          data-banner-scrim
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(15,61,46,0.5)' }}
        />
      )}

      {spec.accentBar && (
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: textColor, opacity: 0.6 }}
        />
      )}

      <div
        className="relative flex h-full flex-col justify-center gap-1"
        style={{
          minHeight: spec.minHeight,
          padding: `12px ${padX}px`,
          alignItems: spec.align === 'center' ? 'center' : 'flex-start',
          textAlign: spec.align,
        }}
      >
        <div className={spec.headingClass}>{headingNode ?? heading}</div>

        {(subtextNode || subtext) && (
          <div className={spec.subtextClass}>{subtextNode ?? subtext}</div>
        )}

        {showLink && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-full px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-85"
            style={{ background: textColor, color: fill.text === 'light' ? '#0F3D2E' : '#FFFFFF' }}
          >
            {linkLabel}
          </a>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/elements/banner/BannerShape.test.tsx`
Expected: PASS, 12 tests (7 parameterized + 5).

- [ ] **Step 5: Commit**

```bash
[ "$(git branch --show-current)" = "worktree-feat-banner-element" ] || exit 1
git add src/components/elements/banner/BannerShape.tsx src/components/elements/banner/BannerShape.test.tsx
git commit -m "feat(banner): shared BannerShape rendering module"
```

---

### Task 4: Public and editor components

**Files:**
- Create: `src/components/elements/PublicBanner.tsx`
- Create: `src/components/elements/BannerElement.tsx`
- Test: `src/components/elements/BannerElement.test.tsx`

**Interfaces:**
- Consumes: `BannerShape` (Task 3), element fields (Task 1).
- Produces:
  - `export function PublicBanner({ element }: { element: CanvasElement })`
  - `export function BannerElement({ element, onChange, onDelete, isSelected, onSelect }: BannerElementProps)`

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/BannerElement.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BannerElement } from './BannerElement'
import { PublicBanner } from './PublicBanner'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'b1', type: 'banner',
  bannerPreset: 'ribbon',
  bannerHeading: 'Your headline',
  bannerSubtext: '',
  bannerFillKind: 'token',
  bannerFillValue: 'primary',
  bannerLinkLabel: '',
  bannerLinkUrl: '',
  ...over,
} as CanvasElement)

describe('PublicBanner', () => {
  it('renders the heading read-only', () => {
    render(<PublicBanner element={el({ bannerHeading: 'Grand Opening' })} />)
    expect(screen.getByText('Grand Opening')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})

describe('BannerElement', () => {
  it('edits the heading inline → bannerHeading', () => {
    const onChange = vi.fn()
    render(
      <BannerElement element={el()} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText(/banner heading/i), { target: { value: 'Now booking' } })
    expect(onChange).toHaveBeenCalledWith({ bannerHeading: 'Now booking' })
  })

  it('edits the subtext inline → bannerSubtext', () => {
    const onChange = vi.fn()
    render(
      <BannerElement element={el()} onChange={onChange} onDelete={vi.fn()} isSelected onSelect={vi.fn()} />
    )
    fireEvent.change(screen.getByLabelText(/banner subtext/i), { target: { value: 'Spring 2026' } })
    expect(onChange).toHaveBeenCalledWith({ bannerSubtext: 'Spring 2026' })
  })

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn()
    render(
      <BannerElement element={el()} onChange={vi.fn()} onDelete={vi.fn()} isSelected={false} onSelect={onSelect} />
    )
    fireEvent.click(screen.getByTestId('banner-editor'))
    expect(onSelect).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/elements/BannerElement.test.tsx`
Expected: FAIL — cannot resolve `./BannerElement`.

- [ ] **Step 3: Write PublicBanner**

Create `src/components/elements/PublicBanner.tsx`:

```tsx
'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { BannerShape } from './banner/BannerShape'

export function PublicBanner({ element }: { element: CanvasElement }) {
  return (
    <BannerShape
      preset={element.bannerPreset ?? 'ribbon'}
      heading={element.bannerHeading}
      subtext={element.bannerSubtext}
      fillKind={element.bannerFillKind}
      fillValue={element.bannerFillValue}
      linkLabel={element.bannerLinkLabel}
      linkUrl={element.bannerLinkUrl}
    />
  )
}
```

- [ ] **Step 4: Write BannerElement**

Create `src/components/elements/BannerElement.tsx`. The heading and subtext are transparent inputs layered into the shape's own slots, so what you type sits exactly where it will publish:

```tsx
'use client'

import type { CanvasElement } from '@/lib/types/canvas'
import { BannerShape } from './banner/BannerShape'

interface BannerElementProps {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const INLINE =
  'w-full bg-transparent border-none outline-none placeholder:opacity-60 text-inherit font-inherit'

export function BannerElement({ element, onChange, isSelected, onSelect }: BannerElementProps) {
  const centered = (element.bannerPreset ?? 'ribbon') !== 'pennant'
    && (element.bannerPreset ?? 'ribbon') !== 'notice'

  return (
    <div
      data-testid="banner-editor"
      onClick={onSelect}
      className={`relative rounded-lg transition-shadow ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <BannerShape
        preset={element.bannerPreset ?? 'ribbon'}
        fillKind={element.bannerFillKind}
        fillValue={element.bannerFillValue}
        linkLabel={element.bannerLinkLabel}
        linkUrl={element.bannerLinkUrl}
        headingNode={
          <input
            type="text"
            aria-label="Banner heading"
            className={INLINE}
            style={{ textAlign: centered ? 'center' : 'left' }}
            value={element.bannerHeading ?? ''}
            placeholder="Your headline"
            onChange={(e) => onChange({ bannerHeading: e.target.value })}
          />
        }
        subtextNode={
          <input
            type="text"
            aria-label="Banner subtext"
            className={INLINE}
            style={{ textAlign: centered ? 'center' : 'left' }}
            value={element.bannerSubtext ?? ''}
            placeholder="Optional supporting line"
            onChange={(e) => onChange({ bannerSubtext: e.target.value })}
          />
        }
      />
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/elements/BannerElement.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "worktree-feat-banner-element" ] || exit 1
git add src/components/elements/BannerElement.tsx src/components/elements/PublicBanner.tsx src/components/elements/BannerElement.test.tsx
git commit -m "feat(banner): editor and public components"
```

---

### Task 5: BannerInspector

**Files:**
- Create: `src/components/editor/panel/inspectors/BannerInspector.tsx`
- Modify: `src/components/editor/panel/inspectors/registry.tsx`
- Test: `src/components/editor/panel/inspectors/BannerInspector.test.tsx`

**Interfaces:**
- Consumes: `InspectorProps` (`{ element, onChange, isPro }`) from `./DefaultInspector`; `FILL_TOKENS`, `FILL_GRADIENTS` (Task 2).
- Produces: `export function BannerInspector(props: InspectorProps)`; registry entry `banner: BannerInspector`.

**Critical:** the inspector writes **stored** names (`bannerPreset`, `bannerFillKind`, …), never component prop names. This is the trap the KPI migration hit.

- [ ] **Step 1: Write the failing test**

Create `src/components/editor/panel/inspectors/BannerInspector.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BannerInspector } from './BannerInspector'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement> = {}): CanvasElement => ({
  id: 'b1', type: 'banner',
  bannerPreset: 'ribbon',
  bannerHeading: 'Your headline',
  bannerSubtext: '',
  bannerFillKind: 'token',
  bannerFillValue: 'primary',
  bannerLinkLabel: '',
  bannerLinkUrl: '',
  ...over,
} as CanvasElement)

const setup = (over: Partial<CanvasElement> = {}) => {
  const onChange = vi.fn()
  render(<BannerInspector element={el(over)} onChange={onChange} isPro={false} />)
  return onChange
}

describe('BannerInspector', () => {
  it('changes preset → bannerPreset', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/style/i), { target: { value: 'hero' } })
    expect(onChange).toHaveBeenCalledWith({ bannerPreset: 'hero' })
  })

  it('changes heading → bannerHeading', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/heading/i), { target: { value: 'Sale' } })
    expect(onChange).toHaveBeenCalledWith({ bannerHeading: 'Sale' })
  })

  it('changes subtext → bannerSubtext', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/subtext/i), { target: { value: 'Ends Friday' } })
    expect(onChange).toHaveBeenCalledWith({ bannerSubtext: 'Ends Friday' })
  })

  it('changes link label and url → bannerLinkLabel / bannerLinkUrl', () => {
    const onChange = setup()
    fireEvent.change(screen.getByLabelText(/button label/i), { target: { value: 'Book' } })
    expect(onChange).toHaveBeenCalledWith({ bannerLinkLabel: 'Book' })
    fireEvent.change(screen.getByLabelText(/button link/i), { target: { value: 'https://x.test' } })
    expect(onChange).toHaveBeenCalledWith({ bannerLinkUrl: 'https://x.test' })
  })

  it('switching fill kind clears the stale fill value', () => {
    const onChange = setup({ bannerFillKind: 'token', bannerFillValue: 'primary' })
    fireEvent.change(screen.getByLabelText(/fill type/i), { target: { value: 'gradient' } })
    expect(onChange).toHaveBeenCalledWith({ bannerFillKind: 'gradient', bannerFillValue: 'mint-aqua' })
  })

  it('switching to image fill clears the value entirely', () => {
    const onChange = setup({ bannerFillKind: 'gradient', bannerFillValue: 'mint-aqua' })
    fireEvent.change(screen.getByLabelText(/fill type/i), { target: { value: 'image' } })
    expect(onChange).toHaveBeenCalledWith({ bannerFillKind: 'image', bannerFillValue: '' })
  })

  it('offers gradient names when the fill kind is gradient', () => {
    setup({ bannerFillKind: 'gradient', bannerFillValue: 'mint-aqua' })
    expect(screen.getByLabelText(/gradient/i)).toHaveValue('mint-aqua')
  })

  it('reflects the current preset', () => {
    setup({ bannerPreset: 'crest' })
    expect(screen.getByLabelText(/style/i)).toHaveValue('crest')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/editor/panel/inspectors/BannerInspector.test.tsx`
Expected: FAIL — cannot resolve `./BannerInspector`.

- [ ] **Step 3: Write the inspector**

Create `src/components/editor/panel/inspectors/BannerInspector.tsx`:

```tsx
'use client'

import type { BannerFillKind, BannerPreset } from '@/lib/types/canvas'
import type { InspectorProps } from './DefaultInspector'
import { FILL_GRADIENTS, FILL_TOKENS } from '@/components/elements/banner/presets'

const FIELD =
  'mt-1 w-full text-sm bg-muted rounded-md px-2 py-1.5 border border-border focus:outline-none focus:ring-2 focus:ring-primary'

const PRESET_GROUPS: { label: string; options: { value: string; label: string }[] }[] = [
  { label: 'Heraldic', options: [
    { value: 'ribbon', label: 'Ribbon' },
    { value: 'pennant', label: 'Pennant' },
    { value: 'crest', label: 'Crest' },
  ] },
  { label: 'Announcement', options: [
    { value: 'strip', label: 'Strip' },
    { value: 'notice', label: 'Notice' },
  ] },
  { label: 'Hero', options: [
    { value: 'hero', label: 'Hero' },
    { value: 'band', label: 'Band' },
  ] },
]

/** Switching fill kind must replace the value — a gradient name left in an image slot renders nothing. */
const DEFAULT_FILL_VALUE: Record<BannerFillKind, string> = {
  token: 'primary',
  gradient: 'mint-aqua',
  image: '',
}

export function BannerInspector({ element, onChange }: InspectorProps) {
  const fillKind = (element.bannerFillKind ?? 'token') as BannerFillKind

  return (
    <div className="px-3 py-2 space-y-3">
      <label className="block text-xs text-muted-foreground">
        Style
        <select
          className={FIELD}
          value={element.bannerPreset ?? 'ribbon'}
          onChange={(e) => onChange({ bannerPreset: e.target.value as BannerPreset })}
        >
          {PRESET_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="block text-xs text-muted-foreground">
        Fill type
        <select
          className={FIELD}
          value={fillKind}
          onChange={(e) => {
            const kind = e.target.value as BannerFillKind
            onChange({ bannerFillKind: kind, bannerFillValue: DEFAULT_FILL_VALUE[kind] })
          }}
        >
          <option value="token">Brand color</option>
          <option value="gradient">Gradient</option>
          <option value="image">Image</option>
        </select>
      </label>

      {fillKind === 'token' && (
        <label className="block text-xs text-muted-foreground">
          Brand color
          <select
            className={FIELD}
            value={element.bannerFillValue ?? 'primary'}
            onChange={(e) => onChange({ bannerFillValue: e.target.value })}
          >
            {Object.keys(FILL_TOKENS).map((k) => (
              <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>
            ))}
          </select>
        </label>
      )}

      {fillKind === 'gradient' && (
        <label className="block text-xs text-muted-foreground">
          Gradient
          <select
            className={FIELD}
            value={element.bannerFillValue ?? 'mint-aqua'}
            onChange={(e) => onChange({ bannerFillValue: e.target.value })}
          >
            {Object.keys(FILL_GRADIENTS).map((k) => (
              <option key={k} value={k}>{k.replace('-', ' → ')}</option>
            ))}
          </select>
        </label>
      )}

      {fillKind === 'image' && (
        <label className="block text-xs text-muted-foreground">
          Image URL
          <input
            type="text"
            className={FIELD}
            placeholder="https://…"
            value={element.bannerFillValue ?? ''}
            onChange={(e) => onChange({ bannerFillValue: e.target.value })}
          />
        </label>
      )}

      <label className="block text-xs text-muted-foreground">
        Heading
        <input
          type="text"
          className={FIELD}
          placeholder="Your headline"
          value={element.bannerHeading ?? ''}
          onChange={(e) => onChange({ bannerHeading: e.target.value })}
        />
      </label>

      <label className="block text-xs text-muted-foreground">
        Subtext
        <input
          type="text"
          className={FIELD}
          placeholder="Optional supporting line"
          value={element.bannerSubtext ?? ''}
          onChange={(e) => onChange({ bannerSubtext: e.target.value })}
        />
      </label>

      <label className="block text-xs text-muted-foreground">
        Button label
        <input
          type="text"
          className={FIELD}
          placeholder="Leave blank for no button"
          value={element.bannerLinkLabel ?? ''}
          onChange={(e) => onChange({ bannerLinkLabel: e.target.value })}
        />
      </label>

      <label className="block text-xs text-muted-foreground">
        Button link
        <input
          type="text"
          className={FIELD}
          placeholder="https://…"
          value={element.bannerLinkUrl ?? ''}
          onChange={(e) => onChange({ bannerLinkUrl: e.target.value })}
        />
      </label>

      <p className="text-[11px] text-muted-foreground/70 border-t border-border pt-2">
        Height, alignment and text color come from the style you pick. Image and gradient fills
        get a scrim so text stays readable.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Register the inspector**

In `src/components/editor/panel/inspectors/registry.tsx`, add the import beside the others:

```ts
import { BannerInspector } from './BannerInspector'
```

and the entry inside `ELEMENT_INSPECTORS`:

```ts
  banner: BannerInspector,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/editor/panel/inspectors/BannerInspector.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "worktree-feat-banner-element" ] || exit 1
git add src/components/editor/panel/inspectors/BannerInspector.tsx src/components/editor/panel/inspectors/BannerInspector.test.tsx src/components/editor/panel/inspectors/registry.tsx
git commit -m "feat(banner): inspector + registry entry"
```

---

### Task 6: Wire the remaining seams

**Files:**
- Modify: `src/components/elements/index.ts` (append near the other groups)
- Modify: `src/components/canvas/SlashCommandMenu.tsx` (command list ~line 164)
- Modify: `src/components/canvas/ColumnCanvas.tsx` (`renderElement`, beside `case 'countdown'` ~line 1347)
- Modify: `src/lib/render-elements.tsx` (beside `case 'countdown'` ~line 561)

**Interfaces:**
- Consumes: `BannerElement`, `PublicBanner` (Task 4).
- Produces: a `banner` reachable from the slash menu, rendering in the editor, in preview, and on the published page.

There is no test step here — this is pure wiring, verified end-to-end in Task 7.

- [ ] **Step 1: Export from the element barrel**

At the end of `src/components/elements/index.ts`:

```ts
// Design
export { BannerElement } from './BannerElement'
export { PublicBanner } from './PublicBanner'
```

- [ ] **Step 2: Add the slash-menu command**

In `src/components/canvas/SlashCommandMenu.tsx`, add `Flag` to the existing `lucide-react` import, then add after the `tip-jar` entry (~line 164):

```ts
  { id: 'banner', label: 'Banner', icon: Flag, description: 'Ribbon, announcement or hero band', category: 'Content' },
```

- [ ] **Step 3: Add the editor render case**

In `src/components/canvas/ColumnCanvas.tsx`, import `BannerElement` and `PublicBanner` alongside the other element imports, then add immediately before `case 'countdown':`:

```tsx
      case 'banner':
        if (isPreviewMode) return <PublicBanner element={element} />
        return (
          <BannerElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 4: Add the public render case**

In `src/lib/render-elements.tsx`, import `PublicBanner` alongside the other public imports, then add immediately before `case 'countdown':`:

```tsx
    case 'banner':
      return <PublicBanner element={element} />
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. A missing import or a stale `ElementType` will surface here.

- [ ] **Step 6: Commit**

```bash
[ "$(git branch --show-current)" = "worktree-feat-banner-element" ] || exit 1
git add src/components/elements/index.ts src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx
git commit -m "feat(banner): wire slash menu, canvas and public render seams"
```

---

### Task 7: Verification

**Files:** none modified unless a check fails.

- [ ] **Step 1: Run the banner suites, one at a time**

Never run two concurrently — concurrent runs produce phantom worker-spawn failures.

```bash
npx vitest run src/lib/types/canvas.banner.test.ts
npx vitest run src/components/elements/banner/presets.test.ts
npx vitest run src/components/elements/banner/BannerShape.test.tsx
npx vitest run src/components/elements/BannerElement.test.tsx
npx vitest run src/components/editor/panel/inspectors/BannerInspector.test.tsx
```

Expected: all PASS. Record the actual counts — do not claim success without reading the output.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Lint, bypassing the ESLint cascade**

An in-worktree `next lint` silently reports success when the parent repo's config conflicts. Use the explicit config:

```bash
./node_modules/.bin/eslint --no-eslintrc --config .eslintrc.json --ext .ts,.tsx \
  src/components/elements/BannerElement.tsx \
  src/components/elements/PublicBanner.tsx \
  src/components/elements/banner/BannerShape.tsx \
  src/components/elements/banner/presets.ts \
  src/components/editor/panel/inspectors/BannerInspector.tsx
```

Expected: no errors. Watch for `react/no-unescaped-entities` — the usual deploy-breaker.

- [ ] **Step 4: Browser smoke**

The worktree needs its own `pnpm install`, and `.env` is not inherited. Start a dev server on a free port (3000 may belong to another worktree):

```bash
pnpm install
export JWT_SECRET="$(sed -n 's/^JWT_SECRET=//p' ../../../.env | tr -d '\r' | tr -d '"')"
DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages" npx next dev -p 3100
```

Then, in the editor: insert a Banner via the slash menu; confirm it appears under **Content**; type a heading inline and see it on the canvas; open the right-bar inspector and change the style through all seven presets; switch fill type token → gradient → image and confirm the fill control swaps and no stale value persists; add a button label + URL and confirm the button appears; toggle preview and confirm the read-only version matches; publish and confirm the public page renders identically.

- [ ] **Step 5: Report honestly**

State which checks ran and their real output. If the browser smoke was not run, say so explicitly rather than implying it passed.
