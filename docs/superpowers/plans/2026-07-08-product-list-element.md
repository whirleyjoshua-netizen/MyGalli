# Product List Element — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free `product-list` canvas element — an Amazon-registry-style showcase where the owner pastes a product URL to auto-fill a card (image/title/price/description) and visitors browse a grid of cards with a neutral "View" buy button.

**Architecture:** All product data lives in the element JSON (no DB). A new auth-gated, rate-limited, SSRF-guarded `POST /api/link-preview` fetches a URL's OpenGraph metadata and re-hosts the image to Vercel Blob (the CSP only allows Blob-hosted images). Pure helpers (`isBlockedIp`, `parseMetadata`) carry the tested logic. An editor + public component pair, wired through the standard element checklist.

**Tech Stack:** Next.js 15 App Router (route handlers, RSC), React 19, TypeScript, Vercel Blob, Vitest. Windows + Git Bash.

## Global Constraints

- **Free feature:** never add an `isPro` check to the element or the route.
- **CSP:** product images MUST be Blob-hosted (`*.public.blob.vercel-storage.com`) — the route re-hosts remote OG images; never return/render a raw remote image URL. Do NOT modify `next.config.js` CSP.
- **SSRF:** the link-preview route fetches arbitrary user URLs server-side. It MUST reject non-http(s) schemes and any URL resolving to loopback/private/link-local/metadata IPs, re-check redirects, and cap timeout + body size. Both the page fetch and the image fetch are guarded.
- **Link safety:** render `buyUrl` only through `safeHref` from `@/lib/editor/safe-href`; external links use `target="_blank" rel="noopener noreferrer"`.
- **Element prop contracts (verbatim):** editor props `{ element, onChange, onDelete, isSelected, onSelect }` where `onChange: (updates: Partial<CanvasElement>) => void`; public props `{ element }: { element: CanvasElement }`. Public components use hardcoded `slate-*` Tailwind (they render on published pages), editor components use theme tokens (`border-border`, `bg-background`, `ring-primary`, etc.).
- **Gate each task:** `npx tsc --noEmit` (exit 0) AND `npx vitest run` (green; if the full run is killed by machine load, run the task's own test files + tsc and note it). Set `export DATABASE_URL="postgresql://pages:pages@127.0.0.1:5434/pages"` before commands. Do NOT run `pnpm build`. If tsc shows a stale `.next/types/app/enterprise/...` error, `rm -rf .next/types/app/enterprise` and re-run — not your code.
- **git add ONLY the task's files;** never `-A`; never stage `Documents/`, `Images/`, `g1t.json`, `nul`, `test-output.txt`, `.env`, `.claude/settings.local.json`, `.next/`, `_*.mjs`, `_*.log`.

## File Structure

- `src/lib/link-preview.ts` + `src/lib/link-preview.test.ts` — pure `isBlockedIp` + `parseMetadata`. (Task 1)
- `src/lib/types/canvas.ts` — `Product` interface, `'product-list'` in `ElementType`, `productListTitle?`/`products?` on `CanvasElement`, `createElement` case. (Task 2)
- `src/app/api/link-preview/route.ts` — the auth-gated fetch+re-host route. (Task 3)
- `src/components/elements/PublicProductListElement.tsx` — public grid. (Task 4)
- `src/components/elements/ProductListElement.tsx` — editor. (Task 5)
- `src/components/canvas/SlashCommandMenu.tsx`, `src/components/canvas/ColumnCanvas.tsx`, `src/components/elements/index.ts`, `src/lib/render-elements.tsx` — wiring. (Task 6)

---

## Task 1: Pure helpers — SSRF IP guard + metadata parser

**Files:** Create `src/lib/link-preview.ts` + `src/lib/link-preview.test.ts`.

**Interfaces (Produces):**
- `isBlockedIp(ip: string): boolean` — true if the IP is loopback/private/link-local/unspecified/reserved (must-block for SSRF).
- `parseMetadata(html: string, baseUrl: string): { title?: string; image?: string; price?: string; description?: string }` — extracts OpenGraph/meta, resolves a relative image against `baseUrl`.

- [ ] **Step 1: Write the failing test** — `src/lib/link-preview.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { isBlockedIp, parseMetadata } from './link-preview'

describe('isBlockedIp', () => {
  it('blocks loopback / private / link-local / metadata / unspecified', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.5.5', '172.31.255.255', '192.168.0.1', '169.254.169.254', '0.0.0.0', '::1', 'fc00::1', 'fe80::1', '::']) {
      expect(isBlockedIp(ip), ip).toBe(true)
    }
  })
  it('allows public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '2606:2800:220:1::']) {
      expect(isBlockedIp(ip), ip).toBe(false)
    }
  })
  it('blocks 172.16–31 but allows 172.32+', () => {
    expect(isBlockedIp('172.15.0.1')).toBe(false)
    expect(isBlockedIp('172.32.0.1')).toBe(false)
    expect(isBlockedIp('172.20.0.1')).toBe(true)
  })
})

describe('parseMetadata', () => {
  const base = 'https://shop.example.com/p/123'
  it('reads og tags and resolves a relative image', () => {
    const html = `<html><head>
      <meta property="og:title" content="Cool Mug">
      <meta property="og:image" content="/img/mug.jpg">
      <meta property="og:description" content="A very cool mug">
      <meta property="product:price:amount" content="19.99">
    </head></html>`
    expect(parseMetadata(html, base)).toEqual({
      title: 'Cool Mug',
      image: 'https://shop.example.com/img/mug.jpg',
      description: 'A very cool mug',
      price: '19.99',
    })
  })
  it('falls back to <title> and twitter:image, decodes entities', () => {
    const html = `<html><head><title>Tea &amp; Cups</title>
      <meta name="twitter:image" content="https://cdn.example.com/x.png"></head></html>`
    const r = parseMetadata(html, base)
    expect(r.title).toBe('Tea & Cups')
    expect(r.image).toBe('https://cdn.example.com/x.png')
  })
  it('returns empty object when nothing is present', () => {
    expect(parseMetadata('<html></html>', base)).toEqual({})
  })
})
```

- [ ] **Step 2: Run — FAIL.** `npx vitest run src/lib/link-preview.test.ts` → "Cannot find module './link-preview'".

- [ ] **Step 3: Implement `src/lib/link-preview.ts`:**

```ts
// Pure helpers for the link-preview route. No Node/network imports here — the
// route does DNS + fetch; these functions are pure and unit-tested.

/** True if an IP literal is loopback/private/link-local/unspecified/reserved (SSRF must-block). */
export function isBlockedIp(ip: string): boolean {
  const addr = ip.trim().toLowerCase()
  if (!addr) return true

  // IPv6 (incl. IPv4-mapped ::ffff:a.b.c.d)
  if (addr.includes(':')) {
    const mapped = addr.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
    if (mapped) return isBlockedIp(mapped[1])
    if (addr === '::' || addr === '::1') return true
    if (addr.startsWith('fe80') || addr.startsWith('fc') || addr.startsWith('fd')) return true // link-local + unique-local
    if (addr.startsWith('ff')) return true // multicast
    return false
  }

  // IPv4
  const parts = addr.split('.')
  if (parts.length !== 4) return true // not a plain IPv4 → be safe
  const o = parts.map((p) => Number(p))
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true
  const [a, b] = o
  if (a === 0) return true // 0.0.0.0/8
  if (a === 10) return true // 10/8
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16/12
  if (a === 192 && b === 168) return true // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64/10
  if (a >= 224) return true // multicast + reserved
  return false
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&apos;': "'" }
function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|#x27|apos);/g, (m) => ENTITIES[m] ?? m).trim()
}

function metaContent(html: string, key: string): string | undefined {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // property/name before content
  let m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*\\bcontent=["']([^"']*)["']`, 'i'))
  if (m) return decodeEntities(m[1])
  // content before property/name
  m = html.match(new RegExp(`<meta[^>]+\\bcontent=["']([^"']*)["'][^>]*(?:property|name)=["']${esc}["']`, 'i'))
  return m ? decodeEntities(m[1]) : undefined
}

