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
// Known limitation (accepted for v1): this DNS lookup and the DNS resolution that `fetch`
// performs when it actually connects are independent (TOCTOU), so a DNS-rebinding attacker
// who resolves this hostname to a public IP now and a private/internal IP moments later
// could bypass this check. Full mitigation would require pinning the resolved IP for the
// actual connection (e.g. custom dispatcher/agent); out of scope for v1.
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
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer())
    return buf.length > cap ? buf.subarray(0, cap) : buf
  }
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
  let target = rawUrl
  for (let hop = 0; hop < 4; hop++) {
    let url: URL
    try { url = await assertPublicUrl(target) } catch { return null }
    let res: Response
    try {
      res = await fetch(url.href, { redirect: 'manual', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    } catch { return null }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location')
      if (!loc) return null
      try { target = new URL(loc, url.href).href } catch { return null }
      continue // re-guard the next hop
    }
    return res.ok ? { url, res } : null
  }
  return null // too many redirects
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
