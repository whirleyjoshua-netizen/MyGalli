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

// A caption is member-authored free text that lands in a model prompt. Newlines,
// pipes, and Unicode line/paragraph terminators (U+2028, U+2029, U+0085, plus the
// vertical tab / form feed control chars) are stripped so a caption cannot forge
// extra digest rows and talk the director into referencing an id that isn't
// really a candidate. validateEdl is the real backstop, but not manufacturing the
// injection is cheaper.
//
// The string is NFKC-normalised before stripping so compatibility/fullwidth
// lookalikes (e.g. U+FF5C fullwidth vertical line) collapse onto their ASCII
// equivalents and get caught by the '|' strip below, instead of surviving as a
// visually-identical forged delimiter. Bidi embedding/override controls
// (U+202A-U+202E), bidi isolates (U+2066-U+2069), zero-width characters
// (U+200B, U+200C, U+200D) and the BOM (U+FEFF) are stripped too -- none have
// a legitimate purpose in a caption rendered into a model prompt, and left in
// place they can visually reorder or hide caption text in the digest.
const clean = (s: string): string =>
  s
    .normalize('NFKC')
    .replace(/[\r\n\u000B\f\u0085\u2028\u2029|\u202A-\u202E\u2066-\u2069\u200B-\u200D\uFEFF]+/g, ' ')
    .trim()
    .slice(0, 140)

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
    // clean() intentionally leaves commas alone (captions legitimately contain
    // them), so strip commas from each tag here — this join is the only place
    // a stray comma would visually forge an extra entry.
    if (tags.length) out.push(tags.map((tag) => clean(tag).replace(/,/g, '')).join(','))
  }
  if (typeof t.desc === 'string' && t.desc.trim()) out.push(clean(t.desc))
  return out
}

/** One line per drop. The director sees only this — never an image. */
export function describeCandidates(rows: CandidateRow[], now: Date): string {
  return rows
    .map((r) => {
      const parts = [r.id, r.type]
      if (r.type === 'video') parts.push(r.durationSec !== null ? `${r.durationSec}s` : '?s')
      parts.push(`@${r.author.username}`, relAge(r.createdAt, now))
      if (r.caption) parts.push(`"${clean(r.caption)}"`)
      parts.push(...tagBits(r.aiTags))
      return parts.join(' | ')
    })
    .join('\n')
}
