import { isVercelBlobUrl } from './media-url'

export type DropType = 'image' | 'video'

export type NormalizedDrop = {
  type: DropType
  url: string
  thumbnailUrl: string | null
  caption: string | null
  mimeType: string | null
  width: number | null
  height: number | null
}

const intOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null

export function validateDropInput(raw: unknown): { ok: true; value: NormalizedDrop } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const type = r.type
  if (type !== 'image' && type !== 'video') return { ok: false, error: 'Invalid drop type' }
  // Every drop renders as <img src>/<video src> for all hub visitors. The Blob
  // token route is the upload authz boundary, but a member can POST straight to
  // /drops and skip it — so re-check the host here rather than trust the client.
  const url = typeof r.url === 'string' ? r.url.trim() : ''
  if (!url || !isVercelBlobUrl(url)) return { ok: false, error: 'A file URL is required' }
  const thumbnailUrl = typeof r.thumbnailUrl === 'string' && r.thumbnailUrl.trim() ? r.thumbnailUrl.trim() : null
  if (thumbnailUrl && !isVercelBlobUrl(thumbnailUrl)) return { ok: false, error: 'A file URL is required' }
  const caption = typeof r.caption === 'string' && r.caption.trim() ? r.caption.trim().slice(0, 500) : null
  const mimeType = typeof r.mimeType === 'string' && r.mimeType.trim() ? r.mimeType.trim().slice(0, 100) : null
  return { ok: true, value: { type, url, thumbnailUrl, caption, mimeType, width: intOrNull(r.width), height: intOrNull(r.height) } }
}

export type DropAuthor = { userId: string; username: string; name: string | null; avatar: string | null }

export type DropDTO = {
  id: string
  type: DropType
  url: string
  thumbnailUrl: string | null
  caption: string | null
  mimeType: string | null
  width: number | null
  height: number | null
  hidden: boolean
  createdAt: string
  author: DropAuthor
}

export function toDropDTO(row: {
  id: string; type: string; url: string; thumbnailUrl: string | null; caption: string | null
  mimeType: string | null; width: number | null; height: number | null; hidden: boolean; createdAt: Date
  author: { id: string; username: string; name: string | null; avatar: string | null }
}): DropDTO {
  return {
    id: row.id,
    type: row.type as DropType,
    url: row.url,
    thumbnailUrl: row.thumbnailUrl,
    caption: row.caption,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    hidden: row.hidden,
    createdAt: row.createdAt.toISOString(),
    author: { userId: row.author.id, username: row.author.username, name: row.author.name, avatar: row.author.avatar },
  }
}
