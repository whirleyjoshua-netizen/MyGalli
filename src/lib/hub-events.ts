export type NormalizedEvent = {
  title: string
  startsAt: Date
  endsAt: Date | null
  allDay: boolean
  isOnline: boolean
  location: string | null
  description: string | null
}

export function validateEventInput(raw: unknown): { ok: true; value: NormalizedEvent } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, any>
  const title = (typeof r.title === 'string' ? r.title : '').trim()
  if (!title) return { ok: false, error: 'Title is required' }
  if (title.length > 200) return { ok: false, error: 'Title too long' }
  const startsAt = new Date(r.startsAt)
  if (isNaN(startsAt.getTime())) return { ok: false, error: 'Invalid start date' }
  let endsAt: Date | null = null
  if (r.endsAt != null && r.endsAt !== '') {
    const e = new Date(r.endsAt)
    if (isNaN(e.getTime())) return { ok: false, error: 'Invalid end date' }
    if (e.getTime() < startsAt.getTime()) return { ok: false, error: 'End cannot be before start' }
    endsAt = e
  }
  const location = typeof r.location === 'string' && r.location.trim() ? r.location.trim().slice(0, 500) : null
  const description = typeof r.description === 'string' && r.description ? r.description.slice(0, 2000) : null
  return { ok: true, value: { title, startsAt, endsAt, allDay: r.allDay === true, isOnline: r.isOnline === true, location, description } }
}

export type EventDTO = {
  id: string
  title: string
  startsAt: string
  endsAt: string | null
  allDay: boolean
  isOnline: boolean
  location: string | null
  description: string | null
}

export function toEventDTO(row: {
  id: string; title: string; startsAt: Date; endsAt: Date | null
  allDay: boolean; isOnline: boolean; location: string | null; description: string | null
}): EventDTO {
  return {
    id: row.id, title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    allDay: row.allDay, isOnline: row.isOnline, location: row.location, description: row.description,
  }
}
