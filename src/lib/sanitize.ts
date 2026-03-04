/**
 * Lightweight HTML sanitizer that works in both server and client environments.
 * Allows only safe inline formatting tags and strips everything else.
 * No jsdom dependency — works in Next.js SSR and Edge runtime.
 */

const ALLOWED_TAGS = new Set([
  'b', 'i', 'u', 's', 'em', 'strong', 'br', 'p', 'span', 'div',
  'a', 'ul', 'ol', 'li', 'sub', 'sup', 'mark', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
])

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel']),
  span: new Set(['style']),
  div: new Set(['style']),
  p: new Set(['style']),
}

// Matches HTML tags (opening, closing, self-closing)
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)?\/?>/g
// Matches individual attributes
const ATTR_RE = /([a-zA-Z-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g

function sanitizeAttributes(tag: string, attrString: string): string {
  const allowed = ALLOWED_ATTRS[tag]
  if (!allowed || !attrString.trim()) return ''

  const attrs: string[] = []
  let match: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((match = ATTR_RE.exec(attrString)) !== null) {
    const name = match[1].toLowerCase()
    const value = match[2] ?? match[3] ?? ''

    if (!allowed.has(name)) continue

    // Block javascript: URLs in href
    if (name === 'href' && /^\s*javascript:/i.test(value)) continue

    // Block dangerous CSS (expression, url with javascript)
    if (name === 'style' && /expression|javascript|url\s*\(/i.test(value)) continue

    attrs.push(`${name}="${value}"`)
  }

  // Force safe link attributes
  if (tag === 'a' && attrs.some(a => a.startsWith('href='))) {
    if (!attrs.some(a => a.startsWith('rel='))) {
      attrs.push('rel="noopener noreferrer"')
    }
  }

  return attrs.length ? ' ' + attrs.join(' ') : ''
}

export function sanitizeHtml(html: string): string {
  if (!html) return ''

  // Strip script/style tags and their content entirely
  let clean = html.replace(/<(script|style|iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  // Strip remaining self-closing dangerous tags
  clean = clean.replace(/<(script|style|iframe|object|embed|form)\b[^>]*\/?>/gi, '')

  // Process remaining tags — keep allowed, strip others
  clean = clean.replace(TAG_RE, (fullMatch, tagName, attrString) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''

    const isClosing = fullMatch.startsWith('</')
    if (isClosing) return `</${tag}>`

    const attrs = sanitizeAttributes(tag, attrString || '')
    return `<${tag}${attrs}>`
  })

  return clean
}
