# Map Element Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `map` element that lets creators drop photo-pins on an interactive map (places traveled / find-me), with category-filtered markers, an optional journey line, and deep-link directions — matching the spec at `docs/superpowers/specs/2026-07-04-map-element-design.md`.

**Architecture:** Pure `Display.sections` JSON config (no Prisma model, no API route). All map rendering is **imperative Leaflet** built inside `useEffect` (client-only, so no SSR) — no `react-leaflet` dependency. Marker icons and popup cards are **escaped HTML strings** produced by pure helper functions in `src/lib/map.ts`, which are the unit-tested core. The directions button is a plain `<a href>`, so popups need no React interactivity. Geocoding uses OSM Nominatim in the **editor only**, on explicit user action.

**Tech Stack:** Next.js 15.5.19 App Router · React 19 · TypeScript · Tailwind · `leaflet` (npm, bundled) · OpenStreetMap / Carto raster tiles · Nominatim geocoding · vitest + Testing Library.

## Global Constraints

- **No new Prisma model, no new API route, no migration.** Element is pure `Display.sections` JSON.
- **No map API key, no billing.** `leaflet` bundled from npm (never an external `<script>`). Tiles from `*.tile.openstreetmap.org` and `*.basemaps.cartocdn.com`.
- **Nominatim geocoding is editor-only**, triggered on explicit user action, one in-flight request, with attribution.
- **All fields element-namespaced** on `CanvasElement` (`map*`), all optional. Defaults live **only** in `createElement()` (`canvas.ts`); `PageEditor.handleCommandSelect` already falls through to it via an existing `default:` branch (lines 801–805) — **do not add a PageEditor case.**
- **Directions/photo links:** `target="_blank" rel="noopener noreferrer"`, `https?:` only.
- **All user text rendered into Leaflet HTML strings MUST be escaped** via `escapeHtml`; photo URLs guarded by `isSafePhotoUrl`.
- **Brand:** primary `#39D98A` (`bg-galli`/`text-galli`), anchor `#0F3D2E` (`text-galli-anchor`), Plus Jakarta Sans, `shadow-soft`, soft-rounded cards. Default tile style `light` (Carto Positron).
- **Gate every task** on `pnpm exec tsc --noEmit` + `pnpm test` (full vitest run) green.
- **Windows:** stop `pnpm dev` before any `pnpm build` (`.next` race). These tasks need no DB.
- Commit after each task.

---

### Task 1: Types and `createElement` default

**Files:**
- Modify: `src/lib/types/canvas.ts` (add to `ElementType` ~line 36; add `MapPlace`/`MapCategory` type exports; add fields to `CanvasElement`; add `case 'map'` in `createElement` ~line 577)
- Test: `src/lib/types/canvas.map.test.ts` (create)

**Interfaces:**
- Produces:
  - `type ElementType` now includes `'map'`.
  - `export type MapPlace = { id: string; label: string; lat: number; lng: number; address?: string; note?: string; photo?: string; date?: string; category?: string; directions?: boolean }`
  - `export type MapCategory = { key: string; label: string; color: string; emoji?: string }`
  - `CanvasElement` gains: `mapTitle?: string; mapPlaces?: MapPlace[]; mapCategories?: MapCategory[]; mapTileStyle?: 'light' | 'standard' | 'terrain'; mapHeight?: number; mapConnectLine?: boolean; mapFitView?: boolean`
  - `createElement('map')` returns the default shape below.

- [ ] **Step 1: Write the failing test**

Create `src/lib/types/canvas.map.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { createElement } from './canvas'

describe("createElement('map')", () => {
  it('returns the default map shape', () => {
    const el = createElement('map')
    expect(el.type).toBe('map')
    expect(el.mapPlaces).toEqual([])
    expect(el.mapTileStyle).toBe('light')
    expect(el.mapHeight).toBe(420)
    expect(el.mapConnectLine).toBe(false)
    expect(el.mapFitView).toBe(true)
    expect(el.mapCategories).toEqual([{ key: 'visited', label: 'Visited', color: '#39D98A' }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/types/canvas.map.test.ts`
Expected: FAIL — `createElement` has no `'map'` case (returns `base` without map fields); also a TS error that `'map'` is not assignable to `ElementType`.

- [ ] **Step 3: Add the `ElementType` member**

In `src/lib/types/canvas.ts`, in the `ElementType` union (near the Batch-1 comment `// Batch 1: Special elements`, ~line 105), add:

```ts
  // Batch 2: Map
  | 'map'                   // Interactive Leaflet map with photo-pins + directions
```

- [ ] **Step 4: Add the `MapPlace` / `MapCategory` type exports**

In `src/lib/types/canvas.ts`, directly above the `CanvasElement` interface declaration, add:

```ts
export type MapPlace = {
  id: string
  label: string
  lat: number
  lng: number
  address?: string
  note?: string
  photo?: string
  date?: string
  category?: string
  directions?: boolean
}

export type MapCategory = {
  key: string
  label: string
  color: string
  emoji?: string
}
```

- [ ] **Step 5: Add the fields to `CanvasElement`**

In the `CanvasElement` interface, alongside the other element-namespaced optional fields, add:

```ts
  // Map element
  mapTitle?: string
  mapPlaces?: MapPlace[]
  mapCategories?: MapCategory[]
  mapTileStyle?: 'light' | 'standard' | 'terrain'
  mapHeight?: number
  mapConnectLine?: boolean
  mapFitView?: boolean
```

- [ ] **Step 6: Add the `createElement` case**

In the `switch (type)` inside `createElement` (before the `default:`/final cases), add:

