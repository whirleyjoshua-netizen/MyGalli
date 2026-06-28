export type LinkProvider = 'instagram' | 'x' | 'youtube' | 'tiktok' | 'linkedin' | 'github' | 'web'

export function detectLinkProvider(url: string): LinkProvider {
  const u = url.toLowerCase()
  if (u.includes('instagram.com')) return 'instagram'
  if (u.includes('x.com') || u.includes('twitter.com')) return 'x'
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube'
  if (u.includes('tiktok.com')) return 'tiktok'
  if (u.includes('linkedin.com')) return 'linkedin'
  if (u.includes('github.com')) return 'github'
  return 'web'
}

export function sanitizeInterests(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const raw of input) {
    if (typeof raw !== 'string') continue
    const t = raw.trim()
    if (t && !out.includes(t)) out.push(t)
    if (out.length >= 12) break
  }
  return out
}

export function sanitizeLinks(input: unknown): { label: string; url: string }[] {
  if (!Array.isArray(input)) return []
  const out: { label: string; url: string }[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const label = typeof (raw as { label?: unknown }).label === 'string' ? (raw as { label: string }).label.trim() : ''
    const url = typeof (raw as { url?: unknown }).url === 'string' ? (raw as { url: string }).url.trim() : ''
    if (label && /^https?:\/\//i.test(url)) out.push({ label, url })
    if (out.length >= 10) break
  }
  return out
}
