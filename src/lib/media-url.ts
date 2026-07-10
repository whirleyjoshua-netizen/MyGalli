// Guards the `mediaUrl` a visitor submits with a mailbox/profile message.
// A legit media URL is either our own dev-fallback upload path
// (`/api/upload/messages/...`) or a Vercel Blob URL from `/api/messages/upload`
// (`https://<id>.public.blob.vercel-storage.com/...`). Anything else — an
// arbitrary external URL a sender could inject to render as `<audio src>` in the
// owner's inbox (tracking beacon / content spoofing) — is rejected.
export function isAllowedMessageMedia(url: string): boolean {
  if (!url) return true // no media — allowed
  if (url.startsWith('/api/upload/messages/')) return true
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')
  } catch {
    return false
  }
}
