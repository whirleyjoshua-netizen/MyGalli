# Banner Element — Design

**Date:** 2026-07-29
**Status:** Approved, ready for planning

## Summary

Add a `banner` element: a decorative/announcement strip placeable anywhere on the
canvas. One element type covers three preset families — heraldic (Galli's
fairytale visual language), announcement, and hero band.

It is an ordinary in-flow canvas element. It is **not** a header setting, not a
`Display`-level field, and not sticky or page-wide. A header gets a banner by
placing one directly beneath it.

Free, not Pro-gated, consistent with the other Batch 1 design elements.

## Data model

New `ElementType` member `'banner'`. Fields on `CanvasElement`, stored with the
`banner*` prefix per existing convention:

```ts
bannerPreset: 'ribbon' | 'pennant' | 'crest'   // heraldic
            | 'strip'  | 'notice'              // announcement
            | 'hero'   | 'band'                // hero
bannerHeading?: string
bannerSubtext?: string
bannerFillKind: 'token' | 'gradient' | 'image'
bannerFillValue: string        // galli token name | gradient name | blob URL
bannerLinkLabel?: string
bannerLinkUrl?: string
```

Alignment, height, padding, radius and text color are **derived from the preset**,
never stored. This keeps the inspector small and the output hard to make ugly.
Each preset fixes an AA-safe text color against its own fill range.

Defaults live in `createElement()` in `src/lib/types/canvas.ts` — the single
source of truth.

## Components

Three files, following the editor/public pair convention:

- `src/components/elements/BannerElement.tsx` — editor view. Renders the real
  banner (not a placeholder) with inline-editable heading/subtext.
  Props `{ element, onChange, onDelete, isSelected, onSelect }`.
- `src/components/elements/PublicBanner.tsx` — public view, read-only.
  Props `{ element }`.
- `src/components/elements/banner/BannerShape.tsx` — shared presentational
  module. Takes a resolved config, returns markup. **All shape math lives here
  and only here**, so editor and public page cannot drift visually. No store
  access, no editing logic, directly testable.

Shapes are inline SVG with CSS `clip-path` fallbacks, not images: they scale to
any width, recolor from the fill config, and cost no network requests. Only the
heraldic presets use the SVG path; `strip`/`notice`/`hero`/`band` are plain
rectangles.

The link button routes through `src/lib/editor/safe-href.ts`, as `link-hub` and
`product-list` do. Image fills reuse the existing upload path and host
allowlist — no new CSP or blob surface.

## Configuration

Inspector-native from day one: `BannerInspector` registered in
`src/components/editor/panel/inspectors/registry.tsx`. **No gear modal** — this
keeps the element out of the 11-element settings-migration backlog rather than
adding to it.

The inspector exposes exactly: preset picker, fill kind + value, heading,
subtext, link label, link URL. Nothing else.

## Wiring seams

1. `ElementType` union + `CanvasElement` fields + `createElement()` default in
   `src/lib/types/canvas.ts`
2. `BannerElement.tsx`, `PublicBanner.tsx`, `banner/BannerShape.tsx`
3. `src/components/canvas/SlashCommandMenu.tsx` — Design category
4. `ColumnCanvas.tsx` `renderElement` — preview → `PublicBanner`, else
   `BannerElement`
5. `src/components/elements/index.ts`
6. `render-elements.tsx`
7. `panel/inspectors/registry.tsx` — `banner: BannerInspector`

## Testing

Vitest, following the `PollInspector.test.tsx` pattern on this branch.

- `BannerShape.test.tsx` — each of the seven presets renders; heading and
  subtext appear; the link renders only when both label and URL are set; a
  `javascript:` `bannerLinkUrl` is neutralized by `safe-href`.
- `BannerInspector.test.tsx` — preset, fill and text changes each call
  `onChange` with the correct **stored** `banner*` key; switching fill kind
  clears the stale `bannerFillValue` rather than leaving a gradient name in an
  image slot.
- A `createElement('banner')` default-shape assertion in the canvas types test.

Run the suite alone — never alongside another suite (known worker-spawn
timeouts under load).

## Risks

- **Preset sprawl.** Seven is the ceiling. Additional shapes are a follow-up,
  not scope creep here.
- **Stored-name drift.** The inspector must write `bannerPreset`, not a
  component prop name — the trap the KPI migration hit. Check `ColumnCanvas.tsx`
  first when wiring; the inspector test asserts stored keys.
- **`clip-path` in print/capture paths.** May drop out. Accepted: fills still
  render as rectangles, degrading gracefully.
- **Contrast on image fills.** A user photo can put white text on white. The
  image fill applies a fixed, non-configurable scrim (same idea as the header's
  `overlayOpacity`) so it cannot be turned off into an unreadable state.

## Out of scope

Dismissible banners; sticky or page-wide banners; custom hex colors; per-banner
fonts; animation; any `HeaderCardConfig` change.
