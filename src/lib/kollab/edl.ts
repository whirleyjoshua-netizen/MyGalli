export type EdlClip = { dropId: string; in: number; out: number }
export type Edl = { title: string; clips: EdlClip[] }
export type EdlCandidate = { id: string; durationSec: number | null }

const MAX_CLIPS = 40
const MAX_TITLE = 80

// Handed to Claude via output_config.format. `additionalProperties: false` is
// required by the structured-outputs API and keeps the model from inventing
// fields we would then have to think about ignoring.
export const EDL_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'A short, human title for the reel. No emoji, no quotes.' },
    clips: {
      type: 'array',
      description: 'Clips in playback order.',
      items: {
        type: 'object',
        properties: {
          dropId: { type: 'string', description: 'Must be one of the listed drop ids.' },
          in: { type: 'number', description: 'Start offset in seconds. 0 for a photo.' },
          out: { type: 'number', description: 'End offset in seconds. Must be greater than in.' },
        },
        required: ['dropId', 'in', 'out'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'clips'],
  additionalProperties: false,
} as const

export function edlRuntime(edl: Edl): number {
  return edl.clips.reduce((sum, c) => sum + (c.out - c.in), 0)
}

const bad = (error: string) => ({ ok: false as const, error })

/**
 * The trust boundary for model output. Everything downstream — the persisted
 * row, the hydrated payload, the player — assumes this has run. A dropId that
 * is not in `candidates` must never reach a fetch: the candidate set is already
 * filtered to approved drops in this hub, so honouring an arbitrary id would
 * let a hallucination (or an injected caption) surface pending, rejected, or
 * cross-hub media.
 */
export function validateEdl(
  raw: unknown,
  candidates: EdlCandidate[],
  targetSec: number,
): { ok: true; value: Edl } | { ok: false; error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad('The model did not return a reel')
  const r = raw as Record<string, unknown>

  const rawTitle = typeof r.title === 'string' ? r.title.trim() : ''
  if (!rawTitle) return bad('The model returned a reel with no title')
  const title = rawTitle.slice(0, MAX_TITLE)

  if (!Array.isArray(r.clips)) return bad('The model returned no clips')
  if (r.clips.length === 0) return bad('The model returned an empty reel')
  if (r.clips.length > MAX_CLIPS) return bad(`A reel cannot have more than ${MAX_CLIPS} clips`)

  const byId = new Map(candidates.map((c) => [c.id, c]))
  const seen = new Set<string>()
  const clips: EdlClip[] = []

  for (const c of r.clips) {
    if (!c || typeof c !== 'object') return bad('The model returned a malformed clip')
    const { dropId, in: inAt, out } = c as Record<string, unknown>
    if (typeof dropId !== 'string') return bad('The model returned a malformed clip')
    const cand = byId.get(dropId)
    if (!cand) return bad('The model referenced an unknown clip')
    if (typeof inAt !== 'number' || !Number.isFinite(inAt) || inAt < 0) return bad('The model returned a bad clip start')
    if (typeof out !== 'number' || !Number.isFinite(out) || out <= inAt) return bad('The model returned a bad clip end')
    // A null duration means we never captured one (pre-Task-1 video, or a codec
    // the browser wouldn't report). We cannot bound it here, so we let it through
    // and the player clamps `out` to the real duration once the media loads.
    if (cand.durationSec !== null && out > cand.durationSec + 0.05) return bad('The model ran a clip past its end')

    const key = `${dropId}@${inAt}`
    if (seen.has(key)) return bad('The model returned a duplicate clip')
    seen.add(key)
    clips.push({ dropId, in: inAt, out })
  }

  const value: Edl = { title, clips }
  if (edlRuntime(value) > targetSec * 2) return bad('The model returned a reel far longer than requested')
  return { ok: true, value }
}
