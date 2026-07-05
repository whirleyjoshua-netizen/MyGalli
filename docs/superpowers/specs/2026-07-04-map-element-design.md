# Map element — design

Date: 2026-07-04
Status: draft (awaiting user review)
Part of: release-roadmap-2026-07 phase 1 (new-elements trench); listed as a Batch 2
element in `2026-07-04-special-elements-batch-1-design.md`.

## Goal

Add a `map` element that lets a creator drop pins on an interactive map and present
them as a **living map of themselves** — places they've traveled, favorite spots, a
tour route, or a single "find me here" destination with directions. One element that
reads as a travel/story map when filled with many photo-pins, and as a find-me/
wayfinding map when filled with one directions-enabled pin. No hard mode switch —
emphasis follows how the creator fills it in.

Built **free/functional**; free-vs-Pro labeling is a separate later phase (same policy
as Batch 1) — no gating here.

## Provider decision (settled)

- **Leaflet + OpenStreetMap tiles.** Open-source JS library bundled from npm (NOT an
  external `<script>`), free OSM/Carto raster tiles, **no API key, no billing, no
  signup.**
- **Geocoding: Nominatim** (OSM's free geocoder) — used **in the editor only**, on an
  explicit user action (typing an address and hitting search). Results are stored as
  `lat`/`lng` on the place, so the **published page never geocodes**. We respect
  Nominatim usage policy (single lookups on user action, proper attribution, no bulk).
- **Directions: deep-link out** to Google Maps (`https://www.google.com/maps/dir/?api=1&
  destination=<lat>,<lng>`). Google uses the **visitor's own current location** as the
  origin automatically — so "directions from wherever you are" is free and cross-
  platform, with no routing engine and nothing stored.

Rejected: Mapbox (needs token + usage billing + heavier CSP) and Google Maps JS API
(needs billing account + key + heaviest CSP) — overkill since deep-linking covers
directions.

## Data model (pure `Display.sections` JSON — no Prisma model, no new API route)

Add to `src/lib/types/canvas.ts`:

`ElementType` gains `| 'map'`.

`CanvasElement` gains (all optional, element-namespaced per convention):

```ts
mapTitle?: string
mapPlaces?: MapPlace[]
mapCategories?: MapCategory[]
mapTileStyle?: 'light' | 'standard' | 'terrain'
mapHeight?: number          // px, default 420
mapConnectLine?: boolean    // draw a "journey" line through places in array order
mapFitView?: boolean        // auto-frame all places (default true)
```

New exported types in `canvas.ts`:

```ts
export type MapPlace = {
  id: string
  label: string
  lat: number
  lng: number
  address?: string        // human-readable, from geocode or manual
  note?: string           // short description shown in popup
  photo?: string          // Blob url (reuses /api/upload)
  date?: string           // free-text or YYYY-MM, shown in popup
  category?: string       // MapCategory.key
  directions?: boolean    // show a "Get directions" button in the popup
}

export type MapCategory = {
  key: string
  label: string
  color: string           // hex, drives marker color + legend chip
  emoji?: string          // optional decorative glyph on the marker
}
```

`createElement('map')` default:

```ts
{
  mapTitle: '',
  mapPlaces: [],
  mapCategories: [
    { key: 'visited', label: 'Visited', color: '#39D98A' },
  ],
  mapTileStyle: 'light',   // Carto Positron — clean, lets green pins pop
  mapHeight: 420,
  mapConnectLine: false,
  mapFitView: true,
}
```

This is the single source of defaults; `PageEditor.handleCommandSelect` falls through
to `createElement` via the Batch-1 `default:` branch (no per-element case needed there —
confirm that branch exists at implementation time; if Batch 1 hasn't landed it, add it).

## Tile styles (all free, no key)

| `mapTileStyle` | Source | Note |
|----------------|--------|------|
| `light` (default) | Carto Positron (`*.basemaps.cartocdn.com`) | clean light basemap; premium, pins pop |
| `standard` | `*.tile.openstreetmap.org` | classic colorful OSM |
| `terrain`  | Carto Voyager (`*.basemaps.cartocdn.com`) | softer, labeled |

All raster `{z}/{x}/{y}.png` (or `@2x` for retina) tiles with required attribution
rendered small/muted in the map corner.

---

## Visual design — premium treatment

Grounded in the Galli brand (primary `#39D98A`, anchor `#0F3D2E`, aqua `#1FB6FF`,
violet `#6C63FF`, Plus Jakarta Sans, light theme, `shadow-soft`, soft-rounded cards) and
the UI/UX skill's principles: SVG icons (Lucide) not emoji as the primary glyph,
150–300ms transitions, `prefers-reduced-motion` honored, visible focus rings, ≥44px
touch targets with ≥8px spacing, and a disciplined z-index scale. Leaflet's stock look
is explicitly overridden — nothing ships with default Leaflet chrome.

### Design tokens (element-local)

```
--map-radius: 20px          /* container + popup corner (rounded-[20px]) */
--map-pin-size: 34px        /* plain teardrop pin */
--map-photo-pin: 44px       /* circular photo marker (also the 44px touch target) */
--map-shadow: 0 6px 20px -6px rgba(15,61,46,.28)   /* anchor-tinted soft shadow */
--map-ring: 0 0 0 1px rgba(15,61,46,.06)           /* hairline card ring */
--map-line: #0F3D2E         /* journey polyline (anchor), 0.65 opacity, weight 3 */
```

### Map container

- `relative overflow-hidden rounded-[20px] ring-1 ring-black/5 shadow-soft`, and
  crucially **`isolate` (`isolation: isolate`) + `z-0`** so Leaflet's high internal
  z-indexes (panes/controls up to ~800) stay contained and never overlap Galli's fixed
  nav or the editor side-panel. This is the key layering gotcha.
- Restyled zoom control: custom `+ / −` buttons, `bg-white/90 backdrop-blur`, rounded,
  `shadow-soft`, hover `bg-white`, focus ring; positioned with breathing room
  (`top-3 right-3`), not flush to the edge. Attribution restyled to `text-[10px]`
  muted, translucent pill, bottom-right.
- Title (`mapTitle`) renders above the map in Plus Jakarta Sans `font-semibold`, matching
  other elements' titles; omitted when empty.

### Markers (two renders, both custom `L.divIcon`)

1. **Photo marker** (place has `photo`): a `44px` circular thumbnail with a **2px ring in
   the category color**, white inner border, `--map-shadow`, and a small colored pointer
   nub beneath. This is the gallery-flavored hero marker — each pin literally shows the
   memory.
2. **Plain marker** (no photo): a **34px teardrop** filled with the category color, white
   stroke, soft shadow; centered glyph is a **Lucide `MapPin`** by default, or the
   category's optional `emoji` as a decorative accent if set (SVG-first, emoji optional).
- **Hover / selected:** `transform: scale(1.08)` + elevated shadow + ring emphasis,
  `transition: transform 180ms ease, box-shadow 180ms ease` (transform/opacity only, for
  performance); reduced to no-transform under `prefers-reduced-motion`. Tap is the
  primary interaction (opens popup) — hover is enhancement only.

### Popup card (override `.leaflet-popup-content-wrapper`)

A Galli card, not a Leaflet bubble:
- `bg-white rounded-[16px] shadow-[var(--map-shadow)] ring-1 ring-black/5`, no default
  Leaflet border/tip styling (tip recolored white to match, or hidden).
- If `photo`: full-bleed image at the top, `rounded-t-[16px]`, `aspect-[16/10]`,
  `object-cover`, with descriptive `alt` (the place label).
- Body `p-3.5 space-y-1`: **label** (`text-[15px] font-semibold text-galli-anchor`),
  **date** (`text-xs text-slate-500`, with a small Lucide `Calendar` icon) when set,
  **note** (`text-sm text-slate-600 leading-relaxed`, clamped to ~3 lines).
- **Get directions** button (when `place.directions`): full-width, `rounded-full`,
  `bg-galli text-white text-sm font-medium h-10`, Lucide `Navigation` icon,
  `hover:bg-galli/90 transition-colors`, opens the Google Maps deep-link
  (`target="_blank" rel="noopener noreferrer"`). ≥44px effective height.
- Close affordance restyled to a subtle top-right `×` with a focus ring.

### Category filter legend (chips)

- A horizontally-scrollable pill row above or below the map (scrolls on mobile, no wrap
  overflow), `gap-2`, each chip ≥`h-9`/44px tap target:
  - **Chip:** color dot (category color) + label, `rounded-full px-3 text-sm`,
    `cursor-pointer transition-colors`.
  - **Active:** background = category color at ~12% alpha, text = category color (or
    anchor for contrast), `ring-1` in the category color.
  - **Inactive:** `bg-surface border border-gray-200 text-slate-600 hover:bg-gray-50`.
  - Leading **"All"** chip (brand green when active) resets the filter.
- Filtering hides/shows markers client-side (and their polyline segments). Only rendered
  when there are ≥2 categories in use.

### Journey polyline

- Single `L.polyline` in `--map-line` (anchor green), `weight: 3`, `opacity: .65`,
  `lineJoin: 'round'`, rounded cap; drawn through places in array order.
- Optional **animated "marching ants"** dash on desktop only via a CSS
  `stroke-dashoffset` animation on the SVG path; **static dash under
  `prefers-reduced-motion`** and on touch (avoids the "infinite decorative animation"
  anti-pattern — it's subtle and only when motion is allowed).

### Editor place-list UI

- **Add a place** as a compact segmented control: **Search address** (Nominatim, with a
  results dropdown — each result a tappable row) · **Drop a pin** (click map) — plus
  drag-to-adjust any existing marker. Search input has a Lucide `Search` icon, loading
  spinner while querying, and a friendly empty/"couldn't find that" state.
- **Place rows** are soft cards (`rounded-xl border border-gray-200 bg-white p-3`,
  `hover:shadow-soft`): drag handle (Lucide `GripVertical`), small photo thumbnail (or a
  category-colored placeholder tile), label + truncated address, a category color dot;
  row expands to reveal fields (label, note, date, photo upload, category select,
  "show Get Directions" toggle). Remove = Lucide `Trash2`, needs no confirm (undo via
  re-add). `gap-2` between rows.
- **Category manager:** rows of `{ color swatch (native color input styled as a dot),
  label input, optional emoji, remove }`, plus "Add category".
- The editor renders the same interactive Leaflet map so pins update live as fields
  change.

### Accessibility & motion

- All icon-only controls (zoom, close, remove, drag) get `aria-label`s; markers are
  focusable and keyboard-openable where feasible (Leaflet marker `keyboard: true`).
- Color is never the sole signal — category chips carry text labels; markers carry the
  photo/glyph, not just color.
- `prefers-reduced-motion`: disable marker scale, polyline dash animation, and any
  entrance transitions.
- Contrast: anchor green text on white and green button on white both clear 4.5:1; muted
  text uses `slate-500/600`, never `slate-400`.

---

## Editor — `src/components/elements/MapElement.tsx`

Editor props follow convention: `{ element, onChange(updates), onDelete, isSelected, onSelect }`.
Controls per the "Editor place-list UI" section above: title · tile style · height ·
journey-line toggle · category manager · places list (add via search/drop/drag, per-place
fields, reorder, remove). Geocoding is a guarded client `fetch` to Nominatim on button
press, one in-flight request, with attribution and a graceful failure → manual pin.

## Public — `src/components/elements/PublicMapElement.tsx` (`'use client'`)

- Leaflet is **dynamically imported** (needs `window`); renders a sized, rounded
  skeleton placeholder (matching `mapHeight`) until mounted — no SSR of the map, no
  layout shift.
- Renders per the Visual Design section: custom markers, restyled popups, category
  legend, optional journey polyline, restyled controls/attribution, auto-fit bounds when
  `mapFitView`.
- Wired into `src/lib/render-elements.tsx` (the real published surface) and
  `ColumnCanvas.tsx` `renderElement` (preview → Public component).

## The "specific to MyGalli" rationale

Photo-pins (each pin is a memory with an image + note + date), the journey line (a trip
or tour), and category filtering turn a generic embedded map into a *gallery of where
you've been* — matching the "a living gallery of you" brand, and visually distinct from a
plain Google Maps embed via the custom marker/popup/chip styling above.

## Wiring checklist (the add-an-element pattern)

1. `src/lib/types/canvas.ts` — `ElementType += 'map'`; `MapPlace`/`MapCategory` types;
   `CanvasElement` map fields; `createElement('map')` default.
2. `src/components/elements/MapElement.tsx` (editor, new).
3. `src/components/elements/PublicMapElement.tsx` (public, new, `'use client'`).
4. `src/components/elements/index.ts` — export both.
5. `src/components/canvas/SlashCommandMenu.tsx` — `commands[]` entry
   `{ id: 'map', label: 'Map', icon: <MapPin/>, description: 'Pin places on an interactive map', category: 'Media' }`.
6. `src/components/canvas/ColumnCanvas.tsx` — `renderElement` case.
7. `src/lib/render-elements.tsx` — case returning `PublicMapElement`.
8. `next.config.js` CSP — see below.
9. `package.json` — add `leaflet` (+ `@types/leaflet` dev).
10. Element-local marker/popup/chip CSS (Leaflet overrides) — colocated CSS module or a
    scoped stylesheet imported by the Public/editor components.

## CSP changes (`next.config.js`)

- `img-src`: add `https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com`
  (tile PNGs). Published pages need only this.
- `connect-src`: add `https://nominatim.openstreetmap.org` (geocoding — editor only, but
  CSP is global so it's listed once). No change to `script-src` (Leaflet is bundled).
- Leaflet marker/CSS assets served same-origin (import Leaflet CSS, set marker icon paths
  to bundled assets) to avoid the classic broken-icon CDN issue and any external fetch.

## Security / safety

- Directions/photo links: `target="_blank" rel="noopener noreferrer"`; only `https?:`
  hrefs (guard the deep-link builder).
- Photos flow through existing `/api/upload` (MIME validation) under the Blob CSP
  allowlist already present.
- `lat`/`lng` coerced to finite numbers before use; out-of-range/NaN places are skipped
  on render.
- Nominatim called only on explicit user action in the editor; no automated/bulk calls.

## Testing

Leaflet needs `window`, so we don't fight jsdom with a full map render. Unit-test the
**pure helpers** (extracted into `src/lib/map.ts` or colocated):
- `buildDirectionsUrl(place)` → correct Google Maps deep-link; rejects non-finite coords.
- `markerStyleFor(place, categories)` → resolves color/emoji + photo-vs-plain variant,
  falls back when category missing.
- `mapNominatimResult(json)` → maps a Nominatim response item to `{ lat, lng, label,
  address }` (finite-number guard).
- `visiblePlaces(places, activeCategory)` → category filter logic.
- Public component **mount guard**: renders the sized skeleton without throwing when
  Leaflet isn't loaded (dynamic-import path).

Plus a `createElement('map')` defaults test asserting the default shape.

## Scope / sequencing

Single focused spec → single implementation plan. Larger than a Batch-1 element (new npm
dep, geocoding, Leaflet lifecycle, custom marker/popup CSS), so it's its own spec rather
than folded into Batch 2. Gated by `tsc --noEmit` + full vitest suite, then deployed for
live mobile testing.

## Deferred (YAGNI for v1)

- Passport stats bar (cities/countries counts) — dropped from v1; country parsing from
  addresses was too fuzzy for click-dropped pins. Revisit if creators ask for it.
- Real turn-by-turn routing engine (deep-link covers it).
- Directions from **preset** origins (v1 = visitor's current location as origin).
- Brand-styled vector tiles (that was the rejected Mapbox path).
- Pro-gating (separate labeling phase).
- Clustering for very large pin counts (revisit if creators exceed ~50 pins).

## Files touched

New: `MapElement.tsx`, `PublicMapElement.tsx`, `map.ts` (helpers), marker/popup CSS +
tests.
Edited: `canvas.ts`, `elements/index.ts`, `SlashCommandMenu.tsx`, `ColumnCanvas.tsx`,
`render-elements.tsx`, `next.config.js`, `package.json`.
