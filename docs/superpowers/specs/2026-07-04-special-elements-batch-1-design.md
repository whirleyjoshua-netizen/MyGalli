# Special Elements — Batch 1 — design

Date: 2026-07-04
Status: draft (awaiting user review)
Part of: release-roadmap-2026-07 phase 1 (new-elements trench)

## Goal

Add five high-impact, differentiated element types that make Galli pages feel
"truly special", spanning delight, creator growth, storytelling, and
monetization. Build them **free/functional**; the free-vs-Pro labeling is a
separate later phase — no gating in this batch.

## The five elements

| # | Type id | Category | Theme | External deps |
|---|---------|----------|-------|---------------|
| 1 | `link-hub` | Media | Creator growth | none |
| 2 | `gallery` | Media | Storytelling | `/api/upload` (Blob) |
| 3 | `countdown` | Content | Delight | none |
| 4 | `before-after` | Media | Delight | `/api/upload` (Blob) |
| 5 | `tip-jar` | Media | Monetization | none (link-out) |

**No new Prisma models, no new API routes, no migration.** Every element is
pure `Display.sections` JSON config + client rendering. Image-based elements
reuse the existing `POST /api/upload` (FormData `file` → `{ url }`, 10MB cap)
already used by `ImageElement`. Categories are all within the existing
`CATEGORY_ORDER` (`Content`, `Media`, …) — a category outside that list is
filtered out of the slash menu, so we reuse existing ones.

## The add-an-element pattern (applies to each)

Each element repeats these wiring points (per project MEMORY):

1. `src/lib/types/canvas.ts` — add id to `ElementType`; add typed fields to
   `CanvasElement`; add a `createElement()` default case. **This is the single
   source of defaults** (see the PageEditor refactor below).
2. `src/components/elements/{Name}Element.tsx` (editor) +
   `Public{Name}Element.tsx` (published view). Editor props follow the existing
   convention: `{ element, onChange(updates), onDelete, isSelected, onSelect }`.
3. `src/components/elements/index.ts` — export both.
4. `src/components/canvas/SlashCommandMenu.tsx` — add a `commands[]` entry
   `{ id, label, icon, description, category }`.
5. `src/components/canvas/ColumnCanvas.tsx` — add a `renderElement` case
   (preview → Public component, else editor component).
6. `src/lib/render-elements.tsx` — add a case returning the Public component
   (this is what the real published page at `/[username]/[slug]` renders).

### One-time enabling refactor: `PageEditor.handleCommandSelect`

Today `handleCommandSelect` in `PageEditor.tsx` contains a second, hand-maintained
`switch` that duplicates every element's defaults (it has **no `default` case**),
separate from `createElement()`. Adding five elements the current way means five
more duplicate default blocks that can silently drift from `canvas.ts`.

Instead, add a single `default:` branch to that switch:

```ts
default: {
  Object.assign(newElement, createElement(type))
  break
}
```

Existing cases match first and are left **untouched** (zero behavioral change).
New elements simply omit a case there and fall through to `createElement`, so
their defaults live in exactly one place (`canvas.ts`). This is a targeted
improvement to code we're actively editing — not a broad refactor of the existing
cases. (The special `card` case keeps its Pro-gating early-return.)

Public components may be client components (`'use client'`) when interactive —
several are (countdown ticks, before/after drags, gallery lightbox), same as the
existing `comment`/`poll` public elements.

## Element designs

### 1. `link-hub` — Link-in-bio hub (Media)

The Linktree-style block: a title and a vertical stack of big tappable link
buttons, each with an optional platform icon.

Fields:
- `linkHubTitle?: string`
- `linkHubItems?: { label: string; url: string; icon?: string }[]`
  where `icon` is a platform key from a curated set mapped to lucide icons:
  `instagram | twitter | youtube | tiktok | github | linkedin | facebook |
  twitch | spotify | email | website` (fallback: generic `Link`). (tiktok/spotify
  fall back to a generic music/link glyph if lucide lacks a brand icon.)

`createElement` default: `{ linkHubTitle: '', linkHubItems: [{ label: 'My website', url: '', icon: 'website' }] }`.

Editor: title input; a list of rows (label, url, icon picker); add / remove /
move-up / move-down.

Public: title, then full-width rounded buttons (icon + label), `target="_blank"
rel="noopener noreferrer"`. Empty-url rows are skipped on the public view.

### 2. `gallery` — Photo gallery + lightbox (Media)

Responsive image grid; tapping an image opens a full-screen lightbox with
prev/next and caption. (Distinct from the Creative-Kit `mood-board`, which is a
styled grid with no viewer; `gallery` is general-purpose and adds the lightbox.)

Fields:
- `galleryTitle?: string`
- `galleryImages?: { url: string; caption?: string; alt?: string }[]`
- `galleryColumns?: 2 | 3 | 4`

`createElement` default: `{ galleryTitle: '', galleryImages: [], galleryColumns: 3 }`.

Editor: title; column-count selector; image list with upload (reuse
`/api/upload`), per-image caption, remove, reorder.

Public (`'use client'`): CSS grid at `galleryColumns` (responsive: fewer columns
on mobile); click/tap opens a fixed-overlay lightbox (image + caption, ‹ ›
buttons, close on backdrop/✕/Esc, ←/→ to navigate on desktop).