```ts
    case 'map':
      return {
        ...base,
        mapTitle: '',
        mapPlaces: [],
        mapCategories: [{ key: 'visited', label: 'Visited', color: '#39D98A' }],
        mapTileStyle: 'light',
        mapHeight: 420,
        mapConnectLine: false,
        mapFitView: true,
      }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/types/canvas.map.test.ts`
Expected: PASS.

- [ ] **Step 8: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/lib/types/canvas.ts src/lib/types/canvas.map.test.ts
git commit -m "feat(map): add map ElementType, MapPlace/MapCategory types, createElement default"
```

---

### Task 2: Pure helpers — `src/lib/map.ts`

Pure, Leaflet-free functions: the tested core that the components consume. No `window`, no imports of `leaflet`.

**Files:**
- Create: `src/lib/map.ts`
- Test: `src/lib/map.test.ts`

**Interfaces:**
- Consumes: `MapPlace`, `MapCategory` from `@/lib/types/canvas` (Task 1).
- Produces:
  - `TILE_STYLES: Record<'light' | 'standard' | 'terrain', { url: string; attribution: string; subdomains?: string }>`
  - `escapeHtml(s: string): string`
  - `isSafePhotoUrl(url: string | undefined): boolean` — true only for `http:`/`https:`.
  - `isFiniteCoord(n: unknown): n is number`
  - `buildDirectionsUrl(place: Pick<MapPlace,'lat'|'lng'>): string | null` — Google Maps deep-link, or `null` for non-finite coords.
  - `resolveCategory(place: MapPlace, categories: MapCategory[]): MapCategory` — matched category or a green fallback.
  - `markerVariant(place: MapPlace): 'photo' | 'plain'`
  - `markerDivHtml(place: MapPlace, category: MapCategory): string` — Leaflet `divIcon` inner HTML (escaped).
  - `popupHtml(place: MapPlace, category: MapCategory): string` — Leaflet popup card HTML (escaped, safe links).
  - `mapNominatimResult(item: unknown): { lat: number; lng: number; label: string; address: string } | null`
  - `visiblePlaces(places: MapPlace[], activeKey: string | null): MapPlace[]` — `activeKey === null` → all.

- [ ] **Step 1: Write the failing test**

Create `src/lib/map.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  escapeHtml, isSafePhotoUrl, buildDirectionsUrl, resolveCategory, markerVariant,
  markerDivHtml, popupHtml, mapNominatimResult, visiblePlaces, TILE_STYLES,
} from './map'
import type { MapPlace, MapCategory } from '@/lib/types/canvas'

const cats: MapCategory[] = [{ key: 'lived', label: 'Lived', color: '#6C63FF' }]
const place = (o: Partial<MapPlace> = {}): MapPlace => ({ id: 'p1', label: 'Lisbon', lat: 38.7, lng: -9.1, ...o })

describe('escapeHtml', () => {
  it('escapes HTML-significant characters', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe('&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;')
  })
})

describe('isSafePhotoUrl', () => {
  it('accepts http(s), rejects everything else', () => {
    expect(isSafePhotoUrl('https://x.blob/a.png')).toBe(true)
    expect(isSafePhotoUrl('javascript:alert(1)')).toBe(false)
    expect(isSafePhotoUrl(undefined)).toBe(false)
  })
})

describe('buildDirectionsUrl', () => {
  it('builds a Google Maps deep-link', () => {
    expect(buildDirectionsUrl({ lat: 38.7, lng: -9.1 }))
      .toBe('https://www.google.com/maps/dir/?api=1&destination=38.7%2C-9.1')
  })
  it('returns null for non-finite coords', () => {
    expect(buildDirectionsUrl({ lat: NaN, lng: 0 })).toBeNull()
  })
})

describe('resolveCategory', () => {
  it('matches by key', () => {
    expect(resolveCategory(place({ category: 'lived' }), cats).color).toBe('#6C63FF')
  })
  it('falls back to a green default when unmatched', () => {
    expect(resolveCategory(place({ category: 'nope' }), cats).color).toBe('#39D98A')
  })
})

describe('markerVariant', () => {
  it('is photo when a safe photo url is present, else plain', () => {
    expect(markerVariant(place({ photo: 'https://x/a.png' }))).toBe('photo')
    expect(markerVariant(place())).toBe('plain')
    expect(markerVariant(place({ photo: 'javascript:x' }))).toBe('plain')
  })
})

describe('markerDivHtml', () => {
  it('escapes the label into the aria/title and includes the category color', () => {
    const html = markerDivHtml(place({ label: '<x>' }), cats[0])
    expect(html).toContain('#6C63FF')
    expect(html).toContain('&lt;x&gt;')
    expect(html).not.toContain('<x>')
  })
})

describe('popupHtml', () => {
  it('escapes note/label and renders a safe directions link when enabled', () => {
    const html = popupHtml(place({ label: 'A&B', note: '<script>', directions: true }), cats[0])
    expect(html).toContain('A&amp;B')
    expect(html).not.toContain('<script>')
    expect(html).toContain('https://www.google.com/maps/dir/?api=1&destination=38.7%2C-9.1')
    expect(html).toContain('rel="noopener noreferrer"')
  })
  it('omits the directions link when not enabled', () => {
    expect(popupHtml(place({ directions: false }), cats[0])).not.toContain('maps/dir')
  })
})

describe('mapNominatimResult', () => {
  it('maps a valid item', () => {
    const r = mapNominatimResult({ lat: '38.7', lon: '-9.1', display_name: 'Lisbon, Portugal' })
    expect(r).toEqual({ lat: 38.7, lng: -9.1, label: 'Lisbon', address: 'Lisbon, Portugal' })
  })
  it('returns null for non-finite/malformed items', () => {
    expect(mapNominatimResult({ lat: 'x', lon: '1', display_name: 'q' })).toBeNull()
    expect(mapNominatimResult(null)).toBeNull()
  })
})

