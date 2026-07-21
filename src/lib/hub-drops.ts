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

// Every drop asset lives under a server-chosen, per-hub namespace. This is what
// proves a URL is *this hub's* asset rather than someone else's: one Blob store
// backs avatars, page images, message media and hub files, and the delete route
// hard-deletes a drop's blob with the app-wide RW token. Matching only the blob
// hostname would let anyone file a victim's asset as a drop and then delete it.
export function dropPathPrefix(hubId: string): string {
  return `hub-drops/${hubId}/`
}

export function isOwnDropAsset(hubId: string, url: string): boolean {
  if (!isVercelBlobUrl(url)) return false
  try {
    // `new URL` normalises `..`, so a traversal cannot escape the prefix check.
    return new URL(url).pathname.startsWith(`/${dropPathPrefix(hubId)}`)
  } catch {
    return false
  }
}

export function validateDropInput(hubId: string, raw: unknown): { ok: true; value: NormalizedDrop } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const type = r.type
  if (type !== 'image' && type !== 'video') return { ok: false, error: 'Invalid drop type' }
  // Every drop renders as <img src>/<video src> for all hub visitors. The Blob
  // token route is the upload authz boundary, but a member can POST straight to
  // /drops and skip it — so re-check ownership here rather than trust the client.
  const url = typeof r.url === 'string' ? r.url.trim() : ''
  if (!url || !isOwnDropAsset(hubId, url)) return { ok: false, error: 'A file URL is required' }
  const thumbnailUrl = typeof r.thumbnailUrl === 'string' && r.thumbnailUrl.trim() ? r.thumbnailUrl.trim() : null
  if (thumbnailUrl && !isOwnDropAsset(hubId, thumbnailUrl)) return { ok: false, error: 'A file URL is required' }
  const caption = typeof r.caption === 'string' && r.caption.trim() ? r.caption.trim().slice(0, 500) : null
  const mimeType = typeof r.mimeType === 'string' && r.mimeType.trim() ? r.mimeType.trim().slice(0, 100) : null
  return { ok: true, value: { type, url, thumbnailUrl, caption, mimeType, width: intOrNull(r.width), height: intOrNull(r.height) } }
}

export type DropAuthor = { userId: string; username: string; name: string | null; avatar: string | null }

export type DropStatus = 'pending' | 'approved' | 'rejected'

/** A drop from a moderator lands live; anyone else's waits for review. */
export function nextStatusFor(isPrivileged: boolean): DropStatus {
  return isPrivileged ? 'approved' : 'pending'
}

export function canReviewDrop(input: { isPrivileged: boolean }): boolean {
  return input.isPrivileged
}

export type DropDTO = {
  id: string
  type: DropType
  url: string
  thumbnailUrl: string | null
  caption: string | null
  mimeType: string | null
  width: number | null
  height: number | null
  status: DropStatus
  createdAt: string
  author: DropAuthor
}

export function toDropDTO(row: {
  id: string; type: string; url: string; thumbnailUrl: string | null; caption: string | null
  mimeType: string | null; width: number | null; height: number | null; status: string; createdAt: Date
  author: { id: string; username: string; name: string | null; avatar: string | null }
}): DropDTO {
  const status = row.status as DropStatus
  // A rejected drop's asset is deleted from Blob storage; emitting the dead URL
  // would leak what was uploaded via the pathname and 404 in every renderer. We also
  // blank caption and mimeType, as together they describe the rejected content and
  // defeat much of the point of deletion — the uploader's free-text description plus
  // the asset kind is sensitive metadata that should not survive rejection.
  const rejected = status === 'rejected'
  return {
    id: row.id,
    type: row.type as DropType,
    url: rejected ? '' : row.url,
    thumbnailUrl: rejected ? null : row.thumbnailUrl,
    caption: rejected ? null : row.caption,
    mimeType: rejected ? null : row.mimeType,
    width: row.width,
    height: row.height,
    status,
    createdAt: row.createdAt.toISOString(),
    author: { userId: row.author.id, username: row.author.username, name: row.author.name, avatar: row.author.avatar },
  }
}
