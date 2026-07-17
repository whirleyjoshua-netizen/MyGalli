export type HubVideoEmbed = { kind: 'youtube' | 'vimeo' | 'file'; src: string } | null

export function hubVideoEmbed(url?: string | null): HubVideoEmbed {
  if (!url || typeof url !== 'string') return null
  const u = url.trim()
  if (!u) return null
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) return { kind: 'youtube', src: `https://www.youtube.com/embed/${yt[1]}` }
  const vim = u.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vim) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${vim[1]}` }
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return { kind: 'file', src: u }
  return null
}
