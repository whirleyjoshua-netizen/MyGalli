export type Preset = 'recent' | 'best' | 'event' | 'everyone'
export const PRESETS = ['recent', 'best', 'event', 'everyone'] as const

export const CANDIDATE_CAP = 120

export type CandidateRow = {
  id: string
  type: string
  caption: string | null
  durationSec: number | null
  createdAt: Date
  aiTags: unknown
  author: { username: string }
}

const DAY = 24 * 60 * 60 * 1000

/**
 * `status: 'approved'` is not optional and not configurable. Pending and
 * rejected drops must never enter a candidate set — a rejected drop's asset is
 * already deleted from Blob storage, and a pending one has not been reviewed.
 */
export function presetWhere(preset: Preset, hubId: string, now: Date): Record<string, unknown> {
  const base: Record<string, unknown> = { hubId, status: 'approved' }
  if (preset === 'recent') return { ...base, createdAt: { gte: new Date(now.getTime() - 7 * DAY) } }
  if (preset === 'event') return { ...base, createdAt: { gte: new Date(now.getTime() - 2 * DAY) } }
  return base
}

// A caption is member-authored free text that lands in a model prompt. Newlines
// and pipes are stripped so a caption cannot forge extra digest rows and talk
// the director into referencing an id that isn't really a candidate. validateEdl
// is the real backstop, but not manufacturing the injection is cheaper.
const clean = (s: string): string => s.replace(/[\r\n|]+/g, ' ').trim().slice(0, 140)

const relAge = (then: Date, now: Date): string => {
  const days = Math.floor((now.getTime() - then.getTime()) / DAY)
  if (days <= 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function tagBits(aiTags: unknown): string[] {
  if (!aiTags || typeof aiTags !== 'object' || Array.isArray(aiTags)) return []
  const t = aiTags as Record<string, unknown>
  const out: string[] = []
  if (Array.isArray(t.tags)) {
    const tags = t.tags.filter((x): x is string => typeof x === 'string').slice(0, 8)
    if (tags.length) out.push(tags.map(clean).join(','))
  }
  if (typeof t.desc === 'string' && t.desc.trim()) out.push(clean(t.desc))
  return out
}

/** One line per drop. The director sees only this — never an image. */
export function describeCandidates(rows: CandidateRow[], now: Date): string {
  return rows
    .map((r) => {
      const parts = [r.id, r.type]
      if (r.type === 'video') parts.push(r.durationSec ? `${r.durationSec}s` : '?s')
      parts.push(`@${r.author.username}`, relAge(r.createdAt, now))
      if (r.caption) parts.push(`"${clean(r.caption)}"`)
      parts.push(...tagBits(r.aiTags))
      return parts.join(' | ')
    })
    .join('\n')
}
