// src/lib/audio-embed.ts
export function spotifyEmbedUrl(shareUrl: string): string | null {
  try {
    const u = new URL(shareUrl)
    if (!/(^|\.)spotify\.com$/i.test(u.hostname)) return null
    const m = u.pathname.match(/\/(track|album|playlist|artist|episode|show)\/([A-Za-z0-9]+)/)
    if (!m) return null
    return `https://open.spotify.com/embed/${m[1]}/${m[2]}`
  } catch {
    return null
  }
}

export function soundcloudEmbedUrl(trackUrl: string): string | null {
  try {
    const u = new URL(trackUrl)
    if (!/(^|\.)soundcloud\.com$/i.test(u.hostname)) return null
    const params = `url=${encodeURIComponent(trackUrl)}&auto_play=false&hide_related=true&show_comments=false`
    return `https://w.soundcloud.com/player/?${params}`
  } catch {
    return null
  }
}
