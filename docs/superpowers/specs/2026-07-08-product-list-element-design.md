# Product List element — Design Spec

**Date:** 2026-07-08
**Status:** Draft for review

## One-sentence summary

A **`product-list`** canvas element that renders a responsive grid of product cards (image · title · price · short blurb · neutral **"View"** buy button) — an Amazon-registry-style showcase where the owner pastes a product URL to auto-fill the card and visitors click out to purchase. **All data lives in the element JSON — no database.**

## Decisions (locked in brainstorming)

- **Showcase, not a true registry** — no reservation/claim state, no visitor accounts. Pure curated list → click-to-buy externally.
- **Add flow = paste link → auto-fill**, with full manual override (big retailers block/omit tags, so manual is always available).
- **Card fields:** image, title, **price**, **short description**, buy link. (No "most-wanted" badge, no section grouping in v1.)
- **Free** element (like link-hub/gallery/flowchart) — no `isPro` gate.
- **Buy button = neutral "View"**, opens the product page in a new tab.

## Why images must be re-hosted (key constraint)

The app's CSP `img-src` (in `next.config.js`) allowlists only Blob, Unsplash, UI-Avatars, Google, and map tiles — **not arbitrary `https:`**. A product image fetched from (e.g.) Amazon's CDN would be **blocked and never render**. Therefore the auto-fill route **downloads the OpenGraph image and re-uploads it to Vercel Blob**, returning a Blob URL (which IS allowed). This keeps CSP tight, makes images stable (no hotlink rot), and is consistent with how cover images already work.

## Data model (element JSON, no DB)

On `CanvasElement` (`src/lib/types/canvas.ts`):

```ts
productListTitle?: string          // optional heading, e.g. "My Registry"
products?: Product[]               // the list
```

```ts
export interface Product {
  id: string                       // el-<ts>-<rand>, stable per card
  title: string
  price?: string                   // free text, e.g. "$49.99" (not parsed/computed)
  description?: string             // 1–2 line blurb
  imageUrl?: string                // Blob URL (from auto-fill) OR uploaded OR empty → placeholder
  buyUrl: string                   // external product link (validated via safeHref)
}
```

`createElement('product-list')` default: `{ productListTitle: '', products: [] }`.

## Auto-fill route — `POST /api/link-preview`

**Auth:** requires `getUser` (owners only — also limits abuse of the server-side fetcher). Rate-limited (`rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'linkpreview' })`).

**Request:** `{ url: string }`
**Response (200):** `{ title?: string; price?: string; description?: string; imageUrl?: string }` (any/all fields may be absent — editor keeps manual fields editable). Non-2xx on invalid/blocked URL or fetch failure; the editor falls back to manual entry on any failure.