/** Extract OG/meta from raw HTML; resolve a relative image against baseUrl. */
export function parseMetadata(html: string, baseUrl: string): { title?: string; image?: string; price?: string; description?: string } {
  const out: { title?: string; image?: string; price?: string; description?: string } = {}

  const title = metaContent(html, 'og:title') ?? metaContent(html, 'twitter:title') ?? (() => {
    const t = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return t ? decodeEntities(t[1]) : undefined
  })()
  if (title) out.title = title

  const desc = metaContent(html, 'og:description') ?? metaContent(html, 'description')
  if (desc) out.description = desc

  const price = metaContent(html, 'og:price:amount') ?? metaContent(html, 'product:price:amount') ?? metaContent(html, 'twitter:data1')
  if (price) out.price = price

  const rawImage = metaContent(html, 'og:image') ?? metaContent(html, 'twitter:image')
  if (rawImage) {
    try { out.image = new URL(rawImage, baseUrl).href } catch { /* ignore malformed */ }
  }

  return out
}
```

- [ ] **Step 4: Run — PASS.** `npx vitest run src/lib/link-preview.test.ts`.
- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/lib/link-preview.ts src/lib/link-preview.test.ts
git commit -m "feat(product-list): SSRF IP guard + OG metadata parser (pure, tested)"
```