### 3. `countdown` — Countdown timer (Content)

Live-ticking countdown to a target date/time, shown as D / H / M / S boxes.

Fields:
- `countdownTitle?: string`
- `countdownTarget?: string` — `datetime-local` value (no timezone); compared to
  the viewer's local clock (i.e. "midnight" means the viewer's midnight). This
  tradeoff is intentional and documented for v1.
- `countdownStyle?: 'boxes' | 'inline'`
- `countdownColor?: string` — hex accent, default `#39D98A`
- `countdownExpiredText?: string`

`createElement` default: `{ countdownTitle: 'Counting down', countdownTarget: '',
countdownStyle: 'boxes', countdownColor: '#39D98A', countdownExpiredText: "It's here! 🎉" }`.

Editor: title; `datetime-local` picker; style toggle; accent color; expired text.

Public (`'use client'`): a `setInterval` (1s) recomputes remaining time; renders
D/H/M/S; when the target passes, shows `countdownExpiredText`. Interval cleared
on unmount. If `countdownTarget` is empty, renders a neutral placeholder.

### 4. `before-after` — Before/After image slider (Media)

Two overlaid images with a draggable vertical divider that reveals more/less of
the "after" image — the standout interaction.

Fields:
- `beforeAfterBefore?: string` (image url)
- `beforeAfterAfter?: string` (image url)
- `beforeAfterBeforeLabel?: string` (default `Before`)
- `beforeAfterAfterLabel?: string` (default `After`)
- `beforeAfterHeight?: number` (px, default 400)

`createElement` default: `{ beforeAfterBefore: '', beforeAfterAfter: '',
beforeAfterBeforeLabel: 'Before', beforeAfterAfterLabel: 'After', beforeAfterHeight: 400 }`.

Editor: two uploads (before, after); label inputs; height.

Public (`'use client'`): container at `beforeAfterHeight`; before image full,
after image clipped to a percentage controlled by a draggable handle (pointer +
touch). Corner labels. If either image is missing, shows a friendly placeholder.

### 5. `tip-jar` — Tip jar / support button (Media)

A support card that links out to the creator's tip destination (Ko-fi, Venmo,
PayPal, Cash App, Stripe link, or custom). **Link-out only — no payment
processing**, which keeps it safe and Pro-gate-friendly for phase 2.

Fields:
- `tipJarTitle?: string`
- `tipJarMessage?: string`
- `tipJarPlatform?: 'kofi' | 'venmo' | 'paypal' | 'cashapp' | 'stripe' | 'custom'`
- `tipJarUrl?: string`
- `tipJarButtonText?: string`
- `tipJarAmounts?: string[]` — optional display-only suggested-amount chips, each
  linking to `tipJarUrl`.

`createElement` default: `{ tipJarTitle: 'Support my work', tipJarMessage: 'If you
enjoy what I do, consider leaving a tip 💚', tipJarPlatform: 'custom', tipJarUrl:
'', tipJarButtonText: 'Leave a tip', tipJarAmounts: ['$3', '$5', '$10'] }`.

Editor: title; message; platform select (seeds default button text/icon); url;
button text; amounts (comma-separated).

Public: card with title, message, optional amount chips, and a primary CTA button
→ `tipJarUrl` (`target="_blank" rel="noopener noreferrer"`). Renders nothing
actionable (button disabled/hidden) if `tipJarUrl` is empty.

## Security / safety

- All outbound links use `rel="noopener noreferrer"` and `target="_blank"`.
- URLs are user-authored and rendered as `href` only (no `javascript:` — add a
  simple `http(s)`-only guard in the Public link components).
- Images come through `/api/upload` (existing MIME validation) and render under
  the existing image-host CSP allowlist (Blob).

## Testing

Per element, a Public-component unit test (the published surface):
- `link-hub`: renders items as links with correct `href`; skips empty-url rows.
- `gallery`: renders N grid images; clicking one opens the lightbox; Esc/close hides it.
- `countdown`: with a future target renders D/H/M/S; with a past target shows expired text. (Use a fixed injected "now"/target to avoid time flakiness.)
- `before-after`: renders both images + handle; missing image → placeholder.
- `tip-jar`: renders CTA linking to url; empty url → no actionable link; amount chips render.

Plus a `createElement` defaults test asserting each new type returns its default shape.

## Scope / sequencing

One element per implementation task, built and shipped in order (link-hub →
gallery → countdown → before-after → tip-jar), each gated by `tsc` + full vitest
suite and deployed for live mobile testing before the next. Batch 2 (testimonials,
FAQ, social-links row, contact/vCard, map, now-playing, audio, product/buy,
booking, gated download) follows in a later spec.

## Files touched

Task 0 (one-time): `PageEditor.tsx` — add the `default:` fallback to
`handleCommandSelect`.

Per element (~5 edits + 3 new files each): canvas.ts ·
elements/{Name}Element.tsx (new) · elements/Public{Name}Element.tsx (new) ·
elements/index.ts · SlashCommandMenu.tsx · ColumnCanvas.tsx ·
render-elements.tsx · Public{Name}Element.test.tsx (new). No PageEditor edit per
element (handled by Task 0's fallback).
