export const ANNOUNCEMENT_MAX = 280

export function validateAnnouncementBody(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Announcement is required' }
  const value = raw.trim()
  if (!value) return { ok: false, error: 'Announcement is required' }
  if (value.length > ANNOUNCEMENT_MAX) return { ok: false, error: `Keep it under ${ANNOUNCEMENT_MAX} characters` }
  return { ok: true, value }
}

export type AnnouncementAuthor = { username: string; name: string | null; avatar: string | null }

export type AnnouncementDTO = {
  id: string
  body: string
  createdAt: string
  author: AnnouncementAuthor
}

export function toAnnouncementDTO(row: {
  id: string; body: string; createdAt: Date
  author: { username: string; name: string | null; avatar: string | null }
}): AnnouncementDTO {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: { username: row.author.username, name: row.author.name, avatar: row.author.avatar },
  }
}