---

## Task 2: Element types + createElement default

**Files:** Modify `src/lib/types/canvas.ts`.

**Interfaces (Produces):** `Product` interface; `'product-list'` ElementType; `CanvasElement.productListTitle?`, `CanvasElement.products?`; `createElement('product-list')` default.

- [ ] **Step 1: Add the `Product` interface** near the `FlowNode` interface (top-of-file element interfaces, ~line 44):

```ts
// Product List element — Amazon-registry-style showcase (all in element JSON)
export interface Product {
  id: string                  // pl-<ts>-<rand>, stable per card
  title: string
  price?: string              // free text, e.g. "$49.99"
  description?: string        // 1–2 line blurb
  imageUrl?: string           // Blob URL (re-hosted) or uploaded; empty → placeholder
  buyUrl: string              // external product link (validated via safeHref; may be '')
}
```

- [ ] **Step 2: Add to the `ElementType` union** — append a member (near `tip-jar`, ~line 146):

```ts
  | 'product-list'
```

- [ ] **Step 3: Add fields to `CanvasElement`** (near the other element field blocks, ~line 300):

```ts
  // Product List specific (showcase of products; all in element JSON)
  productListTitle?: string
  products?: Product[]
```

- [ ] **Step 4: Add the `createElement` case** (in the switch, near `tip-jar`, ~line 1276):

```ts
    case 'product-list':
      return { ...base, productListTitle: 'Products', products: [] }
```

- [ ] **Step 5: Gate + commit** — `npx tsc --noEmit` (exit 0); `npx vitest run`.

```bash
git add src/lib/types/canvas.ts
git commit -m "feat(product-list): element type, Product interface, createElement default"
```

---

## Task 3: `POST /api/link-preview` route (fetch + SSRF + Blob re-host)

**Files:** Create `src/app/api/link-preview/route.ts`.

**Interfaces:**
- Consumes: `isBlockedIp` (Task 1), `parseMetadata` (Task 1), `getUser` (`@/lib/auth`), `rateLimit` (`@/lib/rate-limit`), `blobReadWriteToken` (`@/lib/storage-env`), `put` from `@vercel/blob` (dynamic import), Node `dns/promises`.
- Produces: `POST /api/link-preview` — body `{ url: string }` → `{ title?, price?, description?, imageUrl? }` (200). 401 unauth; 429 rate-limited; 400 invalid/blocked URL; 200 with partial/empty fields on soft failures.

- [ ] **Step 1: Implement `src/app/api/link-preview/route.ts`:**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { lookup } from 'dns/promises'
import { getUser } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { blobReadWriteToken } from '@/lib/storage-env'
import { isBlockedIp, parseMetadata } from '@/lib/link-preview'

const FETCH_TIMEOUT_MS = 5000
const MAX_HTML_BYTES = 1_000_000
const MAX_IMAGE_BYTES = 5_000_000
const UA = 'Mozilla/5.0 (compatible; GalliBot/1.0; +https://mygalli.com)'