**Flow:**
1. **SSRF guard (`src/lib/link-preview.ts`, pure + tested):**
   - Scheme must be `http`/`https`.
   - `dns.lookup` the hostname; **reject** if the resolved IP is loopback (`127.0.0.0/8`, `::1`), private (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`), link-local (`169.254.0.0/16` incl. cloud-metadata `169.254.169.254`, `fe80::/10`), or unspecified/reserved. Pure helper `isBlockedIp(ip): boolean` (unit-tested against the ranges).
   - Fetch with `redirect: 'manual'` and re-run the guard on any redirect `Location` (redirects are a classic SSRF bypass); cap at 2 hops.
2. **Fetch the page:** 5s timeout (`AbortSignal.timeout`), a normal `User-Agent`, cap the read body at ~1MB (stop reading past it).
3. **Parse metadata (`parseMetadata(html, baseUrl)` — pure + tested):** extract, in priority order, `og:title`→`twitter:title`→`<title>`; `og:image`→`twitter:image`; `og:description`→`meta[name=description]`; price from `og:price:amount`/`product:price:amount`/`twitter:data1`. Resolve a relative `og:image` against `baseUrl`.
4. **Re-host the image:** if an image URL was found, **SSRF-guard it too**, fetch it (5s timeout, `content-type` must be `image/*`, cap ~5MB), and upload to Vercel Blob via the same `put(...)` mechanism `/api/upload` uses; use the returned Blob URL as `imageUrl`. If the image step fails, return the other fields with `imageUrl` omitted (owner can upload manually).
5. Return the assembled metadata.

**Never** return the raw remote image URL to the client (CSP would block it and it's a hotlink) — only a Blob URL or nothing.

## Components

**Editor — `src/components/elements/ProductListElement.tsx`** (props `{element, onChange, onDelete, isSelected, onSelect}`):
- Optional list title input.
- **"Add product"** row: a URL input + "Fetch" button → `POST /api/link-preview` → pre-fills a new product card's fields (spinner while fetching; on failure, silently opens an empty editable card so the owner types it in).
- Each product row is editable: title, price, description, buy link, and an image control that shows the current image with **"Replace"** (upload via existing `/api/upload` → Blob) / clear. Reorder (move up/down) and delete per product. (Drag-reorder deferred; up/down buttons in v1.)
- Uses `safeHref` to validate `buyUrl` on input (reject non-http(s)).

**Public — `src/components/elements/PublicProductListElement.tsx`** (props `{element}`):
- Optional heading (`productListTitle`).
- Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
- Card: image (plain `<img>`, Blob-hosted, `object-cover`, fixed aspect box; `Package`/placeholder icon when no image) · title · price · description (line-clamped) · a **"View"** button/link → `safeHref(buyUrl)`, `target="_blank" rel="noopener noreferrer"`. A product with an invalid/empty `buyUrl` renders the card without the button (never an unsafe link).

**Empty state:** editor shows an "Add your first product" prompt; public renders nothing (or the title only) if `products` is empty.

## Standard element wiring (the checklist)

1. `ElementType` union + the two fields on `CanvasElement` — `src/lib/types/canvas.ts`.
2. `createElement()` default for `'product-list'` — the single source of defaults.
3. `ProductListElement.tsx` (editor) + `PublicProductListElement.tsx` (public) in `src/components/elements/`.
4. Slash menu entry in `SlashCommandMenu.tsx` (icon e.g. `ShoppingBag`; category must be in `CATEGORY_ORDER` — use the existing commerce-ish grouping that `tip-jar` lives in, or add one).
5. `ColumnCanvas.tsx` `renderElement` switch: preview → `PublicProductListElement`, else `ProductListElement`.
6. `elements/index.ts` export.
7. `src/lib/render-elements.tsx` case (the published page) → `PublicProductListElement`.

## Security / safety summary

- **SSRF:** both the page fetch and the image fetch resolve DNS and reject private/loopback/link-local/metadata IPs; redirects re-checked; scheme allowlist; timeouts + size caps. Route is auth-gated + rate-limited.
- **Link safety:** `buyUrl` rendered only through `safeHref` (http/https), new-tab `rel="noopener noreferrer"`.
- **CSP:** images are always Blob-hosted (no `img-src` change needed).
- **No stored XSS surface:** all product fields are plain text rendered as text (React escaping); no HTML injection.

## Testing

- `src/lib/link-preview.test.ts` (Vitest): `isBlockedIp` across the reserved ranges (loopback/private/link-local/metadata/public); `parseMetadata` on sample HTML (og tags present, missing, relative image resolution, `<title>` fallback, price variants).
- Editor component test (optional): "Fetch" calls `/api/link-preview` and pre-fills a card; "View" button uses the buy URL.
- Gate each task: `npx tsc --noEmit` + `npx vitest run`.

## Scope / deferrals (v2)

- True registry (reserve/claim, "N still needed") — the earlier fork; needs a DB model + claim flow.
- Drag-to-reorder products (v1 uses up/down).
- Section grouping / categories; "most-wanted" badge.
- Affiliate-tag handling; price parsing/currency; per-store adapters (Amazon PA-API).
- Bulk import (paste multiple URLs).

## Open items for review

1. **Element name/label** — type `product-list`; slash-menu label "Product List" (alt: "Registry" / "Wishlist" / "Shop"). Which label?
2. **Slash-menu category** — reuse `tip-jar`'s category vs. a new "Commerce/Shop" category. (Will confirm against `CATEGORY_ORDER` in the plan.)
3. **Image re-host on every fetch** creates a Blob object even if the owner discards the card (minor orphan). Acceptable for v1? (Alternative: only re-host on save — more flow.)
