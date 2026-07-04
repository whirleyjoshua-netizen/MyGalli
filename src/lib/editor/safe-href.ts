/** Returns the url only if it uses a safe scheme; otherwise undefined. */
export function safeHref(url?: string): string | undefined {
  if (!url) return undefined
  const u = url.trim()
  if (!u) return undefined
  if (u.startsWith('/')) return u // root-relative
  if (/^https?:\/\//i.test(u)) return u
  if (/^mailto:/i.test(u)) return u
  return undefined
}