// Validate scheme + resolve host, rejecting any address that is loopback/private/etc.
async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw) // throws on garbage
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('scheme')
  const addrs = await lookup(u.hostname, { all: true })
  if (addrs.length === 0) throw new Error('dns')
  for (const a of addrs) if (isBlockedIp(a.address)) throw new Error('blocked')
  return u
}

// Read a response body but stop past a byte cap (defends against huge payloads).
async function readCapped(res: Response, cap: number): Promise<Buffer> {
  const reader = res.body?.getReader()
  if (!reader) return Buffer.from(await res.arrayBuffer())
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) { chunks.push(value); total += value.length; if (total > cap) { await reader.cancel(); break } }
  }
  return Buffer.concat(chunks)
}

async function fetchGuarded(rawUrl: string): Promise<{ url: URL; res: Response } | null> {
  let url: URL
  try { url = await assertPublicUrl(rawUrl) } catch { return null }
  try {
    const res = await fetch(url.href, {
      redirect: 'manual',
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    // One manual redirect hop, re-guarded
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return null
      const next = await assertPublicUrl(new URL(loc, url.href).href)
      const res2 = await fetch(next.href, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
      return res2.ok ? { url: next, res: res2 } : null
    }
    return res.ok ? { url, res } : null
  } catch { return null }
}

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { limit: 20, windowMs: 60_000, prefix: 'linkpreview' })
  if (limited) return limited
  try {
    const me = await getUser(request)
    if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
    if (!rawUrl) return NextResponse.json({ error: 'url required' }, { status: 400 })

    const page = await fetchGuarded(rawUrl)
    if (!page) return NextResponse.json({ error: 'Could not fetch that link' }, { status: 400 })

    const html = (await readCapped(page.res, MAX_HTML_BYTES)).toString('utf8')
    const meta = parseMetadata(html, page.url.href)

    const result: { title?: string; price?: string; description?: string; imageUrl?: string } = {
      title: meta.title, price: meta.price, description: meta.description,
    }

    // Re-host the image to Blob (CSP only allows Blob-hosted images)
    const token = blobReadWriteToken()
    if (meta.image && token) {
      const img = await fetchGuarded(meta.image)
      const ctype = img?.res.headers.get('content-type') ?? ''
      if (img && ctype.startsWith('image/')) {
        const buf = await readCapped(img.res, MAX_IMAGE_BYTES)
        if (buf.length > 0 && buf.length <= MAX_IMAGE_BYTES) {
          const ext = ctype.includes('png') ? '.png' : ctype.includes('webp') ? '.webp' : ctype.includes('gif') ? '.gif' : '.jpg'
          const { put } = await import('@vercel/blob')
          const blob = await put(`${me.id}/product-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`, buf, {
            access: 'public', contentType: ctype, token,
          })
          result.imageUrl = blob.url
        }
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('link-preview error:', error)
    return NextResponse.json({ error: 'Failed to fetch link' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Manual verify** (dev server up + logged-in cookie `galli-auth`):
  - `curl -s -X POST http://127.0.0.1:PORT/api/link-preview -H "Cookie: galli-auth=JWT" -H "Content-Type: application/json" -d '{"url":"https://example.com"}'` → 200 JSON (title present; example.com has no og image → `imageUrl` absent).
  - Blocked: `-d '{"url":"http://169.254.169.254/latest/meta-data/"}'` → 400. `-d '{"url":"http://localhost:3000"}'` → 400. `-d '{"url":"file:///etc/passwd"}'` → 400.
  - Unauth (no cookie) → 401.
  - (Note in the report if no dev server was available and the curl step was skipped — the SSRF logic is unit-covered via `isBlockedIp` in Task 1.)

- [ ] **Step 3: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/app/api/link-preview
git commit -m "feat(product-list): link-preview route — SSRF-guarded fetch + Blob image re-host"
```

---

## Task 4: Public component — product grid

**Files:** Create `src/components/elements/PublicProductListElement.tsx`.

**Interfaces:** Consumes `Product` type (Task 2), `safeHref`. Produces `<PublicProductListElement element={element} />`.

- [ ] **Step 1: Implement `src/components/elements/PublicProductListElement.tsx`:**

```tsx
'use client'

import { Package, ExternalLink } from 'lucide-react'
import { safeHref } from '@/lib/editor/safe-href'
import type { CanvasElement, Product } from '@/lib/types/canvas'

export function PublicProductListElement({ element }: { element: CanvasElement }) {
  const products: Product[] = element.products ?? []
  const title = element.productListTitle?.trim()

  if (products.length === 0) {
    return <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-400 text-center">No products yet.</div>
  }

  return (
    <div>
      {title && <h3 className="text-lg font-semibold text-slate-800 mb-4">{title}</h3>}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const href = safeHref(p.buyUrl)
          return (
            <div key={p.id} className="flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
              <div className="aspect-square bg-slate-50 flex items-center justify-center overflow-hidden">
                {p.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                ) : (
                  <Package className="w-10 h-10 text-slate-300" />
                )}
              </div>
              <div className="flex flex-col flex-1 p-3">
                <p className="text-sm font-semibold text-slate-800 line-clamp-2">{p.title}</p>
                {p.price && <p className="mt-1 text-sm font-medium text-slate-900">{p.price}</p>}
                {p.description && <p className="mt-1 text-xs text-slate-500 line-clamp-2">{p.description}</p>}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition"
                  >
                    View <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Component test** — `src/components/elements/PublicProductListElement.test.tsx`: renders a product with an image + a valid `buyUrl` → asserts the title shows and the "View" link has `href` = the buy url and `target="_blank"`; a product with a `javascript:` buyUrl → asserts NO link is rendered (safeHref rejects). Empty products → "No products yet.".

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { PublicProductListElement } from './PublicProductListElement'
import type { CanvasElement } from '@/lib/types/canvas'

const el = (products: any[]): CanvasElement => ({ id: 'e1', type: 'product-list', products } as CanvasElement)

describe('PublicProductListElement', () => {
  it('renders a safe buy link in a new tab', () => {
    render(<PublicProductListElement element={el([{ id: 'p1', title: 'Mug', buyUrl: 'https://shop.example.com/mug', imageUrl: '' }])} />)
    expect(screen.getByText('Mug')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /view/i })
    expect(link).toHaveAttribute('href', 'https://shop.example.com/mug')
    expect(link).toHaveAttribute('target', '_blank')
  })
  it('drops an unsafe buy url (no link rendered)', () => {
    render(<PublicProductListElement element={el([{ id: 'p2', title: 'Bad', buyUrl: 'javascript:alert(1)' }])} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
  it('shows empty state', () => {
    render(<PublicProductListElement element={el([])} />)
    expect(screen.getByText('No products yet.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run test — PASS.** `npx vitest run src/components/elements/PublicProductListElement.test.tsx`.
- [ ] **Step 4: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/components/elements/PublicProductListElement.tsx src/components/elements/PublicProductListElement.test.tsx
git commit -m "feat(product-list): public product grid (safe links, blob images)"
```

---

## Task 5: Editor component — add-by-URL + editable rows

**Files:** Create `src/components/elements/ProductListElement.tsx`.

**Interfaces:** Consumes `Product` type (Task 2), `safeHref`, `POST /api/link-preview` (Task 3), `POST /api/upload` (existing). Produces `<ProductListElement element onChange onDelete isSelected onSelect />`.

- [ ] **Step 1: Implement `src/components/elements/ProductListElement.tsx`:**

```tsx
'use client'

import { useState } from 'react'
import { Trash2, Plus, Loader2, ShoppingBag, ChevronUp, ChevronDown, ImagePlus } from 'lucide-react'
import type { CanvasElement, Product } from '@/lib/types/canvas'

interface Props {
  element: CanvasElement
  onChange: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  isSelected: boolean
  onSelect: () => void
}

function newId() { return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

export function ProductListElement({ element, onChange, onDelete, isSelected, onSelect }: Props) {
  const products: Product[] = element.products ?? []
  const [url, setUrl] = useState('')
  const [fetching, setFetching] = useState(false)
  const [uploadingId, setUploadingId] = useState<string | null>(null)

  const set = (next: Product[]) => onChange({ products: next })
  const update = (id: string, patch: Partial<Product>) => set(products.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const remove = (id: string) => set(products.filter((p) => p.id !== id))
  const move = (id: string, dir: -1 | 1) => {
    const i = products.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= products.length) return
    const next = [...products]
    ;[next[i], next[j]] = [next[j], next[i]]
    set(next)
  }

  async function addByUrl() {
    const buyUrl = url.trim()
    if (!buyUrl) return
    setFetching(true)
    const product: Product = { id: newId(), title: '', buyUrl }
    try {
      const res = await fetch('/api/link-preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: buyUrl }),
      })
      if (res.ok) {
        const d = await res.json()
        product.title = d.title || ''
        product.price = d.price || undefined
        product.description = d.description || undefined
        product.imageUrl = d.imageUrl || undefined
      }
    } catch { /* fall through to a blank editable card */ }
    finally {
      if (!product.title) product.title = 'New product'
      set([...products, product])
      setUrl('')
      setFetching(false)
    }
  }

  async function replaceImage(id: string, file: File) {
    setUploadingId(id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); update(id, { imageUrl: d.url }) }
    } finally { setUploadingId(null) }
  }

  return (
    <div
      className={`relative group rounded-xl border bg-background transition-all ${isSelected ? 'ring-2 ring-primary border-primary/30' : 'border-border hover:border-primary/30'}`}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="absolute -top-2 -right-2 z-10 p-1 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition" title="Delete element">
        <Trash2 className="w-3.5 h-3.5" />
      </button>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <ShoppingBag className="w-4 h-4" /> Product List
        </div>

        <input
          value={element.productListTitle ?? ''}
          onChange={(e) => onChange({ productListTitle: e.target.value })}
          onClick={(e) => e.stopPropagation()}
          placeholder="List title (optional)"
          className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
        />

        {/* Add by URL */}
        <div className="flex gap-1.5">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addByUrl() } }}
            placeholder="Paste a product link to auto-fill…"
            className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); addByUrl() }}
            disabled={fetching || !url.trim()}
            className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shrink-0"
          >
            {fetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
          </button>
        </div>

        {/* Product rows */}
        <div className="space-y-2">
          {products.map((p, i) => (
            <div key={p.id} className="flex gap-2 rounded-lg border border-border p-2" onClick={(e) => e.stopPropagation()}>
              <label className="w-16 h-16 shrink-0 rounded-md bg-muted/40 border border-border flex items-center justify-center overflow-hidden cursor-pointer relative">
                {uploadingId === p.id ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  : p.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : <ImagePlus className="w-5 h-5 text-muted-foreground" />}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replaceImage(p.id, f) }} />
              </label>
              <div className="flex-1 min-w-0 space-y-1.5">
                <input value={p.title} onChange={(e) => update(p.id, { title: e.target.value })} placeholder="Title" className="w-full px-2 py-1 text-sm border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                <div className="flex gap-1.5">
                  <input value={p.price ?? ''} onChange={(e) => update(p.id, { price: e.target.value })} placeholder="Price" className="w-24 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input value={p.buyUrl} onChange={(e) => update(p.id, { buyUrl: e.target.value })} placeholder="Buy link (https://…)" className="flex-1 min-w-0 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <input value={p.description ?? ''} onChange={(e) => update(p.id, { description: e.target.value })} placeholder="Short description (optional)" className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <button type="button" onClick={() => move(p.id, -1)} disabled={i === 0} className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Move up"><ChevronUp className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => move(p.id, 1)} disabled={i === products.length - 1} className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Move down"><ChevronDown className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => remove(p.id)} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Remove product"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
          {products.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Add your first product above.</p>}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`. (No dedicated test — the editor is exercised by the wiring + manual verify in Task 6; the tested logic lives in the route + public component.)

```bash
git add src/components/elements/ProductListElement.tsx
git commit -m "feat(product-list): editor — paste-to-autofill, editable rows, image replace, reorder"
```

---

## Task 6: Wiring — slash menu (Commerce), canvas, barrel, published page

**Files:** Modify `src/components/canvas/SlashCommandMenu.tsx`, `src/components/canvas/ColumnCanvas.tsx`, `src/components/elements/index.ts`, `src/lib/render-elements.tsx`.

- [ ] **Step 1: Slash menu** — in `SlashCommandMenu.tsx`:
  - Ensure `ShoppingBag` is imported from `lucide-react` (add to the icon import block if absent).
  - Add `'Commerce'` to `CATEGORY_ORDER` (choose a sensible position, e.g. after `'Media'`): `const CATEGORY_ORDER = ['Content', 'Data & Visuals', 'Media', 'Commerce', 'Scheduling', 'Live', 'Forms', 'Social', 'Apps', 'Kit']`
  - Add a command entry to the `commands` array:

```ts
  { id: 'product-list', label: 'Product List', icon: ShoppingBag, description: 'A shoppable list of products with images & buy links', category: 'Commerce' },
```

- [ ] **Step 2: ColumnCanvas** — in `ColumnCanvas.tsx`:
  - Add direct imports near the other element imports (~line 114):

```ts
import { ProductListElement } from '@/components/elements/ProductListElement'
import { PublicProductListElement } from '@/components/elements/PublicProductListElement'
```
  - Add a case in `renderElement`'s switch (mirror `flowchart`):

```tsx
      case 'product-list':
        if (isPreviewMode) {
          return <PublicProductListElement element={element} />
        }
        return (
          <ProductListElement
            element={element}
            onChange={(updates) => onUpdateElement(sectionId, columnId, element.id, updates)}
            onDelete={() => onDeleteElement(sectionId, columnId, element.id)}
            isSelected={commonProps.isSelected}
            onSelect={commonProps.onSelect}
          />
        )
```

- [ ] **Step 3: Barrel export** — in `src/components/elements/index.ts`, add:

```ts
export { ProductListElement } from './ProductListElement'
export { PublicProductListElement } from './PublicProductListElement'
```

- [ ] **Step 4: Published page** — in `src/lib/render-elements.tsx`:
  - Add the direct import near the other public imports (~line 59): `import { PublicProductListElement } from '@/components/elements/PublicProductListElement'`
  - Add a case in the switch (pure-display, `element` only):

```tsx
    case 'product-list':
      return <PublicProductListElement element={element} />
```

- [ ] **Step 5: Manual verify** (dev server): open the editor, `/` → **Commerce → Product List** inserts the element; paste a URL → card auto-fills (title/price/image where available); edit fields; reorder; the buy "View" link works; publish the page and confirm the public grid renders with Blob images and safe links. (If no dev server, note it — tsc + the Task 1/4 tests cover the logic.)

- [ ] **Step 6: Gate + commit** — `npx tsc --noEmit`; `npx vitest run`.

```bash
git add src/components/canvas/SlashCommandMenu.tsx src/components/canvas/ColumnCanvas.tsx src/components/elements/index.ts src/lib/render-elements.tsx
git commit -m "feat(product-list): wire into slash menu (Commerce), canvas, and published page"
```

---

## Verification (after all tasks)

1. `npx tsc --noEmit` clean; `npx vitest run` green.
2. Manual (dev): insert a Product List via the slash menu's **Commerce** category; paste 2–3 real product links (expect auto-fill on OG-friendly sites, blank editable card on Amazon/blocked sites); upload a manual image on one; reorder; set a title. Publish → the public page shows a responsive card grid with Blob-hosted images and working new-tab "View" links.
3. Security spot-check: `POST /api/link-preview` with `http://169.254.169.254/…`, `http://localhost`, and a private `10.x` URL all return 400; unauthenticated returns 401.

## Self-review notes (checked against spec)

- **Coverage:** helpers+SSRF+parser (T1), types+createElement (T2), route with re-host (T3), public grid (T4), editor with autofill/upload/reorder (T5), full wiring incl. Commerce category (T6). ✔
- **Free:** no `isPro` anywhere. ✔
- **CSP:** images only ever Blob URLs (route re-hosts; public renders `imageUrl` which is Blob or empty→placeholder). ✔
- **SSRF:** scheme allowlist + DNS resolve + `isBlockedIp` on every hop, for both page and image fetch; timeouts + byte caps; auth-gated + rate-limited. ✔
- **Link safety:** `safeHref` gates every `buyUrl`; external `rel="noopener noreferrer"`. ✔
- **Type consistency:** `Product` shape identical across canvas.ts, route result mapping, public, editor; prop contracts match the flowchart precedent. ✔