describe('visiblePlaces', () => {
  it('returns all when activeKey is null', () => {
    const ps = [place({ category: 'lived' }), place({ id: 'p2', category: 'seen' })]
    expect(visiblePlaces(ps, null)).toHaveLength(2)
    expect(visiblePlaces(ps, 'lived')).toHaveLength(1)
  })
})

describe('TILE_STYLES', () => {
  it('has all three styles with url + attribution', () => {
    for (const k of ['light', 'standard', 'terrain'] as const) {
      expect(TILE_STYLES[k].url).toMatch(/^https:\/\//)
      expect(TILE_STYLES[k].attribution).toContain('OpenStreetMap')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/map.test.ts`
Expected: FAIL — `./map` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/map.ts`:

```ts
import type { MapPlace, MapCategory } from '@/lib/types/canvas'

const DEFAULT_CATEGORY: MapCategory = { key: '', label: '', color: '#39D98A' }

export const TILE_STYLES: Record<'light' | 'standard' | 'terrain', { url: string; attribution: string; subdomains?: string }> = {
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    subdomains: 'abc',
    attribution: '&copy; OpenStreetMap contributors',
  },
  terrain: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function isFiniteCoord(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

export function isSafePhotoUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function buildDirectionsUrl(place: Pick<MapPlace, 'lat' | 'lng'>): string | null {
  if (!isFiniteCoord(place.lat) || !isFiniteCoord(place.lng)) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.lat},${place.lng}`)}`
}

export function resolveCategory(place: MapPlace, categories: MapCategory[]): MapCategory {
  return categories.find((c) => c.key === place.category) ?? DEFAULT_CATEGORY
}

export function markerVariant(place: MapPlace): 'photo' | 'plain' {
  return isSafePhotoUrl(place.photo) ? 'photo' : 'plain'
}

export function markerDivHtml(place: MapPlace, category: MapCategory): string {
  const label = escapeHtml(place.label || '')
  const color = escapeHtml(category.color || '#39D98A')
  if (markerVariant(place) === 'photo') {
    const bg = encodeURI(place.photo as string).replace(/'/g, '%27')
    return (
      `<span class="galli-pin galli-pin--photo" title="${label}" role="img" aria-label="${label}" ` +
      `style="--pin-color:${color};background-image:url('${bg}')"></span>`
    )
  }
  const glyph = category.emoji ? `<span class="galli-pin__emoji">${escapeHtml(category.emoji)}</span>` : ''
  return `<span class="galli-pin galli-pin--plain" title="${label}" role="img" aria-label="${label}" style="--pin-color:${color}">${glyph}</span>`
}

export function popupHtml(place: MapPlace, category: MapCategory): string {
  const label = escapeHtml(place.label || 'Untitled')
  const photo = markerVariant(place) === 'photo'
    ? `<div class="galli-pop__photo"><img src="${encodeURI(place.photo as string)}" alt="${label}" /></div>`
    : ''
  const date = place.date ? `<div class="galli-pop__date">${escapeHtml(place.date)}</div>` : ''
  const note = place.note ? `<p class="galli-pop__note">${escapeHtml(place.note)}</p>` : ''
  const dir = place.directions ? buildDirectionsUrl(place) : null
  const button = dir
    ? `<a class="galli-pop__dir" href="${dir}" target="_blank" rel="noopener noreferrer">Get directions</a>`
    : ''
  const dot = `<span class="galli-pop__dot" style="background:${escapeHtml(category.color || '#39D98A')}"></span>`
  return (
    `<div class="galli-pop">${photo}<div class="galli-pop__body">` +
    `<div class="galli-pop__title">${dot}${label}</div>${date}${note}${button}` +
    `</div></div>`
  )
}

export function mapNominatimResult(item: unknown): { lat: number; lng: number; label: string; address: string } | null {
  if (!item || typeof item !== 'object') return null
  const o = item as Record<string, unknown>
  const lat = Number(o.lat)
  const lng = Number(o.lon)
  if (!isFiniteCoord(lat) || !isFiniteCoord(lng)) return null
  const address = typeof o.display_name === 'string' ? o.display_name : ''
  const label = address.split(',')[0]?.trim() || 'Pinned place'
  return { lat, lng, label, address }
}

export function visiblePlaces(places: MapPlace[], activeKey: string | null): MapPlace[] {
  if (activeKey === null) return places
  return places.filter((p) => p.category === activeKey)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/map.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/map.ts src/lib/map.test.ts
git commit -m "feat(map): pure helpers (tiles, escaping, marker/popup HTML, geocode mapping, filter)"
```

---

### Task 3: Leaflet install + marker/popup CSS

Install the dependency and add the scoped stylesheet that turns stock Leaflet into the premium Galli look. No behavioral test — verified by the components in Tasks 4–5. This task is prerequisite infra with a self-contained deliverable (deps + CSS).

**Files:**
- Modify: `package.json` (add `leaflet`, dev `@types/leaflet`)
- Create: `src/components/elements/map-element.css`

- [ ] **Step 1: Install Leaflet**

Run:
```bash
pnpm add leaflet && pnpm add -D @types/leaflet
```
Expected: `package.json` gains `leaflet` (^1.9.x) in deps and `@types/leaflet` in devDeps; lockfile updated.

- [ ] **Step 2: Create the scoped stylesheet**

Create `src/components/elements/map-element.css`:

```css
/* Galli map element — overrides Leaflet's stock chrome. Scoped under .galli-map. */
.galli-map { position: relative; z-index: 0; isolation: isolate; } /* contain Leaflet's high z-indexes */
.galli-map .leaflet-container {
  height: 100%; width: 100%;
  border-radius: 20px;
  font-family: inherit;
  background: #eef2f0;
}

/* Zoom control */
.galli-map .leaflet-control-zoom { border: none; box-shadow: 0 6px 20px -6px rgba(15,61,46,.28); border-radius: 12px; overflow: hidden; }
.galli-map .leaflet-control-zoom a {
  background: rgba(255,255,255,.92); color: #0F3D2E; width: 34px; height: 34px; line-height: 34px;
  border: none; font-size: 18px; transition: background .18s ease;
}
.galli-map .leaflet-control-zoom a:hover { background: #fff; }
.galli-map .leaflet-control-attribution { font-size: 10px; background: rgba(255,255,255,.75); border-radius: 8px; color: #64748b; }

/* Markers */
.galli-pin { display: block; }
.galli-pin--plain {
  width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);
  background: var(--pin-color, #39D98A); border: 2px solid #fff;
  box-shadow: 0 6px 20px -6px rgba(15,61,46,.28);
  display: flex; align-items: center; justify-content: center;
}
.galli-pin__emoji { transform: rotate(45deg); font-size: 15px; line-height: 1; }
.galli-pin--photo {
  width: 44px; height: 44px; border-radius: 50%;
  background-size: cover; background-position: center;
  border: 2px solid var(--pin-color, #39D98A); box-shadow: 0 0 0 2px #fff, 0 6px 20px -6px rgba(15,61,46,.28);
}
.leaflet-marker-icon .galli-pin { transition: transform .18s ease; }
.leaflet-marker-icon:hover .galli-pin,
.leaflet-marker-icon:focus .galli-pin { transform: scale(1.08); }
.leaflet-marker-icon:hover .galli-pin--plain,
.leaflet-marker-icon:focus .galli-pin--plain { transform: rotate(-45deg) scale(1.08); }

/* Popup card */
.galli-map .leaflet-popup-content-wrapper {
  border-radius: 16px; padding: 0; overflow: hidden;
  box-shadow: 0 6px 20px -6px rgba(15,61,46,.28); border: 1px solid rgba(15,61,46,.06);
}
.galli-map .leaflet-popup-content { margin: 0; width: 220px !important; }
.galli-map .leaflet-popup-tip { background: #fff; }
.galli-pop__photo img { display: block; width: 100%; aspect-ratio: 16/10; object-fit: cover; }
.galli-pop__body { padding: 12px 14px; }
.galli-pop__title { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 15px; color: #0F3D2E; }
.galli-pop__dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
.galli-pop__date { font-size: 12px; color: #64748b; margin-top: 2px; }
.galli-pop__note { font-size: 13px; color: #475569; line-height: 1.5; margin: 6px 0 0; }
.galli-pop__dir {
  display: block; text-align: center; margin-top: 10px; height: 40px; line-height: 40px;
  background: #39D98A; color: #fff; font-weight: 500; font-size: 13px; border-radius: 9999px;
  text-decoration: none; transition: background .18s ease;
}
.galli-pop__dir:hover { background: #33c47c; }

/* Journey line marching-ants (motion only) */
@keyframes galli-dash { to { stroke-dashoffset: -16; } }
@media (prefers-reduced-motion: no-preference) {
  .galli-journey { stroke-dasharray: 6 8; animation: galli-dash 1s linear infinite; }
}
```

- [ ] **Step 3: Typecheck (ensure types resolve)**

Run: `pnpm exec tsc --noEmit`
Expected: no errors (nothing imports leaflet yet; this just confirms the install didn't break types).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/elements/map-element.css
git commit -m "chore(map): add leaflet dependency + scoped premium map stylesheet"
```

---

### Task 4: `PublicMapElement` — published render (shell + Leaflet canvas)

The published surface. Split into a **testable shell** (title + legend chips + filter state) that renders a client-only **`MapView`** child which builds the Leaflet map imperatively in `useEffect` (so it never runs during SSR).

**Files:**
- Create: `src/components/elements/PublicMapElement.tsx`
- Test: `src/components/elements/PublicMapElement.test.tsx`

**Interfaces:**
- Consumes: `MapPlace`, `MapCategory`, `CanvasElement` (Task 1); all helpers from `@/lib/map` (Task 2); `./map-element.css` (Task 3).
- Produces: `export function PublicMapElement({ element }: { element: CanvasElement })` — used by `render-elements.tsx` and `ColumnCanvas` (Task 5).

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/PublicMapElement.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PublicMapElement } from './PublicMapElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (over: Partial<CanvasElement>): CanvasElement => ({ id: '1', type: 'map', ...over })

describe('PublicMapElement', () => {
  it('renders nothing when there are no places', () => {
    const { container } = render(<PublicMapElement element={el({ mapPlaces: [] })} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the title and category legend without throwing (Leaflet not loaded in jsdom)', () => {
    render(<PublicMapElement element={el({
      mapTitle: 'My travels',
      mapPlaces: [
        { id: 'a', label: 'Lisbon', lat: 38.7, lng: -9.1, category: 'lived' },
        { id: 'b', label: 'Tokyo', lat: 35.6, lng: 139.7, category: 'seen' },
      ],
      mapCategories: [
        { key: 'lived', label: 'Lived', color: '#6C63FF' },
        { key: 'seen', label: 'Seen', color: '#1FB6FF' },
      ],
    })} />)
    expect(screen.getByText('My travels')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lived' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Seen' })).toBeInTheDocument()
  })

  it('hides the legend when fewer than two categories are in use', () => {
    render(<PublicMapElement element={el({
      mapPlaces: [{ id: 'a', label: 'Lisbon', lat: 38.7, lng: -9.1, category: 'lived' }],
      mapCategories: [{ key: 'lived', label: 'Lived', color: '#6C63FF' }],
    })} />)
    expect(screen.queryByRole('button', { name: 'All' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/elements/PublicMapElement.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/components/elements/PublicMapElement.tsx`:

```tsx
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './map-element.css'
import type { CanvasElement, MapPlace, MapCategory } from '@/lib/types/canvas'
import {
  TILE_STYLES, markerDivHtml, popupHtml, resolveCategory, visiblePlaces, isFiniteCoord,
} from '@/lib/map'

function validPlaces(places: MapPlace[]): MapPlace[] {
  return places.filter((p) => isFiniteCoord(p.lat) && isFiniteCoord(p.lng))
}

function MapView({ element, active }: { element: CanvasElement; active: string | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const height = element.mapHeight ?? 420
  const places = useMemo(
    () => visiblePlaces(validPlaces(element.mapPlaces ?? []), active),
    [element.mapPlaces, active],
  )
  const categories = element.mapCategories ?? []
  const tile = TILE_STYLES[element.mapTileStyle ?? 'light']

  useEffect(() => {
    let map: import('leaflet').Map | null = null
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !ref.current) return
      try {
        map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: true })
        L.tileLayer(tile.url, { attribution: tile.attribution, subdomains: tile.subdomains ?? 'abc', maxZoom: 19 }).addTo(map)

        const latlngs: [number, number][] = []
        for (const p of places) {
          const cat = resolveCategory(p, categories)
          const icon = L.divIcon({
            html: markerDivHtml(p, cat),
            className: 'galli-pin-wrap',
            iconSize: [44, 44],
            iconAnchor: [22, 22],
            popupAnchor: [0, -20],
          })
          L.marker([p.lat, p.lng], { icon, keyboard: true, title: p.label })
            .bindPopup(popupHtml(p, cat), { closeButton: true })
            .addTo(map)
          latlngs.push([p.lat, p.lng])
        }

        if (element.mapConnectLine && latlngs.length > 1) {
          L.polyline(latlngs, { color: '#0F3D2E', weight: 3, opacity: 0.65, lineJoin: 'round', className: 'galli-journey' }).addTo(map)
        }

        if (latlngs.length === 1) {
          map.setView(latlngs[0], 12)
        } else if (latlngs.length > 1 && (element.mapFitView ?? true)) {
          map.fitBounds(latlngs, { padding: [40, 40] })
        } else if (latlngs.length > 1) {
          map.fitBounds(latlngs, { padding: [40, 40] })
        } else {
          map.setView([20, 0], 2)
        }
      } catch {
        /* jsdom/no-layout — leave the skeleton div in place */
      }
    })()
    return () => { cancelled = true; map?.remove() }
  }, [places, categories, tile, element.mapConnectLine, element.mapFitView])

  return <div ref={ref} className="galli-map w-full rounded-[20px] ring-1 ring-black/5 shadow-soft bg-[#eef2f0]" style={{ height }} />
}

export function PublicMapElement({ element }: { element: CanvasElement }) {
  const places = validPlaces(element.mapPlaces ?? [])
  const categories = element.mapCategories ?? []
  const [active, setActive] = useState<string | null>(null)

  if (places.length === 0) return null

  const usedKeys = new Set(places.map((p) => p.category).filter(Boolean) as string[])
  const legend = categories.filter((c) => usedKeys.has(c.key))
  const showLegend = legend.length >= 2

  const chip = (key: string | null, label: string, color?: string) => {
    const on = active === key
    return (
      <button
        key={key ?? 'all'}
        onClick={() => setActive(key)}
        className={`h-9 shrink-0 rounded-full px-3 text-sm cursor-pointer transition-colors border ${
          on ? 'border-transparent' : 'border-gray-200 bg-surface text-slate-600 hover:bg-gray-50'
        }`}
        style={on ? { background: `${color ?? '#39D98A'}1f`, color: color ?? '#0F3D2E', borderColor: color ?? '#39D98A' } : undefined}
      >
        {color && <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />}
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      {element.mapTitle && <h3 className="text-lg font-semibold text-galli-anchor">{element.mapTitle}</h3>}
      {showLegend && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {chip(null, 'All', '#39D98A')}
          {legend.map((c) => chip(c.key, c.label, c.color))}
        </div>
      )}
      <MapView element={element} active={active} />
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/elements/PublicMapElement.test.tsx`
Expected: PASS. (The `MapView` `useEffect` imports leaflet and may throw on `L.map` in jsdom; the `try/catch` swallows it and the shell assertions still pass.)

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/PublicMapElement.tsx src/components/elements/PublicMapElement.test.tsx
git commit -m "feat(map): PublicMapElement — Leaflet render, custom markers/popups, category legend"
```

---

### Task 5: `MapElement` editor

The editor: title, tile style, height, journey toggle, category manager, and a places list built via address search (Nominatim), click-to-drop, and drag. Follows the editor prop convention and the Gallery upload pattern.

**Files:**
- Create: `src/components/elements/MapElement.tsx`
- Test: `src/components/elements/MapElement.test.tsx`

**Interfaces:**
- Consumes: `MapPlace`, `MapCategory`, `CanvasElement` (Task 1); helpers from `@/lib/map` (Task 2); `./map-element.css` + `leaflet/dist/leaflet.css` (Task 3); `POST /api/upload` (existing).
- Produces: `export function MapElement({ element, onChange, onDelete, isSelected, onSelect }: Props)` — props identical to `GalleryElement`.

- [ ] **Step 1: Write the failing test**

Create `src/components/elements/MapElement.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MapElement } from './MapElement'
import type { CanvasElement } from '@/lib/types/canvas'

const base: CanvasElement = { id: '1', type: 'map', mapPlaces: [], mapCategories: [{ key: 'visited', label: 'Visited', color: '#39D98A' }] }

describe('MapElement editor', () => {
  it('renders the title input and reports title changes', () => {
    const onChange = vi.fn()
    render(<MapElement element={base} onChange={onChange} onDelete={() => {}} isSelected onSelect={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('Map title'), { target: { value: 'My travels' } })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ mapTitle: 'My travels' }))
  })

  it('adds a category', () => {
    const onChange = vi.fn()
    render(<MapElement element={base} onChange={onChange} onDelete={() => {}} isSelected onSelect={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /add category/i }))
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      mapCategories: expect.arrayContaining([expect.objectContaining({ key: 'visited' })]),
    }))
    const lastCall = onChange.mock.calls.at(-1)![0]
    expect(lastCall.mapCategories.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/components/elements/MapElement.test.tsx`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/components/elements/MapElement.tsx`:

```tsx
'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import './map-element.css'
import { Trash2, MapPin, Search, Loader2, Upload, GripVertical, Navigation } from 'lucide-react'
import type { CanvasElement, MapPlace, MapCategory } from '@/lib/types/canvas'
import { TILE_STYLES, markerDivHtml, resolveCategory, mapNominatimResult, isFiniteCoord } from '@/lib/map'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

const uid = () => `mp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export function MapElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const places = element.mapPlaces ?? []
  const categories = element.mapCategories ?? []
  const tile = TILE_STYLES[element.mapTileStyle ?? 'light']

  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<import('leaflet').Map | null>(null)
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null)
  const placesRef = useRef(places)
  placesRef.current = places

  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const updatePlace = (id: string, patch: Partial<MapPlace>) =>
    onChange({ mapPlaces: places.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  const removePlace = (id: string) => onChange({ mapPlaces: places.filter((p) => p.id !== id) })
  const addPlace = (p: MapPlace) => onChange({ mapPlaces: [...placesRef.current, p] })

  // Build the editor map once.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapRef.current || mapObj.current) return
      const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([20, 0], 2)
      L.tileLayer(tile.url, { attribution: tile.attribution, subdomains: tile.subdomains ?? 'abc', maxZoom: 19 }).addTo(map)
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        addPlace({ id: uid(), label: 'New place', lat: e.latlng.lat, lng: e.latlng.lng, category: categories[0]?.key })
      })
      layerRef.current = L.layerGroup().addTo(map)
      mapObj.current = map
    })()
    return () => { cancelled = true; mapObj.current?.remove(); mapObj.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render markers when places/categories change.
  useEffect(() => {
    ;(async () => {
      const L = (await import('leaflet')).default
      const layer = layerRef.current
      if (!layer) return
      layer.clearLayers()
      for (const p of places) {
        if (!isFiniteCoord(p.lat) || !isFiniteCoord(p.lng)) continue
        const cat = resolveCategory(p, categories)
        const icon = L.divIcon({ html: markerDivHtml(p, cat), className: 'galli-pin-wrap', iconSize: [44, 44], iconAnchor: [22, 22] })
        const marker = L.marker([p.lat, p.lng], { icon, draggable: true })
        marker.on('dragend', () => { const ll = marker.getLatLng(); updatePlace(p.id, { lat: ll.lat, lng: ll.lng }) })
        layer.addLayer(marker)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, categories])

  const search = async () => {
    if (!query.trim()) return
    setSearching(true); setSearchError(null)
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`, {
        headers: { 'Accept-Language': 'en' },
      })
      const json = await res.json()
      const mapped = Array.isArray(json) ? mapNominatimResult(json[0]) : null
      if (!mapped) { setSearchError("Couldn't find that address — try dropping a pin on the map."); return }
      addPlace({ id: uid(), label: mapped.label, lat: mapped.lat, lng: mapped.lng, address: mapped.address, category: categories[0]?.key })
      mapObj.current?.setView([mapped.lat, mapped.lng], 11)
      setQuery('')
    } catch {
      setSearchError("Search failed — try dropping a pin on the map.")
    } finally {
      setSearching(false)
    }
  }

  const uploadPhoto = async (id: string, file: File) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) return
    setUploadingId(id)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) { const data = await res.json(); updatePlace(id, { photo: data.url }) }
    } finally { setUploadingId(null) }
  }

  const addCategory = () =>
    onChange({ mapCategories: [...categories, { key: uid(), label: 'New category', color: '#1FB6FF' }] })
  const updateCategory = (key: string, patch: Partial<MapCategory>) =>
    onChange({ mapCategories: categories.map((c) => (c.key === key ? { ...c, ...patch } : c)) })
  const removeCategory = (key: string) =>
    onChange({ mapCategories: categories.filter((c) => c.key !== key) })

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-galli border-galli/30' : 'border-border hover:border-galli/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <div className="p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-galli" />
          <input
            type="text" value={element.mapTitle ?? ''} placeholder="Map title"
            onChange={(e) => onChange({ mapTitle: e.target.value })}
            className="text-sm font-semibold bg-transparent border-none outline-none flex-1"
          />
          <select
            value={element.mapTileStyle ?? 'light'}
            onChange={(e) => onChange({ mapTileStyle: e.target.value as 'light' | 'standard' | 'terrain' })}
            className="text-xs bg-muted border border-border rounded px-2 py-1 outline-none"
          >
            <option value="light">Light</option>
            <option value="standard">Standard</option>
            <option value="terrain">Terrain</option>
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={element.mapConnectLine ?? false} onChange={(e) => onChange({ mapConnectLine: e.target.checked })} />
          Connect pins with a journey line
        </label>

        {/* Add place: search */}
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 border border-border rounded-lg px-2">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text" value={query} placeholder="Search an address or place"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }}
              className="flex-1 text-xs bg-transparent py-1.5 outline-none"
            />
          </div>
          <button onClick={search} disabled={searching} className="px-3 rounded-lg bg-galli text-white text-xs font-medium disabled:opacity-60">
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
          </button>
        </div>
        {searchError && <p className="text-xs text-destructive">{searchError}</p>}
        <p className="text-[11px] text-muted-foreground">Or click the map to drop a pin, and drag any pin to adjust.</p>

        {/* Editor map */}
        <div ref={mapRef} className="galli-map w-full rounded-[16px] ring-1 ring-black/5 bg-[#eef2f0]" style={{ height: 260 }} />

        {/* Places list */}
        <div className="space-y-2">
          {places.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-white p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground/50" />
                <input
                  type="text" value={p.label} placeholder="Label"
                  onChange={(e) => updatePlace(p.id, { label: e.target.value })}
                  className="flex-1 text-sm font-medium bg-transparent outline-none"
                />
                <button aria-label="Remove place" onClick={() => removePlace(p.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {p.address && <p className="text-[11px] text-muted-foreground truncate pl-6">{p.address}</p>}
              <div className="grid grid-cols-2 gap-2 pl-6">
                <input type="text" value={p.note ?? ''} placeholder="Note" onChange={(e) => updatePlace(p.id, { note: e.target.value })} className="text-xs border border-border rounded px-2 py-1 outline-none" />
                <input type="text" value={p.date ?? ''} placeholder="Date (e.g. 2024)" onChange={(e) => updatePlace(p.id, { date: e.target.value })} className="text-xs border border-border rounded px-2 py-1 outline-none" />
                <select value={p.category ?? ''} onChange={(e) => updatePlace(p.id, { category: e.target.value || undefined })} className="text-xs border border-border rounded px-2 py-1 outline-none">
                  <option value="">No category</option>
                  {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
                <label className="text-xs border border-border rounded px-2 py-1 flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-galli">
                  {uploadingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {p.photo ? 'Change photo' : 'Photo'}
                  <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(p.id, f); e.target.value = '' }} />
                </label>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-6">
                <input type="checkbox" checked={p.directions ?? false} onChange={(e) => updatePlace(p.id, { directions: e.target.checked })} />
                <Navigation className="w-3 h-3" /> Show &ldquo;Get directions&rdquo; button
              </label>
            </div>
          ))}
        </div>

        {/* Category manager */}
        <div className="border-t border-border pt-2 space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground">Categories</p>
          {categories.map((c) => (
            <div key={c.key} className="flex items-center gap-2">
              <input aria-label="Category color" type="color" value={c.color} onChange={(e) => updateCategory(c.key, { color: e.target.value })} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent" />
              <input type="text" value={c.label} onChange={(e) => updateCategory(c.key, { label: e.target.value })} className="flex-1 text-xs border border-border rounded px-2 py-1 outline-none" />
              <input type="text" value={c.emoji ?? ''} placeholder="😀" maxLength={2} onChange={(e) => updateCategory(c.key, { emoji: e.target.value || undefined })} className="w-10 text-xs border border-border rounded px-2 py-1 outline-none text-center" />
              <button aria-label="Remove category" onClick={() => removeCategory(c.key)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
          <button onClick={addCategory} className="text-xs text-galli font-medium">+ Add category</button>
        </div>
      </div>

      {isSelected && (
        <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-3 -right-3 p-1.5 bg-background border border-border rounded-md shadow-sm hover:bg-destructive hover:text-destructive-foreground transition">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/components/elements/MapElement.test.tsx`
Expected: PASS. (The Leaflet `useEffect`s import leaflet and may no-op/throw in jsdom; assertions target the plain inputs/buttons, which render regardless.)

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/elements/MapElement.tsx src/components/elements/MapElement.test.tsx
git commit -m "feat(map): MapElement editor — search/drop/drag pins, per-place fields, category manager"
```

---

### Task 6: Wire into the element system + CSP

Register both components and relax CSP for tiles + geocoding. After this task the element is insertable from the slash menu and renders on published pages.

**Files:**
- Modify: `src/components/elements/index.ts` (add two exports after the Gallery exports ~line 76)
- Modify: `src/components/canvas/ColumnCanvas.tsx` (add to the barrel import ~line 80; add `case 'map'` in `renderElement` ~after line 1122)
- Modify: `src/lib/render-elements.tsx` (add import ~line 37; add `case 'map'` ~line 492)
- Modify: `src/components/canvas/SlashCommandMenu.tsx` (add a `commands[]` entry after the Batch-1 entries ~line 142; ensure `MapPin` is imported from `lucide-react`)
- Modify: `next.config.js` (extend `img-src` and `connect-src`)

**Interfaces:**
- Consumes: `MapElement`, `PublicMapElement` (Tasks 4–5).

- [ ] **Step 1: Export from the elements barrel**

In `src/components/elements/index.ts`, after the `PublicGalleryElement` export (~line 76), add:

```ts
export { MapElement } from './MapElement'
export { PublicMapElement } from './PublicMapElement'
```

- [ ] **Step 2: Import + case in `ColumnCanvas.tsx`**

Add to the barrel import list (after `PublicGalleryElement,` ~line 80):

```ts
  MapElement,
  PublicMapElement,
```

In the `renderElement` switch, after the `case 'gallery':` block (~line 1122), add:

```tsx
      case 'map':
        if (isPreviewMode) {
          return <PublicMapElement element={element} />
        }
        return (
          <MapElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 3: Import + case in `render-elements.tsx`**

Add the import (near the other `Public*` imports ~line 37):

```ts
import { PublicMapElement } from '@/components/elements/PublicMapElement'
```

In the switch, after `case 'gallery':` (~line 492), add:

```tsx
    case 'map':
      return <PublicMapElement element={element} />
```

- [ ] **Step 4: Slash-menu entry**

In `src/components/canvas/SlashCommandMenu.tsx`, confirm `MapPin` is in the `lucide-react` import (add it if missing). After the Batch-1 command entries (~line 142), add:

```tsx
  { id: 'map', label: 'Map', icon: MapPin, description: 'Pin places on an interactive map', category: 'Media' },
```

- [ ] **Step 5: Relax CSP in `next.config.js`**

Change the `img-src` line to append the tile hosts:

```js
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com https://images.unsplash.com https://ui-avatars.com https://lh3.googleusercontent.com https://www.gstatic.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com",
```

Change the `connect-src` line to append Nominatim:

```js
  "connect-src 'self' https://accounts.google.com https://apis.google.com https://oauth2.googleapis.com https://nominatim.openstreetmap.org",
```

- [ ] **Step 6: Full typecheck + test suite**

Run: `pnpm exec tsc --noEmit && pnpm test`
Expected: typecheck clean; full vitest suite green (including the three new map test files).

- [ ] **Step 7: Commit**

```bash
git add src/components/elements/index.ts src/components/canvas/ColumnCanvas.tsx src/lib/render-elements.tsx src/components/canvas/SlashCommandMenu.tsx next.config.js
git commit -m "feat(map): wire map element into slash menu, canvas, public render + CSP for tiles/geocoding"
```

---

### Task 7: Manual verification in the running app

No code — drive the real editor + published page to confirm the full flow (the parts jsdom can't exercise: actual Leaflet render, tiles loading under CSP, geocoding, directions link).

- [ ] **Step 1: Build sanity (worktree/quiet — avoid the Windows `.next` race)**

Stop any running `pnpm dev` first, then:
Run: `pnpm build`
Expected: build succeeds; no CSP or type errors.

- [ ] **Step 2: Start dev and add the element**

Run: `pnpm dev` (open the editor for a test display). In the editor, open the slash menu → **Media** → **Map**. Expect the editor map to render with tiles.

- [ ] **Step 3: Exercise the editor**

- Type an address → **Add** → a pin drops and the map recenters; the place appears in the list with its address.
- Click the map → a "New place" pin drops; drag it → its coords update.
- Add a note, date, a category, upload a photo, toggle **Show "Get directions"**.
- Add a second category and assign pins to different categories.

Expected: no console CSP violations (`Refused to…`); tiles and the uploaded photo both load.

- [ ] **Step 4: Verify the published page**

Publish/preview the display and open the public page. Expect: custom markers (photo circle / colored teardrop), tapping a pin opens the Galli popup card, the **Get directions** button opens Google Maps in a new tab with the pin as destination, the category legend filters pins, and (if enabled) the journey line connects them.

- [ ] **Step 5: Mobile + reduced-motion pass**

At 375px width: legend chips scroll horizontally, markers/popup are tappable (≥44px), no horizontal page scroll. With OS "reduce motion" on: the journey line is static (no marching ants), markers don't scale.

- [ ] **Step 6: Commit any fixes**

If Steps 1–5 surface issues, fix and commit with a descriptive message. If everything passes, no commit needed for this task.

---

## Self-Review

**Spec coverage:**
- One element, both modes (pins + directions), no hard switch → Tasks 1/4/5 (places list + per-place `directions`). ✓
- Leaflet + OSM/Carto, no key → Tasks 3/4 (`TILE_STYLES`, bundled `leaflet`). ✓
- Nominatim editor-only, explicit action, one request → Task 5 `search()`. ✓
- Deep-link directions, visitor origin → Task 2 `buildDirectionsUrl`, rendered in `popupHtml`. ✓
- Data model / `createElement` default (passport removed) → Task 1. ✓
- Premium visual design (markers, popup card, chips, journey line, editor cards, isolation z-index) → Task 3 CSS + Tasks 4/5. ✓
- Category filter legend (≥2 categories) → Task 4. ✓
- Journey polyline + reduced-motion → Task 4 (polyline) + Task 3 CSS. ✓
- CSP additions → Task 6. ✓
- Security (escaping, https-only links, finite coords, MIME via `/api/upload`) → Task 2 helpers + Tasks 4/5. ✓
- Wiring checklist (index, ColumnCanvas, render-elements, slash menu) → Task 6; no PageEditor edit (existing `default:` fallback). ✓
- Testing (pure helpers + mount guard + createElement defaults) → Tasks 1/2/4/5. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. ✓

**Type consistency:** `MapPlace`/`MapCategory` field names, `mapTileStyle` union, and helper signatures (`buildDirectionsUrl`, `markerDivHtml`, `popupHtml`, `resolveCategory`, `visiblePlaces`, `mapNominatimResult`) are identical across Tasks 1, 2, 4, 5. `layerRef.current.clearLayers()` used consistently. ✓
