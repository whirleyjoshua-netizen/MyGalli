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
